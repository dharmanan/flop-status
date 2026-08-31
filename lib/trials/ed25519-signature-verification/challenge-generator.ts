import {
  generateKeyPairSync,
  randomBytes as nodeRandomBytes,
  sign as cryptoSign,
} from "node:crypto";
import { decodeBase64Url, encodeBase64Url } from "../../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../../crypto/canonical-json.js";
import { sha256 } from "../../crypto/sha256.js";
import { parseEd25519DidKey } from "../../identity/did-key.js";
import { CAPABILITY_ID, CHALLENGE_VERSION, TRIAL_ID, TRIAL_VERSION } from "./constants.js";
import {
  trial1ChallengePayloadSchema,
  trial1HiddenVerifierContextSchema,
  type Trial1CaseClass,
  type Trial1ChallengeCase,
  type Trial1ChallengePayload,
  type Trial1HiddenVerifierContext,
  type Trial1Id,
} from "./schema.js";

export type ClockFn = () => Date;
export type RandomBytesFn = (length: number) => Uint8Array;

export interface ChallengeGeneratorDependencies {
  now?: ClockFn;
  randomBytes?: RandomBytesFn;
}

export interface GenerateEd25519ChallengeInput {
  agentDid: string;
  trialId?: Trial1Id;
  caseClass?: Trial1CaseClass;
}

export interface GenerateEd25519ChallengeResult {
  publicPayload: Trial1ChallengePayload;
  hiddenContext: Trial1HiddenVerifierContext;
  challengeHash: string;
}

export const CHALLENGE_TTL_MS = 10 * 60 * 1000;

const MESSAGE_LENGTH = 32;
const CHALLENGE_ID_ENTROPY_LENGTH = 16;
const NONCE_LENGTH = 16;
const SIGNATURE_MUTATION_RANGE = 32;

const defaultClock: ClockFn = () => new Date();
const defaultRandomBytes: RandomBytesFn = (length) => new Uint8Array(nodeRandomBytes(length));

interface GeneratedCase {
  case: Trial1ChallengeCase;
  expectedValid: boolean;
}

function generateValidSignatureCase(randomBytes: RandomBytesFn): GeneratedCase {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  const rawPublicKey = decodeBase64Url(jwk.x);

  const message = randomBytes(MESSAGE_LENGTH);
  const signature = new Uint8Array(cryptoSign(null, Buffer.from(message), privateKey));

  return {
    case: {
      algorithm: "Ed25519",
      public_key: encodeBase64Url(rawPublicKey),
      message: encodeBase64Url(message),
      signature: encodeBase64Url(signature),
    },
    expectedValid: true,
  };
}

function generateInvalidSignatureCase(randomBytes: RandomBytesFn): GeneratedCase {
  const valid = generateValidSignatureCase(randomBytes);
  const signature = decodeBase64Url(valid.case.signature);

  const mutated = new Uint8Array(signature);
  const index = randomBytes(1)[0]! % SIGNATURE_MUTATION_RANGE;
  mutated[index] = mutated[index]! ^ 0xff;

  return {
    case: { ...valid.case, signature: encodeBase64Url(mutated) },
    expectedValid: false,
  };
}

function formatUuidV4(entropy: Uint8Array): string {
  const bytes = Uint8Array.from(entropy);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function generateEd25519SignatureChallenge(
  input: GenerateEd25519ChallengeInput,
  deps: ChallengeGeneratorDependencies = {},
): GenerateEd25519ChallengeResult {
  const now = deps.now ?? defaultClock;
  const randomBytes = deps.randomBytes ?? defaultRandomBytes;

  parseEd25519DidKey(input.agentDid);

  const caseClass: Trial1CaseClass =
    input.caseClass ?? (randomBytes(1)[0]! < 128 ? "VALID_SIGNATURE" : "INVALID_SIGNATURE");

  const generated =
    caseClass === "VALID_SIGNATURE"
      ? generateValidSignatureCase(randomBytes)
      : generateInvalidSignatureCase(randomBytes);

  const issuedAt = now();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);

  const publicPayload = trial1ChallengePayloadSchema.parse({
    challenge_version: CHALLENGE_VERSION,
    challenge_id: formatUuidV4(randomBytes(CHALLENGE_ID_ENTROPY_LENGTH)),
    agent_did: input.agentDid,
    capability_id: CAPABILITY_ID,
    trial_id: input.trialId ?? TRIAL_ID,
    trial_version: TRIAL_VERSION,
    nonce: encodeBase64Url(randomBytes(NONCE_LENGTH)),
    case: generated.case,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  const hiddenContext = trial1HiddenVerifierContextSchema.parse({
    expected_valid: generated.expectedValid,
    case_class: caseClass,
  });

  const challengeHash = sha256(canonicalizeJsonToBytes(publicPayload));

  return { publicPayload, hiddenContext, challengeHash };
}
