import { generateKeyPairSync, randomBytes as nodeRandomBytes, sign as cryptoSign } from "node:crypto";
import { decodeBase64Url, encodeBase64Url } from "../../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../../crypto/canonical-json.js";
import { sha256 } from "../../crypto/sha256.js";
import { parseEd25519DidKey } from "../../identity/did-key.js";
import { RECEIPT_EVIDENCE_TYPE, RECEIPT_VERSION, type UnsignedPassReceipt } from "../../receipts/receipt.js";
import { CAPABILITY_ID, CHALLENGE_VERSION, TRIAL_ID, TRIAL_VERSION } from "./constants.js";
import {
  trial4ChallengePayloadSchema,
  trial4HiddenVerifierContextSchema,
  type Trial4CaseClass,
  type Trial4ChallengePayload,
  type Trial4HiddenVerifierContext,
} from "./schema.js";

export type ClockFn = () => Date;
export type RandomBytesFn = (length: number) => Uint8Array;

export interface Trial4ChallengeGeneratorDependencies {
  now?: ClockFn;
  randomBytes?: RandomBytesFn;
}

export interface GenerateSignedReceiptVerificationChallengeInput {
  agentDid: string;
  caseClass?: Trial4CaseClass;
}

export interface GenerateSignedReceiptVerificationChallengeResult {
  publicPayload: Trial4ChallengePayload;
  hiddenContext: Trial4HiddenVerifierContext;
  challengeHash: string;
}

export const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const defaultClock: ClockFn = () => new Date();
const defaultRandomBytes: RandomBytesFn = (length) => new Uint8Array(nodeRandomBytes(length));
const CASES: readonly Trial4CaseClass[] = ["VALID", "TAMPERED_FIELD", "KEY_ID_MISMATCH", "UNKNOWN_KEY"];

function formatUuidV4(entropy: Uint8Array): string {
  const bytes = Uint8Array.from(entropy.slice(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function makeServerKey(keyId: string) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  return {
    public: {
      key_id: keyId,
      algorithm: "Ed25519" as const,
      encoding: "base64url" as const,
      public_key: jwk.x,
    },
    sign(unsigned: UnsignedPassReceipt): string {
      return encodeBase64Url(new Uint8Array(cryptoSign(null, Buffer.from(canonicalizeJsonToBytes(unsigned)), privateKey)));
    },
  };
}

function hashOf(label: string): string {
  return sha256(new TextEncoder().encode(label));
}

export function generateSignedReceiptVerificationChallenge(
  input: GenerateSignedReceiptVerificationChallengeInput,
  deps: Trial4ChallengeGeneratorDependencies = {},
): GenerateSignedReceiptVerificationChallengeResult {
  parseEd25519DidKey(input.agentDid);
  const now = deps.now ?? defaultClock;
  const randomBytes = deps.randomBytes ?? defaultRandomBytes;
  const caseClass = input.caseClass ?? CASES[randomBytes(1)[0]! % CASES.length]!;
  const issuedAt = now();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
  const challengeId = formatUuidV4(randomBytes(16));
  const receiptId = formatUuidV4(randomBytes(16));
  const sourceChallengeId = formatUuidV4(randomBytes(16));
  const keyA = makeServerKey("flop-trial4-key-a");
  const keyB = makeServerKey("flop-trial4-key-b");
  const unknownKey = makeServerKey("flop-trial4-key-unknown");

  const declaredKeyId = caseClass === "KEY_ID_MISMATCH"
    ? keyB.public.key_id
    : caseClass === "UNKNOWN_KEY"
      ? unknownKey.public.key_id
      : keyA.public.key_id;

  const unsigned: UnsignedPassReceipt = {
    receipt_version: RECEIPT_VERSION,
    receipt_id: receiptId,
    agent_did: input.agentDid,
    capability_id: "fixture.capability",
    trial_id: "fixture-trial",
    trial_version: "1",
    challenge_id: sourceChallengeId,
    challenge_hash: hashOf(`challenge:${sourceChallengeId}`),
    result_hash: hashOf(`result:${receiptId}`),
    verifier_id: "fixture-verifier",
    verifier_version: "1",
    verdict: "PASS",
    evidence_type: RECEIPT_EVIDENCE_TYPE,
    issued_at: issuedAt.toISOString(),
    server_key_id: declaredKeyId,
  };

  const signingKey = caseClass === "UNKNOWN_KEY" ? unknownKey : keyA;
  const signature = signingKey.sign(unsigned);
  const receipt = {
    ...unsigned,
    server_signature: signature,
  };

  if (caseClass === "TAMPERED_FIELD") {
    receipt.result_hash = hashOf(`tampered:${receiptId}`);
  }

  const serverKeys = caseClass === "UNKNOWN_KEY"
    ? [keyA.public, keyB.public]
    : [keyA.public, keyB.public];

  const publicPayload = trial4ChallengePayloadSchema.parse({
    challenge_version: CHALLENGE_VERSION,
    challenge_id: challengeId,
    agent_did: input.agentDid,
    capability_id: CAPABILITY_ID,
    trial_id: TRIAL_ID,
    trial_version: TRIAL_VERSION,
    nonce: encodeBase64Url(randomBytes(16)),
    case: { receipt, server_keys: serverKeys },
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  const expected = caseClass === "VALID"
    ? { expected_status: "VALID", expected_reason_code: "SIGNATURE_VALID", expected_key_id: keyA.public.key_id }
    : caseClass === "TAMPERED_FIELD"
      ? { expected_status: "INVALID", expected_reason_code: "SIGNATURE_INVALID", expected_key_id: declaredKeyId }
      : caseClass === "KEY_ID_MISMATCH"
        ? { expected_status: "INVALID", expected_reason_code: "KEY_ID_MISMATCH", expected_key_id: keyA.public.key_id }
        : { expected_status: "UNKNOWN", expected_reason_code: "SERVER_KEY_NOT_FOUND", expected_key_id: null };

  const hiddenContext = trial4HiddenVerifierContextSchema.parse({ case_class: caseClass, ...expected });
  return {
    publicPayload,
    hiddenContext,
    challengeHash: sha256(canonicalizeJsonToBytes(publicPayload)),
  };
}
