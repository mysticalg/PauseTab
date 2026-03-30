import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { GetObjectCommand, HeadObjectCommand, NoSuchKey, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";

import { getConfig } from "../lib/config.js";
import { compareSecret } from "../lib/crypto.js";
import { accountRecordSchema, storeDataSchema, type AccountRecord, type StoreData, type WebhookRecord } from "../lib/schemas.js";

const emptyStore = (): StoreData => ({
  version: 1,
  accounts: [],
  webhooks: [],
});

type StoreBackend = {
  read(): Promise<StoreData>;
  write(next: StoreData): Promise<void>;
};

const resolveStorePath = () => {
  const configuredPath = getConfig().storePath;
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
};

const parseStoreData = (value: unknown) => {
  const result = storeDataSchema.safeParse(value);
  return result.success ? result.data : emptyStore();
};

class FileStoreBackend implements StoreBackend {
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
    return parseStoreData(JSON.parse(content) as unknown);
  }

  async write(next: StoreData) {
    const filePath = await this.ensureStoreFile();
    await writeFile(filePath, JSON.stringify(storeDataSchema.parse(next), null, 2), "utf8");
  }
}

class S3StoreBackend implements StoreBackend {
  private readonly client = new S3Client({});
  private readonly bucket = getConfig().storeS3Bucket!;
  private readonly key = getConfig().storeS3Key;

  private async ensureStoreObject() {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.key,
        }),
      );
    } catch (error) {
      if (!this.isMissingObject(error)) {
        throw error;
      }

      await this.write(emptyStore());
    }
  }

  private isMissingObject(error: unknown) {
    return error instanceof NoSuchKey || (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404);
  }

  async read() {
    await this.ensureStoreObject();

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.key,
      }),
    );

    const content = (await response.Body?.transformToString()) ?? JSON.stringify(emptyStore());
    return parseStoreData(JSON.parse(content) as unknown);
  }

  async write(next: StoreData) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key,
        Body: JSON.stringify(storeDataSchema.parse(next), null, 2),
        ContentType: "application/json",
      }),
    );
  }
}

const createBackend = (): StoreBackend => (getConfig().storeS3Bucket ? new S3StoreBackend() : new FileStoreBackend());

class JsonStore {
  private queue = Promise.resolve<unknown>(undefined);
  private readonly backend = createBackend();

  async read() {
    return this.backend.read();
  }

  async write(mutator: (store: StoreData) => StoreData | Promise<StoreData>) {
    this.queue = this.queue.then(async () => {
      const current = await this.read();
      const next = await mutator(current);
      const validated = storeDataSchema.parse(next);
      await this.backend.write(validated);
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
