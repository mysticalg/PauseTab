import type { Request, Response } from "express";

export const syncStatus = (_request: Request, response: Response) => {
  response.json({
    ok: true,
    mode: "stub",
    message: "Chrome sync storage currently handles synced rules for paid or trial users.",
  });
};
