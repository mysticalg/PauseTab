import assert from "node:assert/strict";
import test from "node:test";

import { getConfig, isAllowedRequestOrigin, resetConfigCache, resolveAllowedReturnUrl } from "./config.js";

const ORIGINAL_ENV = { ...process.env };

const restoreEnv = () => {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  Object.assign(process.env, ORIGINAL_ENV);
  resetConfigCache();
};

test.beforeEach(() => {
  restoreEnv();
});

test.after(() => {
  restoreEnv();
});

test("allows chrome extension origins in production by default", () => {
  process.env.NODE_ENV = "production";
  process.env.PAUSETAB_PUBLIC_URL = "https://pausetab.app";
  process.env.PAUSETAB_TOKEN_PEPPER = "production-secret-pepper";
  process.env.STRIPE_SECRET_KEY = "sk_live_example";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_monthly";
  process.env.STRIPE_PRICE_PRO_ANNUAL = "price_annual";
  process.env.STRIPE_PRICE_LIFETIME = "price_lifetime";

  assert.equal(isAllowedRequestOrigin("chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef"), true);
});

test("can restrict chrome extension origins to configured IDs", () => {
  process.env.NODE_ENV = "production";
  process.env.PAUSETAB_PUBLIC_URL = "https://pausetab.app";
  process.env.PAUSETAB_TOKEN_PEPPER = "production-secret-pepper";
  process.env.PAUSETAB_ALLOWED_EXTENSION_IDS = "allowedextensionid0000000000000000";
  process.env.STRIPE_SECRET_KEY = "sk_live_example";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_monthly";
  process.env.STRIPE_PRICE_PRO_ANNUAL = "price_annual";
  process.env.STRIPE_PRICE_LIFETIME = "price_lifetime";

  assert.equal(isAllowedRequestOrigin("chrome-extension://allowedextensionid0000000000000000"), true);
  assert.equal(isAllowedRequestOrigin("chrome-extension://blockedextensionid0000000000000000"), false);
});

test("falls back to the public URL when a billing return URL origin is not allowed", () => {
  process.env.PAUSETAB_PUBLIC_URL = "https://pausetab.app";
  process.env.PAUSETAB_ALLOWED_RETURN_ORIGINS = "https://pausetab.app,https://checkout.pausetab.app";

  const fallback = "https://pausetab.app/account";
  assert.equal(resolveAllowedReturnUrl("https://checkout.pausetab.app/success", fallback), "https://checkout.pausetab.app/success");
  assert.equal(resolveAllowedReturnUrl("https://example.com/hijack", fallback), fallback);
});

test("parses optional S3-backed store configuration", () => {
  process.env.PAUSETAB_STORE_S3_BUCKET = "pausetab-prod-data";
  process.env.PAUSETAB_STORE_S3_KEY = "prod/store.json";

  const config = getConfig();
  assert.equal(config.storeS3Bucket, "pausetab-prod-data");
  assert.equal(config.storeS3Key, "prod/store.json");
});

test("rejects incomplete production configuration", () => {
  process.env.NODE_ENV = "production";
  process.env.PAUSETAB_PUBLIC_URL = "http://localhost:5173";

  assert.throws(() => getConfig(), /Invalid production configuration/);
});
