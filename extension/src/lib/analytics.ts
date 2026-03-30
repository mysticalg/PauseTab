import { getDateKey } from "./clock";
import type { DailyStats, ExtensionState } from "./schema";

export type WeeklySummary = {
  intercepted: number;
  avoided: number;
  proceeded: number;
  overrides: number;
  estimatedMinutesSaved: number;
  topSites: Array<{
    domain: string;
    avoided: number;
    proceeded: number;
    minutesSpent: number;
  }>;
};

const blankDailyStats = (date: string): DailyStats => ({
  date,
  interceptedOpens: 0,
  avoidedOpens: 0,
  proceededOpens: 0,
  overridesUsed: 0,
  estimatedMinutesSaved: 0,
  byDomain: {},
});

export const getDailyStats = (state: ExtensionState, date = getDateKey()) =>
  state.statsByDate[date] ?? blankDailyStats(date);

export const getProtectedSiteCount = (state: ExtensionState) => state.rules.filter((rule) => rule.enabled).length;

export const getRemainingBudgetByDomain = (state: ExtensionState, date = getDateKey()) =>
  state.rules
    .filter((rule) => rule.dailyMinuteBudget && rule.enabled)
    .map((rule) => {
      const domainStats = getDailyStats(state, date).byDomain[rule.domainPattern];
      const spent = domainStats?.minutesSpent ?? 0;
      const remainingMinutes = Math.max(0, Math.ceil((rule.dailyMinuteBudget ?? 0) - spent));
      return {
        domain: rule.domainPattern,
        label: rule.label,
        remainingMinutes,
      };
    });

export const buildWeeklySummary = (state: ExtensionState, today = new Date()): WeeklySummary => {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    return getDateKey(date);
  });

  const summary = days.reduce<WeeklySummary>(
    (accumulator, dateKey) => {
      const stats = getDailyStats(state, dateKey);
      accumulator.intercepted += stats.interceptedOpens;
      accumulator.avoided += stats.avoidedOpens;
      accumulator.proceeded += stats.proceededOpens;
      accumulator.overrides += stats.overridesUsed;
      accumulator.estimatedMinutesSaved += stats.estimatedMinutesSaved;

      Object.entries(stats.byDomain).forEach(([domain, domainStats]) => {
        const existing = accumulator.topSites.find((item) => item.domain === domain);
        if (existing) {
          existing.avoided += domainStats.avoidedOpens;
          existing.proceeded += domainStats.proceededOpens;
          existing.minutesSpent += domainStats.minutesSpent;
          return;
        }

        accumulator.topSites.push({
          domain,
          avoided: domainStats.avoidedOpens,
          proceeded: domainStats.proceededOpens,
          minutesSpent: domainStats.minutesSpent,
        });
      });

      return accumulator;
    },
    {
      intercepted: 0,
      avoided: 0,
      proceeded: 0,
      overrides: 0,
      estimatedMinutesSaved: 0,
      topSites: [],
    },
  );

  summary.topSites.sort((left, right) => right.avoided - left.avoided || right.minutesSpent - left.minutesSpent);
  summary.topSites = summary.topSites.slice(0, 5);
  return summary;
};
