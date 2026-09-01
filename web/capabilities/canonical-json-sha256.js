export const CAPABILITY_ID = "data.canonical-json-sha256";
export const PRODUCTION_TRIAL_ID = "canonical-json-sha256-certification";
export const TRIAL_VERSION = "1";

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

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

async function sha256(text) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return "sha256:" + bytesToBase64Url(digest);
}

export async function executeCanonicalJsonSha256(input) {
  if (!input || typeof input !== "object" || !("document" in input)) throw new Error("DOCUMENT_REQUIRED");
  const canonicalJson = canonicalizeJson(input.document);
  return {
    canonical_json: canonicalJson,
    sha256: await sha256(canonicalJson),
  };
}

export function createPracticeFixture() {
  return {
    input: {
      document: {
        z: 3,
        a: { b: 2, a: 1 },
        list: [true, null, "flop"],
      },
    },
    expected: {
      canonical_json: '{"a":{"a":1,"b":2},"list":[true,null,"flop"],"z":3}',
      sha256: "sha256:_ynS8XTVdQlr2jAxpAre_cRU4Keu1ucZRK3j6R0eRn0",
    },
  };
}
