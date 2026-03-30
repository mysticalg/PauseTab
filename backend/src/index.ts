import cors from "cors";
import express from "express";

import { authStatus } from "./routes/auth";
import { checkoutStatus } from "./routes/billing";
import { licenseStatus } from "./routes/license";
import { syncStatus } from "./routes/sync";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "pausetab-backend" });
});

app.get("/api/auth/status", authStatus);
app.get("/api/billing/status", checkoutStatus);
app.get("/api/license/status", licenseStatus);
app.get("/api/sync/status", syncStatus);

app.listen(port, () => {
  console.log(`PauseTab backend stub listening on http://localhost:${port}`);
});
