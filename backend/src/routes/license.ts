import type { Request, Response } from "express";

import { activateLicenseRequestSchema, syncRequestSchema } from "../lib/schemas";
import { claimCheckoutSession } from "../services/billingService";
import { activateAccountFromCode, getLicenseStatusForSyncToken } from "../services/licenseService";

export const licenseStatus = async (request: Request, response: Response) => {
  const parsed = syncRequestSchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({
      ok: false,
      error: "Missing accountId or syncToken.",
    });
    return;
  }

  const license = await getLicenseStatusForSyncToken(parsed.data.accountId, parsed.data.syncToken);
  if (!license) {
    response.status(401).json({
      ok: false,
      error: "License token is invalid.",
    });
    return;
  }

  response.json({
    ok: true,
    license,
  });
};

export const activateLicenseHandler = async (request: Request, response: Response) => {
  const parsed = activateLicenseRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      ok: false,
      error: "Activation code is required.",
    });
    return;
  }

  const result = await activateAccountFromCode(parsed.data.activationCode);
  if (!result) {
    response.status(401).json({
      ok: false,
      error: "Activation code is invalid.",
    });
    return;
  }

  response.json({
    ok: true,
    license: result,
  });
};

export const claimCheckoutSessionHandler = async (request: Request, response: Response) => {
  const sessionId = typeof request.query.sessionId === "string" ? request.query.sessionId : undefined;
  if (!sessionId) {
    response.status(400).json({
      ok: false,
      error: "sessionId is required.",
    });
    return;
  }

  try {
    const result = await claimCheckoutSession(sessionId);
    response.json({
      ok: true,
      activationCode: result.activationCode,
      license: {
        status: result.account.license.status,
        plan: result.account.license.plan,
        accountId: result.account.id,
        accountEmail: result.account.email,
        expiresAt: result.account.license.expiresAt,
      },
    });
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Could not claim checkout session.",
    });
  }
};
