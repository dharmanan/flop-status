import { z } from "zod";
import { decodeBase64Url } from "../../crypto/base64url.js";
import { ED25519_PUBLIC_KEY_LENGTH, ED25519_SIGNATURE_LENGTH } from "../../crypto/ed25519.js";
import { isSha256Hash } from "../../crypto/sha256.js";
import { parseEd25519DidKey } from "../../identity/did-key.js";
import { RECEIPT_EVIDENCE_TYPE, RECEIPT_VERSION } from "../../receipts/receipt.js";
import { CANONICALIZATION_ID, CAPABILITY_ID, CHALLENGE_VERSION, SUBMISSION_VERSION, TRIAL_ID, TRIAL_VERSION } from "./constants.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uuidSchema = z.string().regex(UUID_PATTERN);
const timestampSchema = z.string().datetime();
const hashSchema = z.string().refine(isSha256Hash);
const didSchema = z.string().refine((value) => {
  try { parseEd25519DidKey(value); return true; } catch { return false; }
});

function base64UrlSchema(exactLength: number) {
  return z.string().refine((value) => {
    try { return decodeBase64Url(value).length === exactLength; } catch { return false; }
  });
}

export const trial4CaseClassSchema = z.enum([
  "VALID",
  "TAMPERED_FIELD",
  "KEY_ID_MISMATCH",
  "UNKNOWN_KEY",
]);
export type Trial4CaseClass = z.infer<typeof trial4CaseClassSchema>;

export const trial4ReceiptSchema = z.object({
  receipt_version: z.literal(RECEIPT_VERSION),
  receipt_id: uuidSchema,
  agent_did: didSchema,
  capability_id: z.string().min(1),
  trial_id: z.string().min(1),
  trial_version: z.string().min(1),
  challenge_id: uuidSchema,
  challenge_hash: hashSchema,
  result_hash: hashSchema,
  verifier_id: z.string().min(1),
  verifier_version: z.string().min(1),
  verdict: z.literal("PASS"),
  evidence_type: z.literal(RECEIPT_EVIDENCE_TYPE),
  issued_at: timestampSchema,
  server_key_id: z.string().min(1),
  server_signature: base64UrlSchema(ED25519_SIGNATURE_LENGTH),
}).strict();

export const trial4ServerKeySchema = z.object({
  key_id: z.string().min(1),
  algorithm: z.literal("Ed25519"),
  encoding: z.literal("base64url"),
  public_key: base64UrlSchema(ED25519_PUBLIC_KEY_LENGTH),
}).strict();

export const trial4ChallengePayloadSchema = z.object({
  challenge_version: z.literal(CHALLENGE_VERSION),
  challenge_id: uuidSchema,
  agent_did: didSchema,
  capability_id: z.literal(CAPABILITY_ID),
  trial_id: z.literal(TRIAL_ID),
  trial_version: z.literal(TRIAL_VERSION),
  nonce: z.string().min(1),
  case: z.object({
    receipt: trial4ReceiptSchema,
    server_keys: z.array(trial4ServerKeySchema).min(1).max(3),
  }).strict(),
  issued_at: timestampSchema,
  expires_at: timestampSchema,
}).strict();
export type Trial4ChallengePayload = z.infer<typeof trial4ChallengePayloadSchema>;

export const trial4ResultSchema = z.object({
  status: z.enum(["VALID", "INVALID", "UNKNOWN"]),
  reason_code: z.enum([
    "SIGNATURE_VALID",
    "SIGNATURE_INVALID",
    "KEY_ID_MISMATCH",
    "SERVER_KEY_NOT_FOUND",
  ]),
  key_id: z.string().min(1).nullable(),
}).strict();
export type Trial4Result = z.infer<typeof trial4ResultSchema>;

export const trial4SignedSubmissionPayloadSchema = z.object({
  submission_version: z.literal(SUBMISSION_VERSION),
  canonicalization: z.literal(CANONICALIZATION_ID),
  challenge_id: uuidSchema,
  challenge_hash: hashSchema,
  agent_did: z.string().min(1),
  trial_id: z.literal(TRIAL_ID),
  trial_version: z.literal(TRIAL_VERSION),
  result: trial4ResultSchema,
  submitted_at: timestampSchema,
}).strict();

export const trial4SignedSubmissionEnvelopeSchema = z.object({
  payload: trial4SignedSubmissionPayloadSchema,
  signature: z.object({
    algorithm: z.literal("Ed25519"),
    encoding: z.literal("base64url"),
    value: base64UrlSchema(ED25519_SIGNATURE_LENGTH),
  }).strict(),
}).strict();

export const trial4HiddenVerifierContextSchema = z.object({
  case_class: trial4CaseClassSchema,
  expected_status: trial4ResultSchema.shape.status,
  expected_reason_code: trial4ResultSchema.shape.reason_code,
  expected_key_id: z.string().min(1).nullable(),
}).strict();
export type Trial4HiddenVerifierContext = z.infer<typeof trial4HiddenVerifierContextSchema>;
