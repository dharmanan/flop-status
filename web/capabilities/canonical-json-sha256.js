import { canonicalizeJson } from "/capabilities/jcs.js";

export const CAPABILITY_ID = "data.canonical-json-sha256";
export const PRODUCTION_TRIAL_ID = "canonical-json-sha256-certification";
export const TRIAL_VERSION = "1";

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

export async function evaluatePractice(result, fixture) {
  return result.canonical_json === fixture.expected.canonical_json && result.sha256 === fixture.expected.sha256;
}
