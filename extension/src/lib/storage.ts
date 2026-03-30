import { STORAGE_KEY, STORAGE_SYNC_KEY, STORAGE_VERSION } from "./constants";
import { nowIso } from "./clock";
import { extensionStateSchema, type ExtensionState, type SyncState } from "./schema";

const baseState = (): ExtensionState => ({
  version: STORAGE_VERSION,
  rules: [],
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
  updatedAt: nowIso(),
});

const parseState = (value: unknown): ExtensionState => {
  const result = extensionStateSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  return baseState();
};

const toSyncState = (state: ExtensionState): SyncState => ({
  rules: state.rules,
  preferences: state.preferences,
  license: state.license,
  updatedAt: state.updatedAt,
});

export const getState = async () => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const localState = parseState(stored[STORAGE_KEY]);

  if (!localState.preferences.syncEnabled || !localState.license.syncEnabled) {
    return localState;
  }

  const syncStored = await chrome.storage.sync.get(STORAGE_SYNC_KEY);
  const syncState = syncStored[STORAGE_SYNC_KEY] as SyncState | undefined;
  if (!syncState) {
    return localState;
  }

  if (new Date(syncState.updatedAt).getTime() <= new Date(localState.updatedAt).getTime()) {
    return localState;
  }

  return {
    ...localState,
    rules: syncState.rules,
    preferences: syncState.preferences,
    license: syncState.license,
    updatedAt: syncState.updatedAt,
  };
};

export const setState = async (state: ExtensionState) => {
  const nextState = {
    ...state,
    version: STORAGE_VERSION,
    updatedAt: nowIso(),
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: nextState });

  if (nextState.preferences.syncEnabled && nextState.license.syncEnabled) {
    await chrome.storage.sync.set({ [STORAGE_SYNC_KEY]: toSyncState(nextState) });
  }

  return nextState;
};

export const updateState = async (updater: (state: ExtensionState) => ExtensionState | Promise<ExtensionState>) => {
  const state = await getState();
  const nextState = await updater(state);
  return setState(nextState);
};

export const resetState = async () => {
  const next = baseState();
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  await chrome.storage.sync.remove(STORAGE_SYNC_KEY);
  return next;
};
