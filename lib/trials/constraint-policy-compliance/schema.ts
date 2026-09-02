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

export const trial6IdSchema = z.enum([TRIAL_ID, PRODUCTION_TRIAL_ID]);
export type Trial6Id = z.infer<typeof trial6IdSchema>;

export const trial6CaseClassSchema = z.enum([
  "COMPLIANT",
  "SINGLE_VIOLATION",
  "MULTIPLE_VIOLATIONS",
  "UNSUPPORTED_RULE",
  "INVALID_POLICY",
]);
export type Trial6CaseClass = z.infer<typeof trial6CaseClassSchema>;

/**
 * `rule.type` is a bare string, not a literal enum: the UNSUPPORTED_RULE
 * case class deliberately uses a rule type outside the supported set, and
 * that must remain a data-dependent runtime failure (matching the task's
 * required reason code), not a schema rejection.
 */
const policyRuleSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  path: z.string().min(1),
  value: jsonValueSchema.optional(),
  values: z.array(jsonValueSchema).optional(),
}).strict();

export const trial6PolicySpecSchema = z.object({
  version: z.literal("1"),
  rules: z.array(policyRuleSchema),
}).strict();
export type Trial6PolicySpec = z.infer<typeof trial6PolicySpecSchema>;

export const trial6ChallengeCaseSchema = z.object({
  document: jsonValueSchema,
  policy: trial6PolicySpecSchema,
}).strict();
export type Trial6ChallengeCase = z.infer<typeof trial6ChallengeCaseSchema>;

export const trial6ChallengePayloadSchema = z.object({
  challenge_version: z.literal(CHALLENGE_VERSION),
  challenge_id: uuidSchema,
  agent_did: didSchema,
  capability_id: z.literal(CAPABILITY_ID),
  trial_id: trial6IdSchema,
  trial_version: z.literal(TRIAL_VERSION),
  nonce: base64UrlSchema(),
  case: trial6ChallengeCaseSchema,
  issued_at: timestampSchema,
  expires_at: timestampSchema,
}).strict();
export type Trial6ChallengePayload = z.infer<typeof trial6ChallengePayloadSchema>;

const policyReasonCodeSchema = z.enum(["POLICY_COMPLIANT", "POLICY_VIOLATION", "INVALID_POLICY", "UNSUPPORTED_RULE"]);

const violationReasonCodeSchema = z.enum([
  "REQUIRED_VALUE_MISSING",
  "VALUE_MISMATCH",
  "VALUE_NOT_ALLOWED",
  "NUMBER_MIN_VIOLATION",
  "NUMBER_MAX_VIOLATION",
  "STRING_LENGTH_VIOLATION",
  "ARRAY_SIZE_VIOLATION",
  "PATH_EXISTENCE_VIOLATION",
]);

const violationSchema = z.object({
  rule_id: z.string().min(1),
  reason: violationReasonCodeSchema,
}).strict();

const complianceResultSchema = z.object({
  compliant: z.boolean(),
  violations: z.array(violationSchema),
  evaluated_rules: z.array(z.string()),
}).strict();

export const trial6ResultSchema = z.object({
  reason_code: policyReasonCodeSchema,
  result: complianceResultSchema.nullable(),
}).strict();
export type Trial6Result = z.infer<typeof trial6ResultSchema>;

export const trial6SignedSubmissionPayloadSchema = z.object({
  submission_version: z.literal(SUBMISSION_VERSION),
  canonicalization: z.literal(CANONICALIZATION_ID),
  challenge_id: uuidSchema,
  challenge_hash: sha256HashSchema,
  agent_did: z.string().min(1),
  trial_id: trial6IdSchema,
  trial_version: z.literal(TRIAL_VERSION),
  result: trial6ResultSchema,
  submitted_at: timestampSchema,
}).strict();
export type Trial6SignedSubmissionPayload = z.infer<typeof trial6SignedSubmissionPayloadSchema>;

export const trial6SubmissionSignatureSchema = z.object({
  algorithm: z.literal("Ed25519"),
  encoding: z.literal("base64url"),
  value: base64UrlSchema(ED25519_SIGNATURE_LENGTH),
}).strict();

export const trial6SignedSubmissionEnvelopeSchema = z.object({
  payload: trial6SignedSubmissionPayloadSchema,
  signature: trial6SubmissionSignatureSchema,
}).strict();
export type Trial6SignedSubmissionEnvelope = z.infer<typeof trial6SignedSubmissionEnvelopeSchema>;

export const trial6HiddenVerifierContextSchema = z.object({
  case_class: trial6CaseClassSchema,
  expected_reason_code: policyReasonCodeSchema,
  expected_result: complianceResultSchema.nullable(),
}).strict();
export type Trial6HiddenVerifierContext = z.infer<typeof trial6HiddenVerifierContextSchema>;
