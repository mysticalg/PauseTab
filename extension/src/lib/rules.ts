import { SETUP_MODES } from "./constants";
import { createLabelFromDomain, normalizeDomainPattern } from "./domains";
import { extensionStateSchema, ruleSchema, type ExtensionState, type Rule, type SetupMode } from "./schema";

type RuleSeed = {
  domainPattern: string;
  label?: string;
  pathPattern?: string;
  tier?: Rule["tier"];
};

const isoNow = () => new Date().toISOString();

export const createRule = (seed: RuleSeed, setupMode: SetupMode): Rule => {
  const modeDefaults = SETUP_MODES[setupMode];
  const now = isoNow();
  const domainPattern = normalizeDomainPattern(seed.domainPattern);
  return {
    id: crypto.randomUUID(),
    label: seed.label?.trim() || createLabelFromDomain(domainPattern),
    domainPattern,
    pathPattern: seed.pathPattern?.trim() || undefined,
    mode: modeDefaults.mode,
    delaySeconds: modeDefaults.delaySeconds,
    promptEnabled: modeDefaults.promptEnabled,
    promptText: modeDefaults.promptText || undefined,
    enabled: true,
    allowlistPatterns: [],
    schedule: [],
    dailyMinuteBudget: modeDefaults.dailyMinuteBudget,
    dailySessionLimit: undefined,
    cooldownMinutes: modeDefaults.cooldownMinutes,
    tier: seed.tier ?? "free",
    createdAt: now,
    updatedAt: now,
  };
};

export const updateRuleWithPatch = (rule: Rule, patch: Partial<Rule>) =>
  ruleSchema.parse({
    ...rule,
    ...patch,
    domainPattern: patch.domainPattern ? normalizeDomainPattern(patch.domainPattern) : rule.domainPattern,
    updatedAt: isoNow(),
  });

export const exportSettingsJson = (state: ExtensionState) => JSON.stringify(state, null, 2);

export const importSettingsJson = (raw: string) => extensionStateSchema.safeParse(JSON.parse(raw));
