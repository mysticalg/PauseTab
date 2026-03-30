import { apiUrl, SITE_URL } from "./api";
import type { ExtensionState, LicenseState } from "./schema";

type RemoteLicenseResponse = {
  ok: boolean;
  license?: {
    status: LicenseState["status"];
    plan?: LicenseState["plan"];
    expiresAt?: string;
    accountId: string;
    accountEmail?: string;
    syncEnabled: boolean;
    syncToken?: string;
    activationCode?: string;
  };
  activationCode?: string;
  error?: string;
};

type RemoteSyncResponse = {
  ok: boolean;
  syncedState?: {
    rules: ExtensionState["rules"];
    preferences: ExtensionState["preferences"];
    updatedAt: string;
  } | null;
  error?: string;
};

const fetchJson = async <T,>(path: string, options?: RequestInit) => {
  const response = await fetch(apiUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  return (await response.json()) as T;
};

export const activateRemoteLicense = async (activationCode: string): Promise<LicenseState> => {
  const response = await fetchJson<RemoteLicenseResponse>("/api/license/activate", {
    method: "POST",
    body: JSON.stringify({ activationCode }),
  });

  if (!response.ok || !response.license) {
    throw new Error(response.error ?? "License activation failed.");
  }

  return {
    status: response.license.status,
    plan: response.license.plan,
    expiresAt: response.license.expiresAt,
    accountId: response.license.accountId,
    accountEmail: response.license.accountEmail,
    activationCode: response.license.activationCode ?? activationCode,
    syncToken: response.license.syncToken,
    syncEnabled: response.license.syncEnabled,
    lastValidatedAt: new Date().toISOString(),
  };
};

export const refreshRemoteLicense = async (license: LicenseState): Promise<LicenseState> => {
  if (!license.accountId || !license.syncToken) {
    throw new Error("Remote license credentials are missing.");
  }

  const query = new URLSearchParams({
    accountId: license.accountId,
    syncToken: license.syncToken,
  });
  const response = await fetchJson<RemoteLicenseResponse>(`/api/license/status?${query.toString()}`);
  if (!response.ok || !response.license) {
    throw new Error(response.error ?? "License refresh failed.");
  }

  return {
    ...license,
    status: response.license.status,
    plan: response.license.plan,
    expiresAt: response.license.expiresAt,
    accountEmail: response.license.accountEmail ?? license.accountEmail,
    syncEnabled: response.license.syncEnabled,
    lastValidatedAt: new Date().toISOString(),
  };
};

export const pushRemoteSyncState = async (state: ExtensionState) => {
  if (!state.license.accountId || !state.license.syncToken) {
    throw new Error("Remote sync credentials are missing.");
  }

  const response = await fetchJson<{ ok: boolean; error?: string }>("/api/sync/state", {
    method: "PUT",
    headers: {
      "x-pausetab-account-id": state.license.accountId,
      "x-pausetab-sync-token": state.license.syncToken,
    },
    body: JSON.stringify({
      rules: state.rules,
      preferences: state.preferences,
      updatedAt: state.updatedAt,
    }),
  });

  if (!response.ok) {
    throw new Error(response.error ?? "Push sync failed.");
  }
};

export const pullRemoteSyncState = async (license: LicenseState) => {
  if (!license.accountId || !license.syncToken) {
    throw new Error("Remote sync credentials are missing.");
  }

  const response = await fetchJson<RemoteSyncResponse>("/api/sync/state", {
    headers: {
      "x-pausetab-account-id": license.accountId,
      "x-pausetab-sync-token": license.syncToken,
    },
  });

  if (!response.ok) {
    throw new Error(response.error ?? "Pull sync failed.");
  }

  return response.syncedState;
};

export const createPortalSession = async (activationCode: string) => {
  return createPortalSessionForLicense({
    activationCode,
  });
};

export const createPortalSessionForLicense = async (license: Pick<LicenseState, "activationCode" | "accountId" | "syncToken">) => {
  const response = await fetchJson<{ ok: boolean; url?: string; error?: string }>("/api/billing/portal-session", {
    method: "POST",
    body: JSON.stringify({
      activationCode: license.activationCode,
      accountId: license.accountId,
      syncToken: license.syncToken,
      returnUrl: SITE_URL,
    }),
  });

  if (!response.ok || !response.url) {
    throw new Error(response.error ?? "Billing portal could not be opened.");
  }

  return response.url;
};
