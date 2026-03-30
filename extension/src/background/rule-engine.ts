import { ESTIMATED_MINUTES_PER_AVOID, HEARTBEAT_INTERVAL_MS } from "../lib/constants";
import { getDateKey, isExpired, isScheduleActive, nowIso } from "../lib/clock";
import { allowlistMatches, getHostnameFromUrl, ruleMatchesUrl } from "../lib/domains";
import { hasFeature, normalizeLicenseState } from "../lib/licensing";
import type { GateDecision } from "../lib/messaging";
import type { CooldownState, DailyStats, DomainStats, ExtensionState, Rule, TemporaryPass } from "../lib/schema";

const blankDomainStats = (): DomainStats => ({
  interceptedOpens: 0,
  avoidedOpens: 0,
  proceededOpens: 0,
  overridesUsed: 0,
  estimatedMinutesSaved: 0,
  minutesSpent: 0,
  sessionCount: 0,
});

const blankDailyStats = (date: string): DailyStats => ({
  date,
  interceptedOpens: 0,
  avoidedOpens: 0,
  proceededOpens: 0,
  overridesUsed: 0,
  estimatedMinutesSaved: 0,
  byDomain: {},
});

const ensureDailyDomainStats = (state: ExtensionState, domain: string, date = getDateKey()) => {
  const daily = state.statsByDate[date] ?? blankDailyStats(date);
  const domainStats = daily.byDomain[domain] ?? blankDomainStats();
  return { daily, domainStats };
};

const sortBySpecificity = (rules: Rule[]) =>
  [...rules].sort((left, right) => {
    const leftScore = left.domainPattern.length * 10 + (left.pathPattern?.length ?? 0);
    const rightScore = right.domainPattern.length * 10 + (right.pathPattern?.length ?? 0);
    return rightScore - leftScore;
  });

const cleanupPasses = (passes: TemporaryPass[]) =>
  passes.filter((pass) => pass.expiresOnSessionEnd || !isExpired(pass.expiresAt));

const cleanupCooldowns = (cooldowns: CooldownState[]) => cooldowns.filter((cooldown) => !isExpired(cooldown.until));

export const pruneState = (state: ExtensionState): ExtensionState => ({
  ...state,
  license: normalizeLicenseState(state.license),
  passes: cleanupPasses(state.passes),
  cooldowns: cleanupCooldowns(state.cooldowns),
});

const hasValidPass = (state: ExtensionState, domain: string) =>
  state.passes.some((pass) => pass.domainPattern === domain && (pass.expiresOnSessionEnd || !isExpired(pass.expiresAt)));

const getActiveCooldown = (state: ExtensionState, domain: string) =>
  state.cooldowns.find((cooldown) => cooldown.domainPattern === domain && !isExpired(cooldown.until));

export const getMatchingRule = (state: ExtensionState, url: string) =>
  sortBySpecificity(state.rules.filter((rule) => rule.enabled && ruleMatchesUrl(rule, url)))[0];

export const evaluateIntervention = (rawState: ExtensionState, url: string, now = new Date()): GateDecision => {
  const state = pruneState(rawState);
  const domain = getHostnameFromUrl(url);

  if (!domain) {
    return { action: "allow" };
  }

  if (state.globalPauseUntil && !isExpired(state.globalPauseUntil, now)) {
    return { action: "allow" };
  }

  const rule = getMatchingRule(state, url);
  if (!rule) {
    return { action: "allow" };
  }

  if (hasValidPass(state, rule.domainPattern)) {
    return { action: "allow", trackDomain: rule.domainPattern };
  }

  const parsedUrl = new URL(url);
  if (allowlistMatches(parsedUrl, rule)) {
    return { action: "allow" };
  }

  if (!isScheduleActive(rule.schedule, now)) {
    return { action: "allow" };
  }

  const { domainStats } = ensureDailyDomainStats(state, rule.domainPattern);
  const activeCooldown = getActiveCooldown(state, rule.domainPattern);
  const remainingBudgetMinutes = rule.dailyMinuteBudget
    ? Math.max(0, Math.ceil(rule.dailyMinuteBudget - domainStats.minutesSpent))
    : undefined;
  const remainingSessions = rule.dailySessionLimit
    ? Math.max(0, rule.dailySessionLimit - domainStats.sessionCount)
    : undefined;

  if (activeCooldown) {
    return {
      action: "block",
      reason: "cooldown",
      rule,
      message: `You recently overrode ${rule.label}. Wait until the cooldown ends to reopen it.`,
      allowTemporaryPass: hasFeature(state.license, "temporary_passes"),
      cooldownUntil: activeCooldown.until,
      remainingBudgetMinutes,
      remainingSessions,
    };
  }

  if (rule.mode === "hard_block") {
    return {
      action: "block",
      reason: "hard_block",
      rule,
      message: `${rule.label} is hard blocked right now.`,
      allowTemporaryPass: hasFeature(state.license, "temporary_passes"),
      remainingBudgetMinutes,
      remainingSessions,
    };
  }

  if (rule.dailyMinuteBudget && domainStats.minutesSpent >= rule.dailyMinuteBudget) {
    return {
      action: "block",
      reason: "budget",
      rule,
      message: `You have already used your ${rule.label} budget today.`,
      allowTemporaryPass: hasFeature(state.license, "temporary_passes"),
      remainingBudgetMinutes,
      remainingSessions,
    };
  }

  if (rule.dailySessionLimit && domainStats.sessionCount >= rule.dailySessionLimit) {
    return {
      action: "block",
      reason: "session_cap",
      rule,
      message: `You have reached today's ${rule.label} session cap.`,
      allowTemporaryPass: hasFeature(state.license, "temporary_passes"),
      remainingBudgetMinutes,
      remainingSessions,
    };
  }

  if (rule.delaySeconds <= 0) {
    return { action: "allow", trackDomain: rule.domainPattern };
  }

  return {
    action: "delay",
    rule,
    allowTemporaryPass: hasFeature(state.license, "temporary_passes"),
    remainingBudgetMinutes,
    remainingSessions,
  };
};

export const recordInterception = (state: ExtensionState, rule: Rule, date = getDateKey()) => {
  const { daily, domainStats } = ensureDailyDomainStats(state, rule.domainPattern, date);
  const nextDaily: DailyStats = {
    ...daily,
    interceptedOpens: daily.interceptedOpens + 1,
    byDomain: {
      ...daily.byDomain,
      [rule.domainPattern]: {
        ...domainStats,
        interceptedOpens: domainStats.interceptedOpens + 1,
      },
    },
  };

  return {
    ...state,
    statsByDate: {
      ...state.statsByDate,
      [date]: nextDaily,
    },
  };
};

export const recordGateOutcome = (
  state: ExtensionState,
  rule: Rule,
  outcome: "abandoned" | "proceeded" | "override",
  date = getDateKey(),
) => {
  const { daily, domainStats } = ensureDailyDomainStats(state, rule.domainPattern, date);

  const nextDomainStats: DomainStats = {
    ...domainStats,
    avoidedOpens: domainStats.avoidedOpens + (outcome === "abandoned" ? 1 : 0),
    proceededOpens: domainStats.proceededOpens + (outcome !== "abandoned" ? 1 : 0),
    overridesUsed: domainStats.overridesUsed + (outcome === "override" ? 1 : 0),
    estimatedMinutesSaved:
      domainStats.estimatedMinutesSaved + (outcome === "abandoned" ? ESTIMATED_MINUTES_PER_AVOID : 0),
    sessionCount: domainStats.sessionCount + (outcome !== "abandoned" ? 1 : 0),
  };

  const nextDaily: DailyStats = {
    ...daily,
    avoidedOpens: daily.avoidedOpens + (outcome === "abandoned" ? 1 : 0),
    proceededOpens: daily.proceededOpens + (outcome !== "abandoned" ? 1 : 0),
    overridesUsed: daily.overridesUsed + (outcome === "override" ? 1 : 0),
    estimatedMinutesSaved: daily.estimatedMinutesSaved + (outcome === "abandoned" ? ESTIMATED_MINUTES_PER_AVOID : 0),
    byDomain: {
      ...daily.byDomain,
      [rule.domainPattern]: nextDomainStats,
    },
  };

  const cooldowns =
    outcome !== "abandoned" && rule.cooldownMinutes
      ? [
          ...cleanupCooldowns(state.cooldowns).filter((cooldown) => cooldown.domainPattern !== rule.domainPattern),
          {
            domainPattern: rule.domainPattern,
            until: new Date(Date.now() + rule.cooldownMinutes * 60 * 1000).toISOString(),
          },
        ]
      : cleanupCooldowns(state.cooldowns);

  return {
    ...state,
    cooldowns,
    statsByDate: {
      ...state.statsByDate,
      [date]: nextDaily,
    },
  };
};

export const addTemporaryPass = (
  state: ExtensionState,
  domainPattern: string,
  durationMinutes?: number,
  untilSessionEnd?: boolean,
) => {
  const pass: TemporaryPass = {
    id: crypto.randomUUID(),
    domainPattern,
    createdAt: nowIso(),
    expiresAt: untilSessionEnd ? undefined : new Date(Date.now() + (durationMinutes ?? 10) * 60 * 1000).toISOString(),
    expiresOnSessionEnd: Boolean(untilSessionEnd),
  };

  return {
    ...state,
    passes: [...cleanupPasses(state.passes).filter((item) => item.domainPattern !== domainPattern), pass],
  };
};

export const clearSessionPasses = (state: ExtensionState) => ({
  ...state,
  passes: cleanupPasses(state.passes).filter((pass) => !pass.expiresOnSessionEnd),
});

export const applyUsageHeartbeat = (
  state: ExtensionState,
  domain: string,
  elapsedMs: number,
  date = getDateKey(),
) => {
  if (elapsedMs <= 0) {
    return state;
  }

  const clamped = Math.min(elapsedMs, HEARTBEAT_INTERVAL_MS * 2);
  const minutes = clamped / 60000;
  const { daily, domainStats } = ensureDailyDomainStats(state, domain, date);
  const nextDaily: DailyStats = {
    ...daily,
    byDomain: {
      ...daily.byDomain,
      [domain]: {
        ...domainStats,
        minutesSpent: domainStats.minutesSpent + minutes,
      },
    },
  };

  return {
    ...state,
    statsByDate: {
      ...state.statsByDate,
      [date]: nextDaily,
    },
  };
};
