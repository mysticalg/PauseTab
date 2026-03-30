import { randomUUID } from "node:crypto";

import { generateActivationCode, generateSyncToken, hashSecret } from "../lib/crypto";
import type { AccountRecord, PlanKey, PublicLicenseStatus, SyncedState } from "../lib/schemas";
import { findAccountByActivationCode, findAccountByEmail, findAccountById, findAccountByStripeCustomerId, findAccountBySyncToken, mutateAccount } from "./store";

type UpsertAccountParams = {
  email: string;
  customerId?: string;
  subscriptionId?: string;
  checkoutSessionId?: string;
  priceId?: string;
  plan?: PlanKey;
  status: PublicLicenseStatus;
  stripeSubscriptionStatus?: string;
  currentPeriodEnd?: string;
  expiresAt?: string;
};

const nowIso = () => new Date().toISOString();

const createBaseAccount = (email: string): AccountRecord => ({
  id: randomUUID(),
  email: email.trim().toLowerCase(),
  license: {
    status: "free",
  },
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

export const toPublicLicensePayload = (account: AccountRecord, extras?: { syncToken?: string; activationCode?: string }) => ({
  status: account.license.status,
  plan: account.license.plan,
  expiresAt: account.license.expiresAt,
  accountId: account.id,
  accountEmail: account.email,
  syncEnabled: account.license.status === "pro" || account.license.status === "trial",
  syncToken: extras?.syncToken,
  activationCode: extras?.activationCode,
});

export const upsertLicensedAccount = async ({
  email,
  customerId,
  subscriptionId,
  checkoutSessionId,
  priceId,
  plan,
  status,
  stripeSubscriptionStatus,
  currentPeriodEnd,
  expiresAt,
}: UpsertAccountParams) => {
  const existing = (customerId && (await findAccountByStripeCustomerId(customerId))) || (await findAccountByEmail(email));
  const accountId = existing?.id ?? randomUUID();
  const normalizedEmail = email.trim().toLowerCase();

  await mutateAccount(
    (account) => account.id === accountId || account.email === normalizedEmail || Boolean(customerId && account.stripeCustomerId === customerId),
    (account) => ({
      ...(account ?? createBaseAccount(normalizedEmail)),
      id: accountId,
      email: normalizedEmail,
      stripeCustomerId: customerId ?? account?.stripeCustomerId,
      stripeSubscriptionId: subscriptionId ?? account?.stripeSubscriptionId,
      license: {
        status,
        plan: plan ?? account?.license.plan,
        stripeCheckoutSessionId: checkoutSessionId ?? account?.license.stripeCheckoutSessionId,
        stripePriceId: priceId ?? account?.license.stripePriceId,
        stripeSubscriptionStatus: stripeSubscriptionStatus ?? account?.license.stripeSubscriptionStatus,
        currentPeriodEnd: currentPeriodEnd ?? account?.license.currentPeriodEnd,
        expiresAt: expiresAt ?? account?.license.expiresAt,
      },
      updatedAt: nowIso(),
    }),
  );

  return findAccountById(accountId);
};

export const issueActivationCodeForAccount = async (accountId: string) => {
  const activationCode = generateActivationCode();
  await mutateAccount(
    (account) => account.id === accountId,
    (account) => ({
      ...(account ?? (() => {
        throw new Error("Account not found");
      })()),
      activationCodeHash: hashSecret(activationCode),
      activationCodeIssuedAt: nowIso(),
      updatedAt: nowIso(),
    }),
  );
  return activationCode;
};

export const activateAccountFromCode = async (activationCode: string) => {
  const account = await findAccountByActivationCode(activationCode);
  if (!account) {
    return null;
  }

  const syncToken = generateSyncToken();
  await mutateAccount(
    (candidate) => candidate.id === account.id,
    (candidate) => ({
      ...(candidate ?? account),
      syncTokenHash: hashSecret(syncToken),
      syncTokenIssuedAt: nowIso(),
      updatedAt: nowIso(),
    }),
  );

  const refreshedAccount = await findAccountById(account.id);
  if (!refreshedAccount) {
    return null;
  }

  return toPublicLicensePayload(refreshedAccount, { syncToken, activationCode });
};

export const getLicenseStatusForSyncToken = async (accountId: string, syncToken: string) => {
  const account = await findAccountBySyncToken(accountId, syncToken);
  if (!account) {
    return null;
  }

  return toPublicLicensePayload(account);
};

export const getAccountFromActivationCode = (activationCode: string) => findAccountByActivationCode(activationCode);

export const getSyncedState = async (accountId: string, syncToken: string) => {
  const account = await findAccountBySyncToken(accountId, syncToken);
  return account?.syncedState;
};

export const setSyncedState = async (accountId: string, syncToken: string, syncedState: SyncedState) => {
  const account = await findAccountBySyncToken(accountId, syncToken);
  if (!account) {
    return null;
  }

  await mutateAccount(
    (candidate) => candidate.id === account.id,
    (candidate) => ({
      ...(candidate ?? account),
      syncedState,
      updatedAt: nowIso(),
    }),
  );

  return findAccountById(account.id);
};
