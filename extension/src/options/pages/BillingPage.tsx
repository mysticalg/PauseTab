import { useState } from "react";

import { hasFeature, hasRemoteLicenseCredentials, startLocalTrial } from "../../lib/licensing";
import { createPortalSessionForLicense, activateRemoteLicense, pullRemoteSyncState, pushRemoteSyncState, refreshRemoteLicense } from "../../lib/remote-license";
import { getState, updateState } from "../../lib/storage";
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
  const [activationCode, setActivationCode] = useState(state.license.activationCode ?? "");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const setBusyMessage = (message: string) => {
    setBusy(true);
    setStatusMessage(message);
  };

  const finish = async (message: string) => {
    await refresh();
    setBusy(false);
    setStatusMessage(message);
  };

  const startTrialNow = async () => {
    setBusyMessage("Starting local development trial…");
    await updateState((current) => ({
      ...current,
      license: startLocalTrial(current.license),
      preferences: {
        ...current.preferences,
        syncEnabled: true,
      },
    }));
    await finish("Local development trial started.");
  };

  const activateCode = async () => {
    if (!activationCode.trim()) {
      setStatusMessage("Paste an activation code first.");
      return;
    }

    setBusyMessage("Activating license…");
    try {
      const remoteLicense = await activateRemoteLicense(activationCode.trim());
      await updateState((current) => ({
        ...current,
        license: remoteLicense,
        preferences: {
          ...current.preferences,
          syncEnabled: remoteLicense.syncEnabled,
        },
      }));
      await finish(`Activated ${remoteLicense.plan ?? "Pro"} for ${remoteLicense.accountEmail ?? "your account"}.`);
    } catch (error) {
      setBusy(false);
      setStatusMessage(error instanceof Error ? error.message : "Activation failed.");
    }
  };

  const refreshLicenseState = async () => {
    if (!hasRemoteLicenseCredentials(state.license)) {
      setStatusMessage("Activate a paid license first.");
      return;
    }

    setBusyMessage("Refreshing license status…");
    try {
      const remoteLicense = await refreshRemoteLicense(state.license);
      await updateState((current) => ({
        ...current,
        license: remoteLicense,
      }));
      await finish("License status refreshed.");
    } catch (error) {
      setBusy(false);
      setStatusMessage(error instanceof Error ? error.message : "License refresh failed.");
    }
  };

  const pushSettings = async () => {
    if (!hasRemoteLicenseCredentials(state.license)) {
      setStatusMessage("Activate a paid license first.");
      return;
    }

    setBusyMessage("Pushing settings to cloud sync…");
    try {
      await pushRemoteSyncState(await getState());
      await finish("Settings pushed to cloud sync.");
    } catch (error) {
      setBusy(false);
      setStatusMessage(error instanceof Error ? error.message : "Sync push failed.");
    }
  };

  const pullSettings = async () => {
    if (!hasRemoteLicenseCredentials(state.license)) {
      setStatusMessage("Activate a paid license first.");
      return;
    }

    setBusyMessage("Pulling settings from cloud sync…");
    try {
      const syncedState = await pullRemoteSyncState(state.license);
      if (!syncedState) {
        await finish("No synced settings found yet.");
        return;
      }

      await updateState((current) => ({
        ...current,
        rules: syncedState.rules,
        preferences: {
          ...current.preferences,
          ...syncedState.preferences,
          syncEnabled: true,
        },
      }));
      await finish("Pulled synced settings into this browser.");
    } catch (error) {
      setBusy(false);
      setStatusMessage(error instanceof Error ? error.message : "Sync pull failed.");
    }
  };

  const openBillingPortal = async () => {
    if (!state.license.activationCode && !hasRemoteLicenseCredentials(state.license) && !activationCode.trim()) {
      setStatusMessage("Activate the account or paste the activation code first.");
      return;
    }

    setBusyMessage("Opening Stripe billing portal…");
    try {
      const url = await createPortalSessionForLicense({
        activationCode: state.license.activationCode ?? (activationCode.trim() || undefined),
        accountId: state.license.accountId,
        syncToken: state.license.syncToken,
      });
      setBusy(false);
      setStatusMessage("Opening billing portal…");
      await chrome.tabs.create({ url });
    } catch (error) {
      setBusy(false);
      setStatusMessage(error instanceof Error ? error.message : "Billing portal failed.");
    }
  };

  return (
    <section className="section stack">
      <div>
        <h2 className="sectionHeading">Plan and license</h2>
        <p className="sectionCopy">Paid plans are activated with an account code issued by the PauseTab checkout site after Stripe checkout completes.</p>
      </div>
      <div className="metric-grid">
        <div className="rule-row">
          <span className="eyebrow">Current plan</span>
          <div className="metricValue" style={{ marginTop: 12 }}>{state.license.status.toUpperCase()}</div>
          <p className="sectionCopy">
            {state.license.plan ? `Plan: ${state.license.plan}` : "No paid plan attached yet."}
            {state.license.expiresAt ? ` Expires ${new Date(state.license.expiresAt).toLocaleString()}.` : ""}
          </p>
        </div>
        <div className="rule-row">
          <span className="eyebrow">Account</span>
          <div className="metricValue" style={{ marginTop: 12 }}>{state.license.accountEmail ?? "Not activated"}</div>
          <p className="sectionCopy">
            {state.license.accountId ? `Account ID: ${state.license.accountId}` : "Paste an activation code from the checkout site."}
          </p>
        </div>
      </div>

      <div className="field">
        <label htmlFor="activation-code">Activation code</label>
        <input
          id="activation-code"
          value={activationCode}
          onChange={(event) => setActivationCode(event.target.value)}
          placeholder="PT-XXXXXX-XXXXXX-XXXXXX"
        />
      </div>

      <div className="button-row">
        <button className="button" disabled={busy} onClick={() => void activateCode()}>
          Activate code
        </button>
        <button className="button" data-variant="ghost" disabled={busy || !hasRemoteLicenseCredentials(state.license)} onClick={() => void refreshLicenseState()}>
          Refresh license
        </button>
        <button className="button" data-variant="ghost" disabled={busy || !hasRemoteLicenseCredentials(state.license)} onClick={() => void pushSettings()}>
          Push settings
        </button>
        <button className="button" data-variant="ghost" disabled={busy || !hasRemoteLicenseCredentials(state.license)} onClick={() => void pullSettings()}>
          Pull settings
        </button>
        <button className="button" data-variant="ghost" disabled={busy} onClick={() => void openBillingPortal()}>
          Manage billing
        </button>
        {state.license.status === "free" ? (
          <button className="button" data-variant="soft" disabled={busy} onClick={() => void startTrialNow()}>
            Start local dev trial
          </button>
        ) : null}
      </div>

      <p className="sectionCopy">{statusMessage || "Use paid activation for production, or the local trial button only when testing without backend credentials."}</p>

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

      <div>
        <h3 className="sectionHeading">Sync mode</h3>
        <p className="sectionCopy">
          {hasFeature(state.license, "sync")
            ? "Cloud sync is available. Use Push and Pull to move rules and preferences between devices."
            : "Cloud sync is locked until a Pro or trial license is active."}
        </p>
      </div>
    </section>
  );
};
