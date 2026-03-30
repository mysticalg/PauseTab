import { LOCAL_TRIAL_ENABLED } from "./api";
import { MAX_FREE_RULES } from "./constants";
import type { ExtensionState, LicenseState } from "./schema";

export type FeatureKey =
  | "unlimited_rules"
  | "schedules"
  | "budgets"
  | "session_caps"
  | "temporary_passes"
  | "cooldowns"
  | "weekly_reports"
  | "sync";

const PRO_FEATURES = new Set<FeatureKey>([
  "unlimited_rules",
  "schedules",
  "budgets",
  "session_caps",
  "temporary_passes",
  "cooldowns",
  "weekly_reports",
  "sync",
]);

export const normalizeLicenseState = (license: LicenseState): LicenseState => {
  if (!LOCAL_TRIAL_ENABLED && license.status === "trial" && license.trialStartedAt) {
    return {
      ...license,
      status: "expired",
      syncEnabled: false,
    };
  }

  if (!license.expiresAt) {
    return license;
  }

  if (new Date(license.expiresAt).getTime() <= Date.now()) {
    return {
      ...license,
      status: license.status === "pro" || license.status === "trial" ? "expired" : license.status,
      syncEnabled: false,
    };
  }

  return license;
};

export const isPaidLicense = (license: LicenseState) => {
  const normalized = normalizeLicenseState(license);
  return normalized.status === "trial" || normalized.status === "pro";
};

export const hasFeature = (license: LicenseState, feature: FeatureKey) => {
  if (!PRO_FEATURES.has(feature)) {
    return true;
  }

  return isPaidLicense(license);
};

export const getRuleLimit = (license: LicenseState) => (isPaidLicense(license) ? Number.POSITIVE_INFINITY : MAX_FREE_RULES);

export const canCreateAnotherRule = (state: ExtensionState) => state.rules.length < getRuleLimit(state.license);

export const startLocalTrial = (license: LicenseState): LicenseState => {
  if (!LOCAL_TRIAL_ENABLED || license.trialStartedAt || license.status === "pro") {
    return license;
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    ...license,
    status: "trial",
    expiresAt,
    trialStartedAt: new Date().toISOString(),
    syncEnabled: true,
  };
};

export const hasRemoteLicenseCredentials = (license: LicenseState) => Boolean(license.accountId && license.syncToken);

export const getFreeTierUpgradeMessage = () =>
  LOCAL_TRIAL_ENABLED
    ? "PauseTab Free supports up to 3 protected sites. Open the Plan tab to activate Pro or start the local development trial."
    : "PauseTab Free supports up to 3 protected sites. Open the Plan tab to activate Pro.";
