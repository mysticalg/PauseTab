import type { Request, Response } from "express";

export const authStatus = (_request: Request, response: Response) => {
  response.json({
    ok: true,
    provider: "placeholder",
    message: "Auth is not wired yet. Use the local trial flow inside the extension.",
  });
};
