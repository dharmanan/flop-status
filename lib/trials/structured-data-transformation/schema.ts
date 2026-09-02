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
const timestampSchema = z.string().datetime({ message: "must be an RFC 3339 UTC timestamp" });
const sha256HashSchema = z.string().refine(isSha256Hash, { message: "must be a sha256:<base64url> hash" });

const didSchema = z.string().refine(
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
    { message: exactByteLength === undefined ? "must be unpadded base64url" : `must decode to exactly ${exactByteLength} bytes` },
  );
}

const jsonPrimitiveSchema = z.union([z.null(), z.boolean(), z.number().finite(), z.string()]);
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

export const trial5IdSchema = z.enum([TRIAL_ID, PRODUCTION_TRIAL_ID]);
export type Trial5Id = z.infer<typeof trial5IdSchema>;

export const trial5CaseClassSchema = z.enum([
  "VALID",
  "SOURCE_PATH_MISSING",
  "INVALID_TYPE_COERCION",
  "UNSUPPORTED_OPERATION",
  "TARGET_PATH_CONFLICT",
]);
export type Trial5CaseClass = z.infer<typeof trial5CaseClassSchema>;

/**
 * `op.op` is a bare string, not a literal enum: the UNSUPPORTED_OPERATION
 * case class deliberately uses an operation name outside the supported set,
 * and that must remain a data-dependent runtime failure (matching the task's
 * required reason code), not a schema rejection.
 */
const transformFieldSpecSchema = z.object({
  from: z.string().min(1),
  type: z.enum(["string", "integer", "number", "boolean"]),
}).strict();

const transformOperationSchema = z.object({
  op: z.string().min(1),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
  value: jsonValueSchema.optional(),
  fields: z.record(transformFieldSpecSchema).optional(),
}).strict();

export const trial5TransformSpecSchema = z.object({
  version: z.literal("1"),
  operations: z.array(transformOperationSchema),
}).strict();
export type Trial5TransformSpec = z.infer<typeof trial5TransformSpecSchema>;

export const trial5ChallengeCaseSchema = z.object({
  source: jsonValueSchema,
  spec: trial5TransformSpecSchema,
}).strict();
export type Trial5ChallengeCase = z.infer<typeof trial5ChallengeCaseSchema>;

export const trial5ChallengePayloadSchema = z.object({
  challenge_version: z.literal(CHALLENGE_VERSION),
  challenge_id: uuidSchema,
  agent_did: didSchema,
  capability_id: z.literal(CAPABILITY_ID),
  trial_id: trial5IdSchema,
  trial_version: z.literal(TRIAL_VERSION),
  nonce: base64UrlSchema(),
  case: trial5ChallengeCaseSchema,
  issued_at: timestampSchema,
  expires_at: timestampSchema,
}).strict();
export type Trial5ChallengePayload = z.infer<typeof trial5ChallengePayloadSchema>;

const transformReasonCodeSchema = z.enum([
  "TRANSFORMATION_MATCH",
  "SOURCE_PATH_MISSING",
  "INVALID_TYPE_COERCION",
  "INVALID_TRANSFORMATION_SPEC",
  "UNSUPPORTED_OPERATION",
  "TARGET_PATH_CONFLICT",
]);

export const trial5ResultSchema = z.object({
  reason_code: transformReasonCodeSchema,
  result: jsonValueSchema.nullable(),
}).strict();
export type Trial5Result = z.infer<typeof trial5ResultSchema>;

export const trial5SignedSubmissionPayloadSchema = z.object({
  submission_version: z.literal(SUBMISSION_VERSION),
  canonicalization: z.literal(CANONICALIZATION_ID),
  challenge_id: uuidSchema,
  challenge_hash: sha256HashSchema,
  agent_did: z.string().min(1),
  trial_id: trial5IdSchema,
  trial_version: z.literal(TRIAL_VERSION),
  result: trial5ResultSchema,
  submitted_at: timestampSchema,
}).strict();
export type Trial5SignedSubmissionPayload = z.infer<typeof trial5SignedSubmissionPayloadSchema>;

export const trial5SubmissionSignatureSchema = z.object({
  algorithm: z.literal("Ed25519"),
  encoding: z.literal("base64url"),
  value: base64UrlSchema(ED25519_SIGNATURE_LENGTH),
}).strict();

export const trial5SignedSubmissionEnvelopeSchema = z.object({
  payload: trial5SignedSubmissionPayloadSchema,
  signature: trial5SubmissionSignatureSchema,
}).strict();
export type Trial5SignedSubmissionEnvelope = z.infer<typeof trial5SignedSubmissionEnvelopeSchema>;

export const trial5HiddenVerifierContextSchema = z.object({
  case_class: trial5CaseClassSchema,
  expected_reason_code: transformReasonCodeSchema,
  expected_result: jsonValueSchema.nullable(),
}).strict();
export type Trial5HiddenVerifierContext = z.infer<typeof trial5HiddenVerifierContextSchema>;
