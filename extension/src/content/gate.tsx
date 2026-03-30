import { startTransition, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import "../content/styles/gate.css";
import { formatDurationLabel } from "../lib/clock";
import type { GateDecision, RuntimeRequest } from "../lib/messaging";
import { getHostnameFromUrl } from "../lib/domains";

const ROOT_ID = "pausetab-root";
const PASS_OPTIONS: Array<{ label: string; durationMinutes?: number; untilSessionEnd?: boolean }> = [
  { label: "10m pass", durationMinutes: 10 },
  { label: "30m pass", durationMinutes: 30 },
  { label: "1h pass", durationMinutes: 60 },
  { label: "Until restart", untilSessionEnd: true },
];

const isTopFrame = window.top === window;

const sendRuntimeMessage = async <T,>(message: RuntimeRequest) => chrome.runtime.sendMessage(message) as Promise<T>;

const setPageLocked = (locked: boolean) => {
  document.documentElement.style.overflow = locked ? "hidden" : "";
  if (document.body) {
    document.body.style.overflow = locked ? "hidden" : "";
  }
};

const removeRoot = () => {
  document.getElementById(ROOT_ID)?.remove();
};

const startPresenceLoop = (domain: string) => {
  if (!domain) {
    return;
  }

  let intervalId: number | undefined;

  const sendPresence = (visible: boolean) =>
    sendRuntimeMessage({
      type: "activity:update",
      domain,
      visible,
      timestamp: Date.now(),
    }).catch(() => undefined);

  const start = () => {
    void sendPresence(true);
    intervalId = window.setInterval(() => {
      void sendPresence(document.visibilityState === "visible");
    }, 15000);
  };

  const stop = () => {
    if (typeof intervalId === "number") {
      window.clearInterval(intervalId);
    }
    void sendPresence(false);
  };

  if (document.visibilityState === "visible") {
    start();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (typeof intervalId !== "number") {
        start();
      }
      return;
    }

    stop();
    intervalId = undefined;
  });

  window.addEventListener("pagehide", stop, { once: true });
};

type GateProps = {
  decision: Exclude<GateDecision, { action: "allow" }>;
};

const GateApp = ({ decision }: GateProps) => {
  const [secondsLeft, setSecondsLeft] = useState(decision.action === "delay" ? decision.rule.delaySeconds : 0);
  const [promptValue, setPromptValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (decision.action !== "delay") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [decision.action]);

  const promptRequired = decision.rule.promptEnabled;
  const promptValid = !promptRequired || promptValue.trim().length >= 3;
  const canContinue = decision.action === "delay" && secondsLeft <= 0 && promptValid && !busy;

  const meta = useMemo(
    () =>
      [
        decision.remainingBudgetMinutes !== undefined
          ? ["Time left today", formatDurationLabel(decision.remainingBudgetMinutes)]
          : null,
        decision.remainingSessions !== undefined ? ["Sessions left today", String(decision.remainingSessions)] : null,
        decision.cooldownUntil ? ["Cooldown ends", new Date(decision.cooldownUntil).toLocaleTimeString()] : null,
      ].filter(Boolean) as Array<[string, string]>,
    [decision.cooldownUntil, decision.remainingBudgetMinutes, decision.remainingSessions],
  );

  const unlock = () => {
    setPageLocked(false);
    removeRoot();
    startPresenceLoop(getHostnameFromUrl(window.location.href));
  };

  const handleOutcome = async (outcome: "abandoned" | "proceeded") => {
    setBusy(true);
    await sendRuntimeMessage({
      type: "gate:outcome",
      url: window.location.href,
      ruleId: decision.rule.id,
      outcome,
    });

    if (outcome === "abandoned") {
      await sendRuntimeMessage({ type: "tab:leave" });
      return;
    }

    startTransition(() => {
      setDismissed(true);
    });
    unlock();
  };

  const handlePass = async (durationMinutes?: number, untilSessionEnd?: boolean) => {
    setBusy(true);
    const response = await sendRuntimeMessage<{ ok: boolean }>({
      type: "gate:pass",
      url: window.location.href,
      ruleId: decision.rule.id,
      durationMinutes,
      untilSessionEnd,
    });

    if (!response.ok) {
      setBusy(false);
      return;
    }

    startTransition(() => {
      setDismissed(true);
    });
    unlock();
  };

  if (dismissed) {
    return null;
  }

  return (
    <div className="pt-root" role="presentation">
      <div className="pt-shell">
        <section className="pt-panel" aria-live="polite" aria-label="PauseTab intervention">
          <div className="pt-badge">PauseTab</div>
          <h1 className="pt-title">
            {decision.action === "delay" ? `Take ${decision.rule.delaySeconds} seconds before opening ${decision.rule.label}.` : `Pause before ${decision.rule.label}.`}
          </h1>
          <p className="pt-copy">
            {decision.action === "delay"
              ? decision.rule.promptText || "A short delay makes impulsive opens easier to catch."
              : decision.message}
          </p>
          <div className="pt-timerRow">
            <div>
              <div className="pt-timer">{decision.action === "delay" ? secondsLeft : "--"}</div>
              <p className="pt-timerLabel">{decision.action === "delay" ? "Seconds until continue unlocks" : "Blocked for now"}</p>
            </div>
            {decision.action === "block" ? <span className="pt-warning">{decision.reason.replace("_", " ")}</span> : null}
          </div>
          {meta.length > 0 ? (
            <div className="pt-metaList">
              {meta.map(([label, value]) => (
                <div className="pt-meta" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          ) : null}
          {promptRequired ? (
            <div className="pt-inputWrap">
              <label className="pt-label" htmlFor="pausetab-reason">
                What are you here to do?
              </label>
              <textarea
                id="pausetab-reason"
                className="pt-textarea"
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                placeholder="Be specific. The point is to make the visit intentional."
              />
            </div>
          ) : null}
          <div className="pt-actions">
            <button className="pt-button pt-buttonSecondary" onClick={() => void handleOutcome("abandoned")} disabled={busy}>
              Leave site
            </button>
            {decision.action === "delay" ? (
              <button className="pt-button" onClick={() => void handleOutcome("proceeded")} disabled={!canContinue}>
                Continue
              </button>
            ) : null}
          </div>
          {decision.allowTemporaryPass ? (
            <div className="pt-passRow" aria-label="Temporary pass options">
              {PASS_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  className="pt-passButton"
                  onClick={() => void handlePass(option.durationMinutes, option.untilSessionEnd)}
                  disabled={busy || (promptRequired && !promptValid)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="pt-footer">
            <span>Calm friction. No browsing history is stored.</span>
            <span>{decision.action === "delay" ? "You can still continue after the timer." : "Temporary passes are optional Pro controls."}</span>
          </div>
        </section>
      </div>
    </div>
  );
};

const mountGate = (decision: Exclude<GateDecision, { action: "allow" }>) => {
  if (document.getElementById(ROOT_ID)) {
    return;
  }

  const root = document.createElement("div");
  root.id = ROOT_ID;
  (document.documentElement || document.body).append(root);
  setPageLocked(true);
  createRoot(root).render(<GateApp decision={decision} />);
};

const run = async () => {
  if (!isTopFrame || window.location.protocol.startsWith("chrome")) {
    return;
  }

  const decision = await sendRuntimeMessage<GateDecision>({
    type: "gate:evaluate",
    url: window.location.href,
  });

  if (decision.action === "allow") {
    if (decision.trackDomain) {
      startPresenceLoop(decision.trackDomain);
    }
    return;
  }

  mountGate(decision);
};

void run();
