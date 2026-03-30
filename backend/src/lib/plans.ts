import { getConfig } from "./config.js";

export type PlanKey = "monthly" | "annual" | "lifetime";

export type PlanDefinition = {
  key: PlanKey;
  label: string;
  mode: "subscription" | "payment";
  intervalLabel: string;
  amountLabel: string;
  priceId?: string;
};

export const getPlanDefinitions = (): Record<PlanKey, PlanDefinition> => {
  const { stripePriceIds } = getConfig();
  return {
    monthly: {
      key: "monthly",
      label: "Pro Monthly",
      mode: "subscription",
      intervalLabel: "Monthly",
      amountLabel: "GBP 3.99",
      priceId: stripePriceIds.monthly,
    },
    annual: {
      key: "annual",
      label: "Pro Annual",
      mode: "subscription",
      intervalLabel: "Annual",
      amountLabel: "GBP 24.99",
      priceId: stripePriceIds.annual,
    },
    lifetime: {
      key: "lifetime",
      label: "Lifetime",
      mode: "payment",
      intervalLabel: "One-time",
      amountLabel: "GBP 39.00",
      priceId: stripePriceIds.lifetime,
    },
  };
};

export const getPlanDefinition = (plan: PlanKey) => getPlanDefinitions()[plan];
