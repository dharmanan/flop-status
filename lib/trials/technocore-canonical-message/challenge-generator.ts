import { randomBytes as nodeRandomBytes } from "node:crypto";
import { encodeBase64Url } from "../../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../../crypto/canonical-json.js";
import { sha256 } from "../../crypto/sha256.js";
import { parseEd25519DidKey } from "../../identity/did-key.js";
import { CAPABILITY_ID, CHALLENGE_VERSION, TRIAL_ID, TRIAL_VERSION } from "./constants.js";
import { buildCanonicalTechnocoreMessage } from "./protocol.js";
import {
  trial3ChallengePayloadSchema,
  trial3HiddenVerifierContextSchema,
  type Trial3CaseClass,
  type Trial3ChallengePayload,
  type Trial3HiddenVerifierContext,
} from "./schema.js";

export type ClockFn = () => Date;
export type RandomBytesFn = (length: number) => Uint8Array;

export interface Trial3ChallengeGeneratorDependencies {
  now?: ClockFn;
  randomBytes?: RandomBytesFn;
}

export interface GenerateTechnocoreCanonicalMessageChallengeInput {
  agentDid: string;
  caseClass?: Trial3CaseClass;
}

export interface GenerateTechnocoreCanonicalMessageChallengeResult {
  publicPayload: Trial3ChallengePayload;
  hiddenContext: Trial3HiddenVerifierContext;
  challengeHash: string;
}

export const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_ID_ENTROPY_LENGTH = 16;
const NONCE_LENGTH = 16;

const defaultClock: ClockFn = () => new Date();
const defaultRandomBytes: RandomBytesFn = (length) => new Uint8Array(nodeRandomBytes(length));

const CASE_CLASSES: readonly Trial3CaseClass[] = [
  "WHITESPACE_CONTROL",
  "UNICODE_TEXT",
  "PIPE_TEXT",
  "PLAIN_TEXT",
];

function formatUuidV4(entropy: Uint8Array): string {
  const bytes = Uint8Array.from(entropy);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function fixtureNonce(randomBytes: RandomBytesFn): string {
  const bytes = Buffer.from(randomBytes(6));
  const value = bytes.readUIntBE(0, 6);
  return String(1_700_000_000_000 + (value % 99_999_999_999));
}

function fixtureText(caseClass: Trial3CaseClass): string {
  switch (caseClass) {
    case "WHITESPACE_CONTROL":
      return "  alpha\n\tbeta\r\n gamma  ";
    case "UNICODE_TEXT":
      return "Merhaba  dünya 😀\u2028ikinci satır";
    case "PIPE_TEXT":
      return "payload | keeps | pipe characters";
    case "PLAIN_TEXT":
      return "deterministic capability proof";
  }
}

export function generateTechnocoreCanonicalMessageChallenge(
  input: GenerateTechnocoreCanonicalMessageChallengeInput,
  deps: Trial3ChallengeGeneratorDependencies = {},
): GenerateTechnocoreCanonicalMessageChallengeResult {
  const now = deps.now ?? defaultClock;
  const randomBytes = deps.randomBytes ?? defaultRandomBytes;

  parseEd25519DidKey(input.agentDid);

  const caseClass = input.caseClass ?? CASE_CLASSES[randomBytes(1)[0]! % CASE_CLASSES.length]!;
  const room = `proof-${Buffer.from(randomBytes(4)).toString("hex")}`;
  const technocoreNonce = fixtureNonce(randomBytes);
  const text = fixtureText(caseClass);
  const expected = buildCanonicalTechnocoreMessage(room, technocoreNonce, text);

  const issuedAt = now();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);

  const publicPayload = trial3ChallengePayloadSchema.parse({
    challenge_version: CHALLENGE_VERSION,
    challenge_id: formatUuidV4(randomBytes(CHALLENGE_ID_ENTROPY_LENGTH)),
    agent_did: input.agentDid,
    capability_id: CAPABILITY_ID,
    trial_id: TRIAL_ID,
    trial_version: TRIAL_VERSION,
    nonce: encodeBase64Url(randomBytes(NONCE_LENGTH)),
    case: { room, nonce: technocoreNonce, text },
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  const hiddenContext = trial3HiddenVerifierContextSchema.parse({
    case_class: caseClass,
    expected_cleaned_text: expected.cleanedText,
    expected_canonical_message: expected.canonicalMessage,
  });

  const challengeHash = sha256(canonicalizeJsonToBytes(publicPayload));
  return { publicPayload, hiddenContext, challengeHash };
}
