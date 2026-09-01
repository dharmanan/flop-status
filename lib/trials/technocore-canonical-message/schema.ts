import { z } from "zod";
import { decodeBase64Url } from "../../crypto/base64url.js";
import { ED25519_SIGNATURE_LENGTH } from "../../crypto/ed25519.js";
import { isSha256Hash } from "../../crypto/sha256.js";
import { parseEd25519DidKey } from "../../identity/did-key.js";
import { CANONICALIZATION_ID, CAPABILITY_ID, CHALLENGE_VERSION, PRODUCTION_TRIAL_ID, SUBMISSION_VERSION, TRIAL_ID, TRIAL_VERSION } from "./constants.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ROOM_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const uuidSchema = z.string().regex(UUID_PATTERN);
const timestampSchema = z.string().datetime();

const didSchema = z.string().refine((value) => {
  try { parseEd25519DidKey(value); return true; } catch { return false; }
}, { message: "must be a supported Ed25519 did:key" });

function base64UrlSchema(exactByteLength?: number) {
  return z.string().refine((value) => {
    try {
      const bytes = decodeBase64Url(value);
      return exactByteLength === undefined || bytes.length === exactByteLength;
    } catch { return false; }
  });
}

const sha256HashSchema = z.string().refine(isSha256Hash);

export const trial3IdSchema = z.enum([TRIAL_ID, PRODUCTION_TRIAL_ID]);
export type Trial3Id = z.infer<typeof trial3IdSchema>;

export const trial3CaseClassSchema = z.enum(["WHITESPACE_CONTROL", "UNICODE_TEXT", "PIPE_TEXT", "PLAIN_TEXT"]);
export type Trial3CaseClass = z.infer<typeof trial3CaseClassSchema>;

export const trial3ChallengePayloadSchema = z.object({
  challenge_version: z.literal(CHALLENGE_VERSION),
  challenge_id: uuidSchema,
  agent_did: didSchema,
  capability_id: z.literal(CAPABILITY_ID),
  trial_id: trial3IdSchema,
  trial_version: z.literal(TRIAL_VERSION),
  nonce: base64UrlSchema(),
  case: z.object({
    room: z.string().regex(ROOM_PATTERN),
    nonce: z.string().regex(/^\d{10,20}$/),
    text: z.string().min(1).max(4096),
  }).strict(),
  issued_at: timestampSchema,
  expires_at: timestampSchema,
}).strict();
export type Trial3ChallengePayload = z.infer<typeof trial3ChallengePayloadSchema>;

export const trial3ResultSchema = z.object({
  cleaned_text: z.string().min(1).max(4096),
  canonical_message: z.string().min(1).max(8192),
}).strict();
export type Trial3Result = z.infer<typeof trial3ResultSchema>;

export const trial3SignedSubmissionPayloadSchema = z.object({
  submission_version: z.literal(SUBMISSION_VERSION),
  canonicalization: z.literal(CANONICALIZATION_ID),
  challenge_id: uuidSchema,
  challenge_hash: sha256HashSchema,
  agent_did: z.string().min(1),
  trial_id: trial3IdSchema,
  trial_version: z.literal(TRIAL_VERSION),
  result: trial3ResultSchema,
  submitted_at: timestampSchema,
}).strict();

export const trial3SignedSubmissionEnvelopeSchema = z.object({
  payload: trial3SignedSubmissionPayloadSchema,
  signature: z.object({
    algorithm: z.literal("Ed25519"),
    encoding: z.literal("base64url"),
    value: base64UrlSchema(ED25519_SIGNATURE_LENGTH),
  }).strict(),
}).strict();

export const trial3HiddenVerifierContextSchema = z.object({
  case_class: trial3CaseClassSchema,
  expected_cleaned_text: z.string().min(1).max(4096),
  expected_canonical_message: z.string().min(1).max(8192),
}).strict();
export type Trial3HiddenVerifierContext = z.infer<typeof trial3HiddenVerifierContextSchema>;
