import { z } from "zod";
import { decodeBase64Url } from "../../crypto/base64url.js";
import { ED25519_PUBLIC_KEY_LENGTH, ED25519_SIGNATURE_LENGTH } from "../../crypto/ed25519.js";
import { isSha256Hash } from "../../crypto/sha256.js";
import { parseEd25519DidKey } from "../../identity/did-key.js";
import {
  CANONICALIZATION_ID,
  CAPABILITY_ID,
  CHALLENGE_VERSION,
  SUBMISSION_VERSION,
  TRIAL_ID,
  TRIAL_VERSION,
} from "./constants.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const uuidSchema = z.string().regex(UUID_PATTERN, "must be a lowercase UUID");

const rfc3339TimestampSchema = z
  .string()
  .datetime({ message: "must be an RFC 3339 UTC timestamp" });

const ed25519DidKeySchema = z.string().refine(
  (value) => {
    try {
      parseEd25519DidKey(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "must be a supported Ed25519 did:key" },
);

function base64UrlSchema(exactByteLength?: number) {
  return z.string().refine(
    (value) => {
      try {
        const bytes = decodeBase64Url(value);
        return exactByteLength === undefined || bytes.length === exactByteLength;
      } catch {
        return false;
      }
    },
    {
      message:
        exactByteLength === undefined
          ? "must be unpadded base64url"
          : `must be unpadded base64url decoding to exactly ${exactByteLength} bytes`,
    },
  );
}

const sha256HashSchema = z.string().refine(isSha256Hash, {
  message: "must be a sha256:<base64url> hash",
});

export const trial1ChallengeCaseSchema = z
  .object({
    algorithm: z.literal("Ed25519"),
    public_key: base64UrlSchema(ED25519_PUBLIC_KEY_LENGTH),
    message: base64UrlSchema(),
    signature: base64UrlSchema(ED25519_SIGNATURE_LENGTH),
  })
  .strict();

export type Trial1ChallengeCase = z.infer<typeof trial1ChallengeCaseSchema>;

export const trial1ChallengePayloadSchema = z
  .object({
    challenge_version: z.literal(CHALLENGE_VERSION),
    challenge_id: uuidSchema,
    agent_did: ed25519DidKeySchema,
    capability_id: z.literal(CAPABILITY_ID),
    trial_id: z.literal(TRIAL_ID),
    trial_version: z.literal(TRIAL_VERSION),
    nonce: base64UrlSchema(),
    case: trial1ChallengeCaseSchema,
    issued_at: rfc3339TimestampSchema,
    expires_at: rfc3339TimestampSchema,
  })
  .strict();

export type Trial1ChallengePayload = z.infer<typeof trial1ChallengePayloadSchema>;

const reasonCodeSchema = z.enum(["SIGNATURE_VALID", "SIGNATURE_INVALID"]);

export const trial1ResultSchema = z
  .object({
    valid: z.boolean(),
    reason_code: reasonCodeSchema,
    message_hash: sha256HashSchema,
  })
  .strict();

export type Trial1Result = z.infer<typeof trial1ResultSchema>;

export const trial1SignedSubmissionPayloadSchema = z
  .object({
    submission_version: z.literal(SUBMISSION_VERSION),
    canonicalization: z.literal(CANONICALIZATION_ID),
    challenge_id: uuidSchema,
    challenge_hash: sha256HashSchema,
    agent_did: ed25519DidKeySchema,
    trial_id: z.literal(TRIAL_ID),
    trial_version: z.literal(TRIAL_VERSION),
    result: trial1ResultSchema,
    submitted_at: rfc3339TimestampSchema,
  })
  .strict();

export type Trial1SignedSubmissionPayload = z.infer<typeof trial1SignedSubmissionPayloadSchema>;

export const trial1SubmissionSignatureSchema = z
  .object({
    algorithm: z.literal("Ed25519"),
    encoding: z.literal("base64url"),
    value: base64UrlSchema(ED25519_SIGNATURE_LENGTH),
  })
  .strict();

export type Trial1SubmissionSignature = z.infer<typeof trial1SubmissionSignatureSchema>;

export const trial1SignedSubmissionEnvelopeSchema = z
  .object({
    payload: trial1SignedSubmissionPayloadSchema,
    signature: trial1SubmissionSignatureSchema,
  })
  .strict();

export type Trial1SignedSubmissionEnvelope = z.infer<typeof trial1SignedSubmissionEnvelopeSchema>;
