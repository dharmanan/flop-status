import { randomBytes as nodeRandomBytes } from "node:crypto";
import { encodeBase64Url } from "../../crypto/base64url.js";
import { canonicalizeJson, canonicalizeJsonToBytes } from "../../crypto/canonical-json.js";
import { sha256 } from "../../crypto/sha256.js";
import { parseEd25519DidKey } from "../../identity/did-key.js";
import { CAPABILITY_ID, CHALLENGE_VERSION, TRIAL_ID, TRIAL_VERSION } from "./constants.js";
import {
  trial2ChallengePayloadSchema,
  trial2HiddenVerifierContextSchema,
  type Trial2CaseClass,
  type Trial2ChallengePayload,
  type Trial2HiddenVerifierContext,
  type Trial2Id,
} from "./schema.js";

export type ClockFn = () => Date;
export type RandomBytesFn = (length: number) => Uint8Array;

export interface Trial2ChallengeGeneratorDependencies {
  now?: ClockFn;
  randomBytes?: RandomBytesFn;
}

export interface GenerateCanonicalJsonSha256ChallengeInput {
  agentDid: string;
  trialId?: Trial2Id;
  caseClass?: Trial2CaseClass;
}

export interface GenerateCanonicalJsonSha256ChallengeResult {
  publicPayload: Trial2ChallengePayload;
  hiddenContext: Trial2HiddenVerifierContext;
  challengeHash: string;
}

export const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_ID_ENTROPY_LENGTH = 16;
const NONCE_LENGTH = 16;
const TOKEN_LENGTH = 8;

const defaultClock: ClockFn = () => new Date();
const defaultRandomBytes: RandomBytesFn = (length) => new Uint8Array(nodeRandomBytes(length));

const CASE_CLASSES: readonly Trial2CaseClass[] = ["NESTED_OBJECT", "UNICODE_KEYS", "ARRAY_MIX", "NUMERIC_EDGE"];

function formatUuidV4(entropy: Uint8Array): string {
  const bytes = Uint8Array.from(entropy);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function buildDocument(caseClass: Trial2CaseClass, token: string): unknown {
  switch (caseClass) {
    case "NESTED_OBJECT":
      return { zeta: { enabled: true, count: 3, token }, alpha: { nested: { c: null, a: "first", b: false } }, list: [3, 2, 1] };
    case "UNICODE_KEYS":
      return { "é": "precomposed", "€": "euro", "😀": "emoji", a: token, "\r": "carriage-return-key" };
    case "ARRAY_MIX":
      return [{ b: 2, a: 1 }, [true, null, token, { y: "yes", x: "ex" }], "line\nfeed"];
    case "NUMERIC_EDGE":
      return { tiny: 1e-27, large: 1e30, fraction: 333333333.33333329, zero: 0, negative: -0.000001, token };
  }
}

export function generateCanonicalJsonSha256Challenge(
  input: GenerateCanonicalJsonSha256ChallengeInput,
  deps: Trial2ChallengeGeneratorDependencies = {},
): GenerateCanonicalJsonSha256ChallengeResult {
  const now = deps.now ?? defaultClock;
  const randomBytes = deps.randomBytes ?? defaultRandomBytes;

  parseEd25519DidKey(input.agentDid);

  const caseClass = input.caseClass ?? CASE_CLASSES[randomBytes(1)[0]! % CASE_CLASSES.length]!;
  const token = encodeBase64Url(randomBytes(TOKEN_LENGTH));
  const document = buildDocument(caseClass, token);
  const expectedCanonicalJson = canonicalizeJson(document);
  const expectedSha256 = sha256(new TextEncoder().encode(expectedCanonicalJson));
  const issuedAt = now();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);

  const publicPayload = trial2ChallengePayloadSchema.parse({
    challenge_version: CHALLENGE_VERSION,
    challenge_id: formatUuidV4(randomBytes(CHALLENGE_ID_ENTROPY_LENGTH)),
    agent_did: input.agentDid,
    capability_id: CAPABILITY_ID,
    trial_id: input.trialId ?? TRIAL_ID,
    trial_version: TRIAL_VERSION,
    nonce: encodeBase64Url(randomBytes(NONCE_LENGTH)),
    case: { document },
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  const hiddenContext = trial2HiddenVerifierContextSchema.parse({
    case_class: caseClass,
    expected_canonical_json: expectedCanonicalJson,
    expected_sha256: expectedSha256,
  });
  const challengeHash = sha256(canonicalizeJsonToBytes(publicPayload));
  return { publicPayload, hiddenContext, challengeHash };
}
