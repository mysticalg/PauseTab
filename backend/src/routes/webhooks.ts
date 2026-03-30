import type { Request, Response } from "express";

import { handleStripeWebhook } from "../services/billingService.js";

export const stripeWebhookHandler = async (request: Request, response: Response) => {
  try {
    const signature = typeof request.headers["stripe-signature"] === "string" ? request.headers["stripe-signature"] : undefined;
    await handleStripeWebhook(signature, request.body as Buffer);
    response.json({ ok: true });
  } catch (error) {
    console.error("Stripe webhook failed:", error);
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Webhook failed.",
    });
  }
};
