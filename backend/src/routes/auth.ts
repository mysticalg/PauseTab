import type { Request, Response } from "express";

import { getBillingCapabilities } from "../services/billingService.js";
import { getConfig } from "../lib/config.js";

export const authStatus = (_request: Request, response: Response) => {
  const capabilities = getBillingCapabilities();
  response.json({
    ok: true,
    nodeEnv: getConfig().nodeEnv,
    publicUrl: getConfig().publicUrl,
    ...capabilities,
  });
};
