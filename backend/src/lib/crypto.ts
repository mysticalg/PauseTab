import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { getConfig } from "./config";

const hashValue = (value: string) => createHash("sha256").update(`${getConfig().tokenPepper}:${value}`).digest("hex");

export const generateActivationCode = () => {
  const chunk = () => randomBytes(3).toString("hex").toUpperCase();
  return `PT-${chunk()}-${chunk()}-${chunk()}`;
};

export const generateSyncToken = () => `pts_${randomBytes(24).toString("base64url")}`;

export const hashSecret = (secret: string) => hashValue(secret);

export const compareSecret = (plainText: string, hashed: string) => {
  const left = Buffer.from(hashValue(plainText), "utf8");
  const right = Buffer.from(hashed, "utf8");
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
};
