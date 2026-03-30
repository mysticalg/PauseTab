import { hasFeature, startLocalTrial } from "../../lib/licensing";
import { updateState } from "../../lib/storage";
import type { ExtensionState } from "../../lib/schema";

type BillingPageProps = {
  state: ExtensionState;
  refresh: () => Promise<void>;
};

const PRO_FEATURES = [
  "Unlimited rules",
  "Schedules",
  "Daily minute budgets",
  "Daily session caps",
  "Temporary passes",
  "Cooldown lockouts",
  "Weekly summaries",
  "Cross-device sync",
];

export const BillingPage = ({ state, refresh }: BillingPageProps) => {
  const startTrialNow = async () => {
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
    <section className="section stack">
      <div>
        <h2 className="sectionHeading">Plan and license</h2>
        <p className="sectionCopy">This build includes a local trial flow so Pro-only controls can be verified before a real checkout backend is attached.</p>
      </div>
      <div className="metric-grid">
        <div className="rule-row">
          <span className="eyebrow">Current plan</span>
          <div className="metricValue" style={{ marginTop: 12 }}>{state.license.status.toUpperCase()}</div>
          <p className="sectionCopy">{state.license.expiresAt ? `Expires ${new Date(state.license.expiresAt).toLocaleString()}` : "No expiration set."}</p>
        </div>
        <div className="rule-row">
          <span className="eyebrow">Sync</span>
          <div className="metricValue" style={{ marginTop: 12 }}>{hasFeature(state.license, "sync") ? "On" : "Locked"}</div>
          <p className="sectionCopy">Settings sync uses Chrome sync storage in this build.</p>
        </div>
      </div>
      <div className="button-row">
        {state.license.status === "free" ? (
          <button className="button" onClick={() => void startTrialNow()}>
            Start local 7-day trial
          </button>
        ) : null}
        <button className="button" data-variant="ghost" onClick={() => void chrome.tabs.create({ url: "https://pausetab.app" })}>
          Open upgrade website
        </button>
      </div>
      <div>
        <h3 className="sectionHeading">Pro features</h3>
        <div className="tag-list">
          {PRO_FEATURES.map((feature) => (
            <span className="tag" key={feature}>
              {feature}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
