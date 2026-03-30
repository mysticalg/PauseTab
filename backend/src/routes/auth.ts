import type { Request, Response } from "express";

import { getBillingCapabilities } from "../services/billingService";
import { getConfig } from "../lib/config";

export const authStatus = (_request: Request, response: Response) => {
  const capabilities = getBillingCapabilities();
  response.json({
    ok: true,
    publicUrl: getConfig().publicUrl,
    ...capabilities,
  });
};
