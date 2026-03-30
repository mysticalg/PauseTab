import type { Request, Response } from "express";
import { z } from "zod";

const licenseRequestSchema = z.object({
  accountId: z.string().optional(),
});

export const licenseStatus = (request: Request, response: Response) => {
  const parsed = licenseRequestSchema.safeParse(request.query);
  response.json({
    ok: true,
    valid: parsed.success,
    status: "free",
    syncEnabled: false,
    accountId: parsed.success ? parsed.data.accountId ?? null : null,
  });
};
