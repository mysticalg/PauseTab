import { describe, expect, it } from "vitest";

import { evaluateIntervention, recordGateOutcome } from "./rule-engine";
import type { ExtensionState, Rule } from "../lib/schema";

const baseRule = (overrides: Partial<Rule> = {}): Rule => ({
  id: "rule-1",
  label: "YouTube",
  domainPattern: "youtube.com",
  mode: "delay",
  delaySeconds: 10,
  promptEnabled: true,
  enabled: true,
  allowlistPatterns: [],
  schedule: [],
  tier: "free",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const baseState = (rule: Rule): ExtensionState => ({
  version: 1,
  rules: [rule],
  statsByDate: {},
  passes: [],
  cooldowns: [],
  preferences: {
    theme: "system",
    reducedMotion: false,
    weeklySummaryEnabled: true,
    weeklySummaryDay: "sun",
    defaultMode: "balanced",
    localAnalyticsEnabled: true,
    syncEnabled: false,
  },
  onboarding: {
    completed: false,
    selectedPresets: [],
  },
  license: {
    status: "free",
    syncEnabled: false,
  },
  updatedAt: new Date().toISOString(),
});

describe("evaluateIntervention", () => {
  it("returns a delay decision for a matching domain", () => {
    const state = baseState(baseRule());
    const decision = evaluateIntervention(state, "https://www.youtube.com/");
    expect(decision.action).toBe("delay");
  });

  it("blocks when the daily budget is exhausted", () => {
    const rule = baseRule({
      mode: "budget",
      dailyMinuteBudget: 5,
      tier: "pro",
    });
    const state = baseState(rule);
    const budgeted = recordGateOutcome(state, rule, "proceeded");
    budgeted.statsByDate[new Date().toISOString().slice(0, 10)]!.byDomain["youtube.com"]!.minutesSpent = 6;
    const decision = evaluateIntervention(budgeted, "https://www.youtube.com/");
    expect(decision.action).toBe("block");
    if (decision.action === "block") {
      expect(decision.reason).toBe("budget");
    }
  });

  it("allows when an allowlist pattern matches", () => {
    const state = baseState(
      baseRule({
        allowlistPatterns: ["https://www.youtube.com/watch*"],
      }),
    );
    const decision = evaluateIntervention(state, "https://www.youtube.com/watch?v=test");
    expect(decision.action).toBe("allow");
  });
});
