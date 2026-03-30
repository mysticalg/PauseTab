import { LOCAL_TRIAL_ENABLED } from "../../lib/api";
import { hasFeature } from "../../lib/licensing";
import { updateState } from "../../lib/storage";
import type { ExtensionState } from "../../lib/schema";

type PrivacyPageProps = {
  state: ExtensionState;
  refresh: () => Promise<void>;
};

export const PrivacyPage = ({ state, refresh }: PrivacyPageProps) => {
  const updatePreferences = async (patch: Partial<ExtensionState["preferences"]>) => {
    await updateState((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        ...patch,
      },
    }));
    await refresh();
  };

  return (
    <section className="section stack">
      <div>
        <h2 className="sectionHeading">Privacy and appearance</h2>
        <p className="sectionCopy">PauseTab is local-first. It stores rules, counters, budgets, and passes locally by default and never reads page text.</p>
      </div>
      <div className="row">
        <div className="rowLabel">
          <p className="rowTitle">Theme</p>
          <p className="rowMeta">Choose the popup and options appearance.</p>
        </div>
        <select value={state.preferences.theme} onChange={(event) => void updatePreferences({ theme: event.target.value as ExtensionState["preferences"]["theme"] })}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div className="row">
        <div className="rowLabel">
          <p className="rowTitle">Reduced motion</p>
          <p className="rowMeta">Tone down motion inside the extension UI.</p>
        </div>
        <input type="checkbox" checked={state.preferences.reducedMotion} onChange={(event) => void updatePreferences({ reducedMotion: event.target.checked })} />
      </div>
      <div className="row">
        <div className="rowLabel">
          <p className="rowTitle">Weekly summaries</p>
          <p className="rowMeta">Enable local weekly summary surfaces in the options page.</p>
        </div>
        <input
          type="checkbox"
          checked={state.preferences.weeklySummaryEnabled}
          onChange={(event) => void updatePreferences({ weeklySummaryEnabled: event.target.checked })}
        />
      </div>
      <div className="row">
        <div className="rowLabel">
          <p className="rowTitle">Local analytics</p>
          <p className="rowMeta">Keep local counters for avoided opens, proceeds, overrides, and time estimates.</p>
        </div>
        <input
          type="checkbox"
          checked={state.preferences.localAnalyticsEnabled}
          onChange={(event) => void updatePreferences({ localAnalyticsEnabled: event.target.checked })}
        />
      </div>
      <div className="row">
        <div className="rowLabel">
          <p className="rowTitle">Sync settings</p>
          <p className="rowMeta">Mirrors rules and preferences into Chrome sync storage when {LOCAL_TRIAL_ENABLED ? "Pro or trial" : "Pro"} is active.</p>
        </div>
        <input
          type="checkbox"
          disabled={!hasFeature(state.license, "sync")}
          checked={state.preferences.syncEnabled}
          onChange={(event) => void updatePreferences({ syncEnabled: event.target.checked })}
        />
      </div>
    </section>
  );
};
