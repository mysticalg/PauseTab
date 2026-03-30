import Stripe from "stripe";

import { getConfig } from "../lib/config";
import { getPlanDefinition, getPlanDefinitions, type PlanKey } from "../lib/plans";
import type { PublicLicenseStatus } from "../lib/schemas";
import { issueActivationCodeForAccount, upsertLicensedAccount } from "./licenseService";
import { findAccountByActivationCode, findAccountByStripeCustomerId, findAccountBySyncToken, isWebhookProcessed, markWebhookProcessed } from "./store";

let stripeClient: Stripe | null = null;

const getStripe = () => {
  const config = getConfig();
  if (!config.stripeSecretKey) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY and the plan price IDs.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(config.stripeSecretKey, {
      apiVersion: "2026-03-25.dahlia",
    });
  }

  return stripeClient;
};

const mapSubscriptionStatus = (status: string | undefined): PublicLicenseStatus => {
  switch (status) {
    case "trialing":
      return "trial";
    case "active":
      return "pro";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "expired";
  }
};

const resolveCustomerEmail = async (session: Stripe.Checkout.Session) => {
  if (session.customer_details?.email) {
    return session.customer_details.email;
  }

  if (typeof session.customer === "object" && session.customer && !session.customer.deleted && session.customer.email) {
    return session.customer.email;
  }

  if (typeof session.customer === "string") {
    const customer = await getStripe().customers.retrieve(session.customer);
    if (!customer.deleted) {
      return customer.email ?? undefined;
    }
  }

  return session.customer_email ?? undefined;
};

const getSubscriptionPeriodEnd = (subscription: Stripe.Subscription | undefined) => {
  const periodEnd = subscription?.items.data[0]?.current_period_end;
  return periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined;
};

export const getBillingCapabilities = () => {
  const plans = getPlanDefinitions();
  return {
    stripeReady: Boolean(getConfig().stripeSecretKey),
    plans: Object.values(plans).map((plan) => ({
      ...plan,
      ready: Boolean(plan.priceId),
    })),
  };
};

export const createCheckoutSession = async (plan: PlanKey, successUrl?: string, cancelUrl?: string) => {
  const stripe = getStripe();
  const planDefinition = getPlanDefinition(plan);
  if (!planDefinition.priceId) {
    throw new Error(`Missing Stripe price ID for ${plan}.`);
  }

  const fallbackSuccessUrl = `${getConfig().publicUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const fallbackCancelUrl = `${getConfig().publicUrl}/?checkout=cancelled`;

  const session = await stripe.checkout.sessions.create({
    mode: planDefinition.mode,
    line_items: [
      {
        price: planDefinition.priceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    customer_creation: planDefinition.mode === "payment" ? "always" : undefined,
    success_url: successUrl ?? fallbackSuccessUrl,
    cancel_url: cancelUrl ?? fallbackCancelUrl,
    metadata: {
      plan,
      product: "PauseTab Pro",
    },
  });

  return session;
};

export const claimCheckoutSession = async (sessionId: string) => {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["customer", "subscription"],
  });

  if (session.status !== "complete") {
    throw new Error("Checkout session is not complete yet.");
  }

  const plan = session.metadata?.plan as PlanKey | undefined;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.deleted
        ? undefined
        : session.customer?.id;

  const email = await resolveCustomerEmail(session);
  if (!email) {
    throw new Error("Could not resolve the checkout customer email.");
  }

  const subscription =
    typeof session.subscription === "object" && session.subscription && !("deleted" in session.subscription)
      ? session.subscription
      : undefined;

  const account = await upsertLicensedAccount({
    email,
    customerId,
    subscriptionId: typeof session.subscription === "string" ? session.subscription : subscription?.id,
    checkoutSessionId: session.id,
    priceId: plan ? getPlanDefinition(plan).priceId : undefined,
    plan,
    status: plan === "lifetime" ? "pro" : mapSubscriptionStatus(subscription?.status ?? "active"),
    stripeSubscriptionStatus: subscription?.status,
    currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
    expiresAt: plan === "lifetime" ? undefined : getSubscriptionPeriodEnd(subscription),
  });

  if (!account) {
    throw new Error("Could not persist the paid account.");
  }

  const activationCode = await issueActivationCodeForAccount(account.id);
  return {
    account,
    activationCode,
  };
};

export const createPortalSession = async (credentials: { activationCode?: string; accountId?: string; syncToken?: string }, returnUrl?: string) => {
  const stripe = getStripe();
  const account = credentials.activationCode
    ? await findAccountByActivationCode(credentials.activationCode)
    : credentials.accountId && credentials.syncToken
      ? await findAccountBySyncToken(credentials.accountId, credentials.syncToken)
      : undefined;
  if (!account?.stripeCustomerId) {
    throw new Error("No Stripe customer exists for this activation code.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: returnUrl ?? getConfig().publicUrl,
  });

  return session;
};

export const handleStripeWebhook = async (signature: string | undefined, payload: Buffer) => {
  const { stripeWebhookSecret } = getConfig();
  if (!stripeWebhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  }

  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(payload, signature ?? "", stripeWebhookSecret);
  if (await isWebhookProcessed(event.id)) {
    return event;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = session.metadata?.plan as PlanKey | undefined;
      const email = session.customer_details?.email ?? session.customer_email;
      if (!email) {
        break;
      }

      await upsertLicensedAccount({
        email,
        customerId: typeof session.customer === "string" ? session.customer : undefined,
        subscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
        checkoutSessionId: session.id,
        plan,
        status: plan === "lifetime" ? "pro" : "pro",
      });
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const customer = await findAccountByStripeCustomerId(customerId);
      if (!customer) {
        break;
      }

      await upsertLicensedAccount({
        email: customer.email,
        customerId,
        subscriptionId: subscription.id,
        checkoutSessionId: customer.license.stripeCheckoutSessionId,
        priceId: subscription.items.data[0]?.price.id,
        plan:
          customer.license.plan ??
          (subscription.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly"),
        status: mapSubscriptionStatus(subscription.status),
        stripeSubscriptionStatus: subscription.status,
        currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
        expiresAt: getSubscriptionPeriodEnd(subscription),
      });
      break;
    }
    default:
      break;
  }

  await markWebhookProcessed({
    id: event.id,
    receivedAt: new Date().toISOString(),
  });
  return event;
};
