import type { Request, Response } from "express";

import { checkoutSessionRequestSchema, portalSessionRequestSchema } from "../lib/schemas";
import { createCheckoutSession, createPortalSession, getBillingCapabilities } from "../services/billingService";

export const checkoutStatus = (_request: Request, response: Response) => {
  response.json({
    ok: true,
    ...getBillingCapabilities(),
  });
};

export const createCheckoutSessionHandler = async (request: Request, response: Response) => {
  const parsed = checkoutSessionRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid checkout payload.",
      issues: parsed.error.flatten(),
    });
    return;
  }

  try {
    const session = await createCheckoutSession(parsed.data.plan, parsed.data.successUrl, parsed.data.cancelUrl);
    response.json({
      ok: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    response.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : "Checkout could not be created.",
    });
  }
};

export const createPortalSessionHandler = async (request: Request, response: Response) => {
  const parsed = portalSessionRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid portal payload.",
      issues: parsed.error.flatten(),
    });
    return;
  }

  try {
    const session = await createPortalSession(
      {
        activationCode: parsed.data.activationCode,
        accountId: parsed.data.accountId,
        syncToken: parsed.data.syncToken,
      },
      parsed.data.returnUrl,
    );
    response.json({
      ok: true,
      url: session.url,
    });
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Customer portal is unavailable.",
    });
  }
};
