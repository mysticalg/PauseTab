import { z } from "zod";

export const publicLicenseStatusSchema = z.enum(["free", "trial", "pro", "past_due", "canceled", "expired"]);
export type PublicLicenseStatus = z.infer<typeof publicLicenseStatusSchema>;

export const planKeySchema = z.enum(["monthly", "annual", "lifetime"]);
export type PlanKey = z.infer<typeof planKeySchema>;

export const syncedStateSchema = z.object({
  rules: z.array(z.unknown()).default([]),
  preferences: z.record(z.string(), z.unknown()).default({}),
  updatedAt: z.string(),
});
export type SyncedState = z.infer<typeof syncedStateSchema>;

export const accountLicenseSchema = z.object({
  status: publicLicenseStatusSchema.default("free"),
  plan: planKeySchema.optional(),
  stripeCheckoutSessionId: z.string().optional(),
  stripePriceId: z.string().optional(),
  stripeSubscriptionStatus: z.string().optional(),
  currentPeriodEnd: z.string().optional(),
  expiresAt: z.string().optional(),
});
export type AccountLicense = z.infer<typeof accountLicenseSchema>;

export const accountRecordSchema = z.object({
  id: z.string(),
  email: z.email(),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  activationCodeHash: z.string().optional(),
  syncTokenHash: z.string().optional(),
  activationCodeIssuedAt: z.string().optional(),
  syncTokenIssuedAt: z.string().optional(),
  license: accountLicenseSchema,
  syncedState: syncedStateSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AccountRecord = z.infer<typeof accountRecordSchema>;

export const webhookRecordSchema = z.object({
  id: z.string(),
  receivedAt: z.string(),
});
export type WebhookRecord = z.infer<typeof webhookRecordSchema>;

export const storeDataSchema = z.object({
  version: z.literal(1),
  accounts: z.array(accountRecordSchema).default([]),
  webhooks: z.array(webhookRecordSchema).default([]),
});
export type StoreData = z.infer<typeof storeDataSchema>;

export const checkoutSessionRequestSchema = z.object({
  plan: planKeySchema,
  successUrl: z.url().optional(),
  cancelUrl: z.url().optional(),
});

export const portalSessionRequestSchema = z
  .object({
    activationCode: z.string().min(1).optional(),
    accountId: z.string().min(1).optional(),
    syncToken: z.string().min(1).optional(),
    returnUrl: z.url().optional(),
  })
  .refine((value) => Boolean(value.activationCode) || Boolean(value.accountId && value.syncToken), {
    message: "Provide activationCode or accountId + syncToken.",
  });

export const activateLicenseRequestSchema = z.object({
  activationCode: z.string().min(1),
});

export const syncRequestSchema = z.object({
  accountId: z.string().min(1),
  syncToken: z.string().min(1),
});
