import canonicalizeValue from "canonicalize";

export const CANONICALIZATION_ID = "jcs-rfc8785-v1";

export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalJsonError";
  }
}

export function canonicalizeJson(value: unknown): string {
  const result = canonicalizeValue(value);
  if (result === undefined) {
    throw new CanonicalJsonError("value is not JSON serializable");
  }
  return result;
}

export function canonicalizeJsonToBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalizeJson(value));
}
