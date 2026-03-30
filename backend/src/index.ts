import cors from "cors";
import express from "express";

import { authStatus } from "./routes/auth";
import { checkoutStatus, createCheckoutSessionHandler, createPortalSessionHandler } from "./routes/billing";
import { activateLicenseHandler, claimCheckoutSessionHandler, licenseStatus } from "./routes/license";
import { saveSyncStateHandler, syncStatus } from "./routes/sync";
import { stripeWebhookHandler } from "./routes/webhooks";
import { getConfig } from "./lib/config";

const app = express();
const config = getConfig();

app.use(cors());
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
