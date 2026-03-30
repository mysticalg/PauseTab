import { startTransition, useEffect, useState } from "react";

import { getProtectedSiteCount } from "../lib/analytics";
import { getState } from "../lib/storage";
import type { ExtensionState } from "../lib/schema";
import { BillingPage } from "./pages/BillingPage";
import { PresetsPage } from "./pages/PresetsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { RulesPage } from "./pages/RulesPage";
import { SummaryPage } from "./pages/SummaryPage";

type SectionKey = "rules" | "presets" | "summary" | "privacy" | "billing";

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: "rules", label: "Rules" },
  { key: "presets", label: "Presets" },
  { key: "summary", label: "Weekly summary" },
  { key: "privacy", label: "Privacy" },
  { key: "billing", label: "Plan" },
];

const renderSection = (section: SectionKey, state: ExtensionState, refresh: () => Promise<void>) => {
  switch (section) {
    case "rules":
      return <RulesPage state={state} refresh={refresh} />;
    case "presets":
      return <PresetsPage state={state} refresh={refresh} />;
    case "summary":
      return <SummaryPage state={state} />;
    case "privacy":
      return <PrivacyPage state={state} refresh={refresh} />;
    case "billing":
      return <BillingPage state={state} refresh={refresh} />;
    default:
      return null;
  }
};

export const App = () => {
  const [state, setState] = useState<ExtensionState | null>(null);
  const [section, setSection] = useState<SectionKey>("rules");

  const refresh = async () => {
    const nextState = await getState();
    startTransition(() => {
      setState(nextState);
    });
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (!state) {
    return null;
  }

  return (
    <main className="options-shell app-shell">
      <div className="options-app app-panel">
        <header className="app-header">
          <div className="app-headerBlock">
            <p className="eyebrow">PauseTab settings</p>
            <h1 className="title">Calm friction, tuned to your rules.</h1>
            <p className="subtitle">Configure site delays, budgets, schedules, temporary passes, privacy preferences, and the local Pro trial flow.</p>
          </div>
          <div className="options-actions">
            <span className="pill">{getProtectedSiteCount(state)} sites</span>
            <span className="pill" data-variant={state.license.status === "free" ? "accent" : "success"}>
              {state.license.status.toUpperCase()}
            </span>
          </div>
        </header>
        <div className="split">
          <nav className="side-nav">
            <p className="eyebrow">Sections</p>
            {SECTIONS.map((item) => (
              <button
                key={item.key}
                className="button"
                data-variant={section === item.key ? undefined : "ghost"}
                onClick={() => setSection(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="content-area">{renderSection(section, state, refresh)}</div>
        </div>
      </div>
    </main>
  );
};
