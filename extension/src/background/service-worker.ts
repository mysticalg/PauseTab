import type { RuntimeRequest } from "../lib/messaging";
import { hasFeature } from "../lib/licensing";
import { getState, setState, updateState } from "../lib/storage";
import type { Rule } from "../lib/schema";
import { addTemporaryPass, applyUsageHeartbeat, clearSessionPasses, evaluateIntervention, getMatchingRule, pruneState, recordGateOutcome, recordInterception } from "./rule-engine";

const CLEANUP_ALARM = "pausetab-cleanup";

type ActiveSession = {
  domain: string;
  lastHeartbeatAt: number;
};

const activeSessions = new Map<number, ActiveSession>();

const findRule = (rules: Rule[], ruleId: string) => rules.find((rule) => rule.id === ruleId);

const cleanupAndPersist = async () => {
  const state = await getState();
  const nextState = pruneState(state);
  await setState(nextState);
};

const handleGateEvaluate = async (url: string) => {
  const state = pruneState(await getState());
  const decision = evaluateIntervention(state, url);

  if (decision.action === "delay" || decision.action === "block") {
    await setState(recordInterception(state, decision.rule));
  }

  return decision;
};

const handleGateOutcome = async (request: Extract<RuntimeRequest, { type: "gate:outcome" }>) => {
  const state = pruneState(await getState());
  const rule = findRule(state.rules, request.ruleId) ?? getMatchingRule(state, request.url);
  if (!rule) {
    return { ok: false };
  }

  const nextState = recordGateOutcome(state, rule, request.outcome === "abandoned" ? "abandoned" : "proceeded");
  await setState(nextState);
  return { ok: true };
};

const handleTemporaryPass = async (request: Extract<RuntimeRequest, { type: "gate:pass" }>) => {
  const state = pruneState(await getState());
  const rule = findRule(state.rules, request.ruleId) ?? getMatchingRule(state, request.url);
  if (!rule || !hasFeature(state.license, "temporary_passes")) {
    return { ok: false };
  }

  const withOutcome = recordGateOutcome(state, rule, "override");
  const withPass = addTemporaryPass(withOutcome, rule.domainPattern, request.durationMinutes, request.untilSessionEnd);
  await setState(withPass);
  return { ok: true };
};

const handleActivityUpdate = async (tabId: number, request: Extract<RuntimeRequest, { type: "activity:update" }>) => {
  const existing = activeSessions.get(tabId);

  if (!request.visible) {
    activeSessions.delete(tabId);
    return { ok: true };
  }

  if (!existing || existing.domain !== request.domain) {
    activeSessions.set(tabId, {
      domain: request.domain,
      lastHeartbeatAt: request.timestamp,
    });
    return { ok: true };
  }

  const elapsedMs = request.timestamp - existing.lastHeartbeatAt;
  activeSessions.set(tabId, {
    domain: request.domain,
    lastHeartbeatAt: request.timestamp,
  });

  if (elapsedMs <= 0) {
    return { ok: true };
  }

  const state = await getState();
  await setState(applyUsageHeartbeat(state, request.domain, elapsedMs));
  return { ok: true };
};

chrome.runtime.onInstalled.addListener(async (details) => {
  const state = pruneState(await getState());
  await setState(state);
  chrome.alarms.create(CLEANUP_ALARM, { periodInMinutes: 15 });
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  await setState(pruneState(clearSessionPasses(state)));
  chrome.alarms.create(CLEANUP_ALARM, { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== CLEANUP_ALARM) {
    return;
  }

  await cleanupAndPersist();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeSessions.delete(tabId);
});

chrome.runtime.onMessage.addListener((request: RuntimeRequest, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  const handler = async () => {
    switch (request.type) {
      case "gate:evaluate":
        return handleGateEvaluate(request.url);
      case "gate:outcome":
        return handleGateOutcome(request);
      case "gate:pass":
        return handleTemporaryPass(request);
      case "activity:update":
        if (typeof tabId !== "number") {
          return { ok: false };
        }
        return handleActivityUpdate(tabId, request);
      case "tab:leave":
        if (typeof tabId === "number") {
          await chrome.tabs.remove(tabId);
        }
        return { ok: true };
      default:
        return { ok: false };
    }
  };

  void handler()
    .then((response) => sendResponse(response))
    .catch((error) => {
      console.error("PauseTab runtime error", error);
      sendResponse({ ok: false });
    });

  return true;
});
