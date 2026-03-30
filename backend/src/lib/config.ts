import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.optional(),
  PORT: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  PAUSETAB_ALLOWED_ORIGINS: z.string().optional(),
  PAUSETAB_ALLOWED_EXTENSION_IDS: z.string().optional(),
  PAUSETAB_ALLOWED_RETURN_ORIGINS: z.string().optional(),
  PAUSETAB_PUBLIC_URL: z.string().optional(),
  PAUSETAB_STORE_PATH: z.string().optional(),
  PAUSETAB_STORE_S3_BUCKET: z.string().optional(),
  PAUSETAB_STORE_S3_KEY: z.string().optional(),
  PAUSETAB_TOKEN_PEPPER: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_ANNUAL: z.string().optional(),
  STRIPE_PRICE_LIFETIME: z.string().optional(),
});

export type AppConfig = {
  nodeEnv: z.infer<typeof nodeEnvSchema>;
  port: number;
  publicUrl: string;
  allowedOrigins: string[];
  allowedExtensionIds: string[];
  allowedReturnOrigins: string[];
  storePath: string;
  storeS3Bucket?: string;
  storeS3Key: string;
  tokenPepper: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripePriceIds: {
    monthly?: string;
    annual?: string;
    lifetime?: string;
  };
};

const DEFAULT_PUBLIC_URL = "http://localhost:5173";
const DEFAULT_STORE_PATH = "data/store.json";
const DEFAULT_STORE_S3_KEY = "store.json";
const DEFAULT_TOKEN_PEPPER = "pausetab-dev-pepper";
const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

let cachedConfig: AppConfig | null = null;

const splitCsv = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeOrigin = (value: string) => {
  const parsed = new URL(value);
  if (parsed.protocol === "chrome-extension:") {
    return `chrome-extension://${parsed.hostname}`;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported origin protocol for ${value}.`);
  }

  return parsed.origin;
};

const normalizeReturnUrlOrigin = (value: string) => {
  const parsed = new URL(value.replaceAll("{CHECKOUT_SESSION_ID}", "CHECKOUT_SESSION_ID"));
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported return URL protocol for ${value}.`);
  }

  return parsed.origin;
};

const getExtensionIdFromOrigin = (value: string) => {
  const parsed = new URL(value);
  if (parsed.protocol !== "chrome-extension:") {
    return undefined;
  }

  return parsed.hostname;
};

const resolveAllowedOrigins = (nodeEnv: AppConfig["nodeEnv"], configuredOrigins: string[], publicUrl: string) => {
  const normalizedConfiguredOrigins = configuredOrigins.map(normalizeOrigin);
  if (normalizedConfiguredOrigins.length > 0) {
    return normalizedConfiguredOrigins;
  }

  if (nodeEnv === "production") {
    return [normalizeOrigin(publicUrl)];
  }

  return [normalizeOrigin(publicUrl), "http://localhost:5173", "http://127.0.0.1:5173"];
};

const resolveAllowedReturnOrigins = (configuredOrigins: string[], publicUrl: string) => {
  const normalizedConfiguredOrigins = configuredOrigins.map(normalizeReturnUrlOrigin);
  return normalizedConfiguredOrigins.length > 0 ? normalizedConfiguredOrigins : [normalizeReturnUrlOrigin(publicUrl)];
};

const resolveAllowedExtensionIds = (configuredIds: string[]) =>
  configuredIds
    .map((value) => value.trim())
    .filter(Boolean);

const getMissingBillingConfig = (config: AppConfig) => {
  const missing: string[] = [];
  if (!config.stripeSecretKey) {
    missing.push("STRIPE_SECRET_KEY");
  }
  if (!config.stripeWebhookSecret) {
    missing.push("STRIPE_WEBHOOK_SECRET");
  }
  if (!config.stripePriceIds.monthly) {
    missing.push("STRIPE_PRICE_PRO_MONTHLY");
  }
  if (!config.stripePriceIds.annual) {
    missing.push("STRIPE_PRICE_PRO_ANNUAL");
  }
  if (!config.stripePriceIds.lifetime) {
    missing.push("STRIPE_PRICE_LIFETIME");
  }
  return missing;
};

const validateProductionConfig = (config: AppConfig) => {
  if (config.nodeEnv !== "production") {
    return;
  }

  const errors: string[] = [];
  if (!config.publicUrl.startsWith("https://")) {
    errors.push("PAUSETAB_PUBLIC_URL must use https in production.");
  }
  if (config.allowedOrigins.length === 0) {
    errors.push("Set PAUSETAB_ALLOWED_ORIGINS for production clients.");
  }
  if (config.allowedReturnOrigins.length === 0) {
    errors.push("Set PAUSETAB_ALLOWED_RETURN_ORIGINS for production billing redirects.");
  }
  if (config.tokenPepper === DEFAULT_TOKEN_PEPPER || config.tokenPepper === "replace-with-a-long-random-secret") {
    errors.push("Replace PAUSETAB_TOKEN_PEPPER with a long random secret.");
  }

  const missingBillingConfig = getMissingBillingConfig(config);
  if (missingBillingConfig.length > 0) {
    errors.push(`Missing Stripe billing config: ${missingBillingConfig.join(", ")}.`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid production configuration: ${errors.join(" ")}`);
  }
};

export const getConfig = (): AppConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.parse(process.env);
  const nodeEnv = parsed.NODE_ENV ?? "development";
  const publicUrl = parsed.PAUSETAB_PUBLIC_URL ?? DEFAULT_PUBLIC_URL;

  cachedConfig = {
    nodeEnv,
    port: Number(parsed.PORT ?? 8787),
    publicUrl,
    allowedOrigins: resolveAllowedOrigins(nodeEnv, splitCsv(parsed.PAUSETAB_ALLOWED_ORIGINS ?? parsed.CORS_ORIGIN), publicUrl),
    allowedExtensionIds: resolveAllowedExtensionIds(splitCsv(parsed.PAUSETAB_ALLOWED_EXTENSION_IDS)),
    allowedReturnOrigins: resolveAllowedReturnOrigins(splitCsv(parsed.PAUSETAB_ALLOWED_RETURN_ORIGINS), publicUrl),
    storePath: parsed.PAUSETAB_STORE_PATH ?? DEFAULT_STORE_PATH,
    storeS3Bucket: parsed.PAUSETAB_STORE_S3_BUCKET,
    storeS3Key: parsed.PAUSETAB_STORE_S3_KEY ?? DEFAULT_STORE_S3_KEY,
    tokenPepper: parsed.PAUSETAB_TOKEN_PEPPER ?? DEFAULT_TOKEN_PEPPER,
    stripeSecretKey: parsed.STRIPE_SECRET_KEY,
    stripeWebhookSecret: parsed.STRIPE_WEBHOOK_SECRET,
    stripePriceIds: {
      monthly: parsed.STRIPE_PRICE_PRO_MONTHLY,
      annual: parsed.STRIPE_PRICE_PRO_ANNUAL,
      lifetime: parsed.STRIPE_PRICE_LIFETIME,
    },
  };

  validateProductionConfig(cachedConfig);
  return cachedConfig;
};

export const getMissingBillingConfiguration = () => getMissingBillingConfig(getConfig());

export const resetConfigCache = () => {
  cachedConfig = null;
};

export const isAllowedRequestOrigin = (origin: string | undefined) => {
  if (!origin) {
    return true;
  }

  const config = getConfig();
  if (config.allowedOrigins.includes(origin)) {
    return true;
  }

  const extensionId = getExtensionIdFromOrigin(origin);
  if (extensionId) {
    return config.allowedExtensionIds.length === 0 || config.allowedExtensionIds.includes(extensionId);
  }

  if (config.nodeEnv !== "production" && LOCALHOST_ORIGIN_PATTERN.test(origin)) {
    return true;
  }

  return false;
};

export const resolveAllowedReturnUrl = (candidate: string | undefined, fallback: string) => {
  if (!candidate) {
    return fallback;
  }

  try {
    const origin = normalizeReturnUrlOrigin(candidate);
    return getConfig().allowedReturnOrigins.includes(origin) ? candidate : fallback;
  } catch {
    return fallback;
  }
};
