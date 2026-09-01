import { z } from "zod";
import { decodeBase64Url } from "../../crypto/base64url.js";
import { ED25519_SIGNATURE_LENGTH } from "../../crypto/ed25519.js";
import { isSha256Hash } from "../../crypto/sha256.js";
import { parseEd25519DidKey } from "../../identity/did-key.js";
import {
  CANONICALIZATION_ID,
  CAPABILITY_ID,
  CHALLENGE_VERSION,
  PRODUCTION_TRIAL_ID,
  SUBMISSION_VERSION,
  TRIAL_ID,
  TRIAL_VERSION,
} from "./constants.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uuidSchema = z.string().regex(UUID_PATTERN, "must be a lowercase UUID");
const rfc3339TimestampSchema = z.string().datetime({ message: "must be an RFC 3339 UTC timestamp" });

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

const jsonPrimitiveSchema = z.union([z.null(), z.boolean(), z.number().finite(), z.string()]);
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

export const trial2IdSchema = z.enum([TRIAL_ID, PRODUCTION_TRIAL_ID]);
export type Trial2Id = z.infer<typeof trial2IdSchema>;

export const trial2CaseClassSchema = z.enum([
  "NESTED_OBJECT",
  "UNICODE_KEYS",
  "ARRAY_MIX",
  "NUMERIC_EDGE",
]);
export type Trial2CaseClass = z.infer<typeof trial2CaseClassSchema>;

export const trial2ChallengeCaseSchema = z
  .object({
    document: jsonValueSchema,
  })
  .strict();
export type Trial2ChallengeCase = z.infer<typeof trial2ChallengeCaseSchema>;

export const trial2ChallengePayloadSchema = z
  .object({
    challenge_version: z.literal(CHALLENGE_VERSION),
    challenge_id: uuidSchema,
    agent_did: ed25519DidKeySchema,
    capability_id: z.literal(CAPABILITY_ID),
    trial_id: trial2IdSchema,
    trial_version: z.literal(TRIAL_VERSION),
    nonce: base64UrlSchema(),
    case: trial2ChallengeCaseSchema,
    issued_at: rfc3339TimestampSchema,
    expires_at: rfc3339TimestampSchema,
  })
  .strict();
export type Trial2ChallengePayload = z.infer<typeof trial2ChallengePayloadSchema>;

export const trial2ResultSchema = z
  .object({
    canonical_json: z.string().min(1),
    sha256: sha256HashSchema,
  })
  .strict();
export type Trial2Result = z.infer<typeof trial2ResultSchema>;

export const trial2SignedSubmissionPayloadSchema = z
  .object({
    submission_version: z.literal(SUBMISSION_VERSION),
    canonicalization: z.literal(CANONICALIZATION_ID),
    challenge_id: uuidSchema,
    challenge_hash: sha256HashSchema,
    agent_did: z.string().min(1),
    trial_id: trial2IdSchema,
    trial_version: z.literal(TRIAL_VERSION),
    result: trial2ResultSchema,
    submitted_at: rfc3339TimestampSchema,
  })
  .strict();
export type Trial2SignedSubmissionPayload = z.infer<typeof trial2SignedSubmissionPayloadSchema>;

export const trial2SubmissionSignatureSchema = z
  .object({
    algorithm: z.literal("Ed25519"),
    encoding: z.literal("base64url"),
    value: base64UrlSchema(ED25519_SIGNATURE_LENGTH),
  })
  .strict();

export const trial2SignedSubmissionEnvelopeSchema = z
  .object({
    payload: trial2SignedSubmissionPayloadSchema,
    signature: trial2SubmissionSignatureSchema,
  })
  .strict();
export type Trial2SignedSubmissionEnvelope = z.infer<typeof trial2SignedSubmissionEnvelopeSchema>;

export const trial2HiddenVerifierContextSchema = z
  .object({
    case_class: trial2CaseClassSchema,
    expected_canonical_json: z.string().min(1),
    expected_sha256: sha256HashSchema,
  })
  .strict();
export type Trial2HiddenVerifierContext = z.infer<typeof trial2HiddenVerifierContextSchema>;
