/**
 * RFC 8785 / JCS-compatible deterministic JSON canonicalization, shared by the
 * Canonical JSON + SHA256 capability and the Signed Receipt Verification
 * capability (which canonicalizes a receipt before checking its signature).
 *
 * Extracted from the Capability 2 browser module: object keys sort by the
 * default string sort, numbers and strings use native JSON.stringify, which
 * matches the server's RFC 8785 canonicalizer for every value this system
 * produces (verified against the "canonicalize" package used server side).
 */

export const CANONICALIZATION_ID = "jcs-rfc8785-v1";

function assertJsonValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JSON_NUMBER_MUST_BE_FINITE");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(assertJsonValue);
    return;
  }
  if (typeof value === "object") {
    for (const entry of Object.values(value)) assertJsonValue(entry);
    return;
  }
  throw new Error("VALUE_IS_NOT_JSON");
}

export function canonicalizeJson(value) {
  assertJsonValue(value);
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalizeJson).join(",") + "]";
  }
  return "{" + Object.keys(value)
    .sort()
    .map((key) => JSON.stringify(key) + ":" + canonicalizeJson(value[key]))
    .join(",") + "}";
}

export function canonicalizeJsonToBytes(value) {
  return new TextEncoder().encode(canonicalizeJson(value));
}
