import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import { authStatus } from "./routes/auth.js";
import { checkoutStatus, createCheckoutSessionHandler, createPortalSessionHandler } from "./routes/billing.js";
import { activateLicenseHandler, claimCheckoutSessionHandler, licenseStatus } from "./routes/license.js";
import { saveSyncStateHandler, syncStatus } from "./routes/sync.js";
import { stripeWebhookHandler } from "./routes/webhooks.js";
import { getConfig, isAllowedRequestOrigin } from "./lib/config.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../.env"), quiet: true });

const app = express();
const config = getConfig();

app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      const allowed = isAllowedRequestOrigin(origin);
      callback(allowed ? null : new Error("Origin is not allowed."), allowed);
    },
    allowedHeaders: ["Content-Type", "x-pausetab-account-id", "x-pausetab-sync-token"],
    methods: ["GET", "POST", "PUT", "OPTIONS"],
  }),
);
app.post("/api/billing/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "pausetab-backend" });
});

app.get("/api/auth/status", authStatus);
app.get("/api/billing/status", checkoutStatus);
app.post("/api/billing/checkout-session", createCheckoutSessionHandler);
app.post("/api/billing/portal-session", createPortalSessionHandler);
app.get("/api/license/status", licenseStatus);
app.post("/api/license/activate", activateLicenseHandler);
app.get("/api/license/claim", claimCheckoutSessionHandler);
app.get("/api/sync/state", syncStatus);
app.put("/api/sync/state", saveSyncStateHandler);

app.listen(config.port, () => {
  console.log(`PauseTab backend listening on http://localhost:${config.port}`);
});
