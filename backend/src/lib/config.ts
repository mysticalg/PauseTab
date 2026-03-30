import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  PAUSETAB_PUBLIC_URL: z.string().optional(),
  PAUSETAB_STORE_PATH: z.string().optional(),
  PAUSETAB_TOKEN_PEPPER: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_ANNUAL: z.string().optional(),
  STRIPE_PRICE_LIFETIME: z.string().optional(),
});

export type AppConfig = {
  port: number;
  corsOrigin: string;
  publicUrl: string;
  storePath: string;
  tokenPepper: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripePriceIds: {
    monthly?: string;
    annual?: string;
    lifetime?: string;
  };
};

let cachedConfig: AppConfig | null = null;

export const getConfig = (): AppConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.parse(process.env);
  cachedConfig = {
    port: Number(parsed.PORT ?? 8787),
    corsOrigin: parsed.CORS_ORIGIN ?? "*",
    publicUrl: parsed.PAUSETAB_PUBLIC_URL ?? "http://localhost:5173",
    storePath: parsed.PAUSETAB_STORE_PATH ?? "backend/data/store.json",
    tokenPepper: parsed.PAUSETAB_TOKEN_PEPPER ?? "pausetab-dev-pepper",
    stripeSecretKey: parsed.STRIPE_SECRET_KEY,
    stripeWebhookSecret: parsed.STRIPE_WEBHOOK_SECRET,
    stripePriceIds: {
      monthly: parsed.STRIPE_PRICE_PRO_MONTHLY,
      annual: parsed.STRIPE_PRICE_PRO_ANNUAL,
      lifetime: parsed.STRIPE_PRICE_LIFETIME,
    },
  };
  return cachedConfig;
};
