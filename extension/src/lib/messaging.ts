import type { Rule } from "./schema";

export type GateEvaluateRequest = {
  type: "gate:evaluate";
  url: string;
};

export type GateOutcomeRequest = {
  type: "gate:outcome";
  url: string;
  ruleId: string;
  outcome: "abandoned" | "proceeded";
};

export type GatePassRequest = {
  type: "gate:pass";
  url: string;
  ruleId: string;
  durationMinutes?: number;
  untilSessionEnd?: boolean;
};

export type ActivityRequest = {
  type: "activity:update";
  domain: string;
  visible: boolean;
  timestamp: number;
};

export type LeaveSiteRequest = {
  type: "tab:leave";
};

export type RuntimeRequest =
  | GateEvaluateRequest
  | GateOutcomeRequest
  | GatePassRequest
  | ActivityRequest
  | LeaveSiteRequest;

export type GateDecision =
  | {
      action: "allow";
      trackDomain?: string;
    }
  | {
      action: "delay";
      rule: Rule;
      allowTemporaryPass: boolean;
      remainingBudgetMinutes?: number;
      remainingSessions?: number;
      cooldownUntil?: string;
    }
  | {
      action: "block";
      reason: "hard_block" | "budget" | "session_cap" | "cooldown";
      rule: Rule;
      message: string;
      allowTemporaryPass: boolean;
      remainingBudgetMinutes?: number;
      remainingSessions?: number;
      cooldownUntil?: string;
    };
