import { createHash } from "node:crypto";
import { decodeBase64Url, encodeBase64Url } from "./base64url.js";

export const SHA256_PREFIX = "sha256:";
const SHA256_DIGEST_LENGTH = 32;

export function sha256(bytes: Uint8Array): string {
  const digest = createHash("sha256").update(bytes).digest();
  return `${SHA256_PREFIX}${encodeBase64Url(new Uint8Array(digest))}`;
}

export function isSha256Hash(value: string): boolean {
  if (typeof value !== "string" || !value.startsWith(SHA256_PREFIX)) {
    return false;
  }
  try {
    const bytes = decodeBase64Url(value.slice(SHA256_PREFIX.length));
    return bytes.length === SHA256_DIGEST_LENGTH;
  } catch {
    return false;
  }
}
