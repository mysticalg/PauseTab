import { startTransition, useEffect, useState } from "react";

import { getDailyStats, getProtectedSiteCount, getRemainingBudgetByDomain } from "../lib/analytics";
import { LOCAL_TRIAL_ENABLED } from "../lib/api";
import { minutesUntilTomorrow } from "../lib/clock";
import { domainMatchesPattern, getHostnameFromUrl } from "../lib/domains";
import { canCreateAnotherRule, getFreeTierUpgradeMessage, startLocalTrial } from "../lib/licensing";
import { createRule } from "../lib/rules";
import { getState, updateState } from "../lib/storage";
import type { ExtensionState } from "../lib/schema";
import { QuickActions } from "./components/QuickActions";
import { StatsCard } from "./components/StatsCard";
import { UpgradeCard } from "./components/UpgradeCard";

const loadActiveUrl = async () => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab?.url;
};

const PopupApp = ({ state, activeUrl, refresh }: { state: ExtensionState; activeUrl?: string; refresh: () => Promise<void> }) => {
  const today = getDailyStats(state);
  const budgets = getRemainingBudgetByDomain(state).slice(0, 3);
  const activeDomain = activeUrl ? getHostnameFromUrl(activeUrl) : "";
  const existingRule = state.rules.find((rule) => activeDomain && domainMatchesPattern(activeDomain, rule.domainPattern));
  const pausedUntil = state.globalPauseUntil;
  const canStartTrial = LOCAL_TRIAL_ENABLED && state.license.status === "free" && !state.license.trialStartedAt;

  const pauseProtections = async (minutes: number | "tomorrow") => {
    await updateState((current) => ({
      ...current,
      globalPauseUntil:
        minutes === "tomorrow"
          ? new Date(Date.now() + minutesUntilTomorrow() * 60 * 1000).toISOString()
          : new Date(Date.now() + minutes * 60 * 1000).toISOString(),
    }));
    await refresh();
  };

  const clearPause = async () => {
    await updateState((current) => ({
      ...current,
      globalPauseUntil: undefined,
    }));
    await refresh();
  };

  const quickAddRule = async () => {
    if (!activeDomain || existingRule) {
      await chrome.runtime.openOptionsPage();
      return;
    }

    if (!canCreateAnotherRule(state)) {
      window.alert(getFreeTierUpgradeMessage());
      await chrome.runtime.openOptionsPage();
      return;
    }

    await updateState((current) => {
      const nextRule = createRule(
        {
          domainPattern: activeDomain,
          label: activeDomain,
          tier: "free",
        },
        current.preferences.defaultMode,
      );

      return {
        ...current,
        rules: [...current.rules, nextRule],
        onboarding: {
          ...current.onboarding,
          completed: true,
        },
      };
    });
    await refresh();
  };

  const startTrial = async () => {
    await updateState((current) => ({
      ...current,
      license: startLocalTrial(current.license),
      preferences: {
        ...current.preferences,
        syncEnabled: true,
      },
    }));
    await refresh();
  };

  return (
    <main className="popup-shell app-shell">
      <div className="popup-panel app-panel">
        <header className="popup-header app-header">
          <div className="app-headerBlock">
            <p className="eyebrow">PauseTab</p>
            <h1 className="title">Pause before distractions.</h1>
            <p className="subtitle">See today's saves, protect the current site, or pause protections for a deliberate window.</p>
          </div>
          <span className="pill" data-variant={pausedUntil ? "accent" : "success"}>
            {pausedUntil ? "Paused" : "Active"}
          </span>
        </header>

        <section className="popup-section section">
          <h2 className="sectionHeading">Today</h2>
          <div className="popup-miniGrid">
            <StatsCard label="Avoided opens" value={today.avoidedOpens} />
            <StatsCard label="Proceeded opens" value={today.proceededOpens} />
            <StatsCard label="Protected sites" value={getProtectedSiteCount(state)} />
          </div>
        </section>

        <section className="popup-section section">
          <div className="row">
            <div className="rowLabel">
              <p className="rowTitle">{activeDomain ? activeDomain : "No active webpage"}</p>
              <p className="rowMeta">
                {existingRule
                  ? "Already protected. Open options to tune delay, budget, and schedule rules."
                  : "Add the current site with your default focus mode."}
              </p>
            </div>
            <button className="button" onClick={() => void quickAddRule()} disabled={!activeDomain}>
              {existingRule ? "Manage" : "Protect site"}
            </button>
          </div>
          {budgets.length > 0 ? (
            <>
              <h3 className="sectionHeading" style={{ marginTop: 24 }}>Budgets</h3>
              {budgets.map((budget) => (
                <div className="row" key={budget.domain}>
                  <div className="rowLabel">
                    <p className="rowTitle">{budget.label}</p>
                    <p className="rowMeta">{budget.domain}</p>
                  </div>
                  <span className="pill">{budget.remainingMinutes}m left</span>
                </div>
              ))}
            </>
          ) : null}
        </section>

        <QuickActions pausedUntil={pausedUntil} onPause={(value) => void pauseProtections(value)} onClearPause={() => void clearPause()} />

        {state.license.status === "free" ? (
          <UpgradeCard onStartTrial={() => void startTrial()} onOpenOptions={() => void chrome.runtime.openOptionsPage()} canStartTrial={canStartTrial} />
        ) : null}

        <section className="popup-section section">
          <button className="popup-linkButton" onClick={() => void chrome.runtime.openOptionsPage()}>
            Open full settings
          </button>
        </section>
      </div>
    </main>
  );
};

export const App = () => {
  const [state, setState] = useState<ExtensionState | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | undefined>();

  const refresh = async () => {
    const [nextState, nextUrl] = await Promise.all([getState(), loadActiveUrl()]);
    startTransition(() => {
      setState(nextState);
      setActiveUrl(nextUrl);
    });
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (!state) {
    return null;
  }

  return <PopupApp state={state} activeUrl={activeUrl} refresh={refresh} />;
};
