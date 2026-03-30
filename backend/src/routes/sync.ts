import type { Request, Response } from "express";

import { syncRequestSchema, syncedStateSchema } from "../lib/schemas.js";
import { getSyncedState, setSyncedState } from "../services/licenseService.js";

const parseCredentials = (request: Request) =>
  syncRequestSchema.safeParse({
    accountId: request.headers["x-pausetab-account-id"],
    syncToken: request.headers["x-pausetab-sync-token"],
  });

export const syncStatus = async (request: Request, response: Response) => {
  const credentials = parseCredentials(request);
  if (!credentials.success) {
    response.status(401).json({
      ok: false,
      error: "Missing sync credentials.",
    });
    return;
  }

  const syncedState = await getSyncedState(credentials.data.accountId, credentials.data.syncToken);
  response.json({
    ok: true,
    syncedState: syncedState ?? null,
  });
};

export const saveSyncStateHandler = async (request: Request, response: Response) => {
  const credentials = parseCredentials(request);
  if (!credentials.success) {
    response.status(401).json({
      ok: false,
      error: "Missing sync credentials.",
    });
    return;
  }

  const parsed = syncedStateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid sync payload.",
      issues: parsed.error.flatten(),
    });
    return;
  }

  const account = await setSyncedState(credentials.data.accountId, credentials.data.syncToken, parsed.data);
  if (!account) {
    response.status(401).json({
      ok: false,
      error: "Sync token is invalid.",
    });
    return;
  }

  response.json({
    ok: true,
    updatedAt: account.syncedState?.updatedAt,
  });
};
