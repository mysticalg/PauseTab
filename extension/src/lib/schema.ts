import { z } from "zod";

export const ruleModeSchema = z.enum(["delay", "budget", "session_cap", "hard_block"]);
export type RuleMode = z.infer<typeof ruleModeSchema>;

export const setupModeSchema = z.enum(["gentle", "balanced", "strict"]);
export type SetupMode = z.infer<typeof setupModeSchema>;

export const themeSchema = z.enum(["system", "light", "dark"]);
export type ThemeMode = z.infer<typeof themeSchema>;

export const licenseStatusSchema = z.enum(["free", "trial", "pro", "past_due", "canceled", "expired"]);
export type LicenseStatus = z.infer<typeof licenseStatusSchema>;

export const scheduleDaySchema = z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
export type ScheduleDay = z.infer<typeof scheduleDaySchema>;

export const scheduleWindowSchema = z.object({
  id: z.string(),
  days: z.array(scheduleDaySchema).min(1),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
});
export type ScheduleWindow = z.infer<typeof scheduleWindowSchema>;

export const ruleSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  domainPattern: z.string().min(1),
  pathPattern: z.string().optional(),
  mode: ruleModeSchema,
  delaySeconds: z.number().int().min(0).max(300),
  promptEnabled: z.boolean(),
  promptText: z.string().optional(),
  enabled: z.boolean(),
  allowlistPatterns: z.array(z.string()).default([]),
  schedule: z.array(scheduleWindowSchema).default([]),
  dailyMinuteBudget: z.number().int().positive().optional(),
  dailySessionLimit: z.number().int().positive().optional(),
  cooldownMinutes: z.number().int().positive().optional(),
  tier: z.enum(["free", "pro"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Rule = z.infer<typeof ruleSchema>;

export const domainStatsSchema = z.object({
  interceptedOpens: z.number().int().nonnegative().default(0),
  avoidedOpens: z.number().int().nonnegative().default(0),
  proceededOpens: z.number().int().nonnegative().default(0),
  overridesUsed: z.number().int().nonnegative().default(0),
  estimatedMinutesSaved: z.number().nonnegative().default(0),
  minutesSpent: z.number().nonnegative().default(0),
  sessionCount: z.number().int().nonnegative().default(0),
});
export type DomainStats = z.infer<typeof domainStatsSchema>;

export const dailyStatsSchema = z.object({
  date: z.string(),
  interceptedOpens: z.number().int().nonnegative().default(0),
  avoidedOpens: z.number().int().nonnegative().default(0),
  proceededOpens: z.number().int().nonnegative().default(0),
  overridesUsed: z.number().int().nonnegative().default(0),
  estimatedMinutesSaved: z.number().nonnegative().default(0),
  byDomain: z.record(z.string(), domainStatsSchema).default({}),
});
export type DailyStats = z.infer<typeof dailyStatsSchema>;

export const temporaryPassSchema = z.object({
  id: z.string(),
  domainPattern: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  expiresOnSessionEnd: z.boolean().default(false),
});
export type TemporaryPass = z.infer<typeof temporaryPassSchema>;

export const cooldownSchema = z.object({
  domainPattern: z.string(),
  until: z.string(),
});
export type CooldownState = z.infer<typeof cooldownSchema>;

export const preferencesSchema = z.object({
  theme: themeSchema.default("system"),
  reducedMotion: z.boolean().default(false),
  weeklySummaryEnabled: z.boolean().default(true),
  weeklySummaryDay: scheduleDaySchema.default("sun"),
  defaultMode: setupModeSchema.default("balanced"),
  localAnalyticsEnabled: z.boolean().default(true),
  syncEnabled: z.boolean().default(false),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const onboardingStateSchema = z.object({
  completed: z.boolean().default(false),
  selectedPresets: z.array(z.string()).default([]),
});
export type OnboardingState = z.infer<typeof onboardingStateSchema>;

export const licenseStateSchema = z.object({
  status: licenseStatusSchema.default("free"),
  plan: z.enum(["monthly", "annual", "lifetime"]).optional(),
  expiresAt: z.string().optional(),
  accountId: z.string().optional(),
  accountEmail: z.string().optional(),
  activationCode: z.string().optional(),
  syncToken: z.string().optional(),
  syncEnabled: z.boolean().default(false),
  trialStartedAt: z.string().optional(),
  lastValidatedAt: z.string().optional(),
});
export type LicenseState = z.infer<typeof licenseStateSchema>;

export const extensionStateSchema = z.object({
  version: z.number().int(),
  rules: z.array(ruleSchema).default([]),
  statsByDate: z.record(z.string(), dailyStatsSchema).default({}),
  passes: z.array(temporaryPassSchema).default([]),
  cooldowns: z.array(cooldownSchema).default([]),
  globalPauseUntil: z.string().optional(),
  preferences: preferencesSchema.default({
    theme: "system",
    reducedMotion: false,
    weeklySummaryEnabled: true,
    weeklySummaryDay: "sun",
    defaultMode: "balanced",
    localAnalyticsEnabled: true,
    syncEnabled: false,
  }),
  onboarding: onboardingStateSchema.default({
    completed: false,
    selectedPresets: [],
  }),
  license: licenseStateSchema.default({
    status: "free",
    syncEnabled: false,
  }),
  updatedAt: z.string(),
});
export type ExtensionState = z.infer<typeof extensionStateSchema>;

export type SyncState = Pick<ExtensionState, "rules" | "preferences" | "license" | "updatedAt">;
