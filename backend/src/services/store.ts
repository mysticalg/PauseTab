import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getConfig } from "../lib/config.js";
import { compareSecret } from "../lib/crypto.js";
import { accountRecordSchema, storeDataSchema, type AccountRecord, type StoreData, type WebhookRecord } from "../lib/schemas.js";

const emptyStore = (): StoreData => ({
  version: 1,
  accounts: [],
  webhooks: [],
});

const resolveStorePath = () => {
  const configuredPath = getConfig().storePath;
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
};

class JsonStore {
  private queue = Promise.resolve<unknown>(undefined);

  private async ensureStoreFile() {
    const filePath = resolveStorePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    try {
      await readFile(filePath, "utf8");
    } catch {
      await writeFile(filePath, JSON.stringify(emptyStore(), null, 2), "utf8");
    }

    return filePath;
  }

  async read() {
    const filePath = await this.ensureStoreFile();
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    const result = storeDataSchema.safeParse(parsed);
    return result.success ? result.data : emptyStore();
  }

  async write(mutator: (store: StoreData) => StoreData | Promise<StoreData>) {
    this.queue = this.queue.then(async () => {
      const filePath = await this.ensureStoreFile();
      const current = await this.read();
      const next = await mutator(current);
      const validated = storeDataSchema.parse(next);
      await writeFile(filePath, JSON.stringify(validated, null, 2), "utf8");
      return validated;
    });

    return this.queue as Promise<StoreData>;
  }
}

const store = new JsonStore();

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const readStore = () => store.read();

export const findAccountById = async (accountId: string) => {
  const data = await store.read();
  return data.accounts.find((account) => account.id === accountId);
};

export const findAccountByEmail = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const data = await store.read();
  return data.accounts.find((account) => normalizeEmail(account.email) === normalizedEmail);
};

export const findAccountByStripeCustomerId = async (customerId: string) => {
  const data = await store.read();
  return data.accounts.find((account) => account.stripeCustomerId === customerId);
};

export const findAccountByStripeSubscriptionId = async (subscriptionId: string) => {
  const data = await store.read();
  return data.accounts.find((account) => account.stripeSubscriptionId === subscriptionId);
};

export const findAccountByActivationCode = async (activationCode: string) => {
  const data = await store.read();
  return data.accounts.find((account) => account.activationCodeHash && compareSecret(activationCode, account.activationCodeHash));
};

export const findAccountBySyncToken = async (accountId: string, syncToken: string) => {
  const account = await findAccountById(accountId);
  if (!account?.syncTokenHash) {
    return undefined;
  }

  return compareSecret(syncToken, account.syncTokenHash) ? account : undefined;
};

export const upsertAccount = async (record: AccountRecord) =>
  store.write((current) => {
    const accounts = current.accounts.some((account) => account.id === record.id)
      ? current.accounts.map((account) => (account.id === record.id ? accountRecordSchema.parse(record) : account))
      : [...current.accounts, accountRecordSchema.parse(record)];

    return {
      ...current,
      accounts,
    };
  });

export const mutateAccount = async (
  matcher: (account: AccountRecord) => boolean,
  mutator: (account: AccountRecord | undefined) => AccountRecord,
) =>
  store.write((current) => {
    const existing = current.accounts.find(matcher);
    const next = accountRecordSchema.parse(mutator(existing));
    const accounts = existing
      ? current.accounts.map((account) => (account.id === next.id ? next : account))
      : [...current.accounts, next];

    return {
      ...current,
      accounts,
    };
  });

export const isWebhookProcessed = async (eventId: string) => {
  const data = await store.read();
  return data.webhooks.some((record) => record.id === eventId);
};

export const markWebhookProcessed = async (record: WebhookRecord) =>
  store.write((current) => ({
    ...current,
    webhooks: current.webhooks.some((item) => item.id === record.id) ? current.webhooks : [...current.webhooks, record],
  }));
