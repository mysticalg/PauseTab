import type { Request, Response } from "express";

export const checkoutStatus = (_request: Request, response: Response) => {
  response.json({
    ok: true,
    checkout: "stub",
    supportedPlans: ["monthly", "annual", "lifetime"],
    message: "Stripe or Paddle integration belongs here in milestone 2.",
  });
};
