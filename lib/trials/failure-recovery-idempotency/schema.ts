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

export const trial7IdSchema = z.enum([TRIAL_ID, PRODUCTION_TRIAL_ID]);
export type Trial7Id = z.infer<typeof trial7IdSchema>;

export const trial7CaseClassSchema = z.enum([
  "SUCCESS_FIRST_ATTEMPT",
  "RECOVER_THEN_SUCCEED",
  "DUPLICATE_AFTER_SUCCESS",
  "RETRY_LIMIT_EXCEEDED",
  "PERMANENT_FAILURE",
]);
export type Trial7CaseClass = z.infer<typeof trial7CaseClassSchema>;

const attemptOutcomeSchema = z.enum(["SUCCESS", "TRANSIENT_FAILURE", "PERMANENT_FAILURE", "DUPLICATE_DELIVERY"]);

/**
 * `operation.type` is a bare string, not a literal enum, so a runtime
 * IDEMPOTENCY_VIOLATION (unsupported operation type) stays a data-dependent
 * engine failure rather than a schema rejection — the same deliberate
 * looseness used for `op.op` in Capability 5 and `rule.type` in Capability 6.
 */
const recoveryOperationSchema = z.object({
  idempotency_key: z.string().min(1),
  type: z.string().min(1),
  path: z.string().min(1),
  value: jsonValueSchema.optional(),
  amount: z.number().finite().optional(),
}).strict();

const attemptPlanEntrySchema = z.object({
  attempt: z.number().int().positive(),
  outcome: attemptOutcomeSchema,
}).strict();

const retryPolicySchema = z.object({
  max_attempts: z.number().int().positive(),
  retry_on: z.array(attemptOutcomeSchema),
}).strict();

export const trial7ScenarioSchema = z.object({
  operation: recoveryOperationSchema,
  initial_state: jsonValueSchema,
  attempt_plan: z.array(attemptPlanEntrySchema),
  retry_policy: retryPolicySchema,
}).strict();
export type Trial7Scenario = z.infer<typeof trial7ScenarioSchema>;

export const trial7ChallengePayloadSchema = z.object({
  challenge_version: z.literal(CHALLENGE_VERSION),
  challenge_id: uuidSchema,
  agent_did: didSchema,
  capability_id: z.literal(CAPABILITY_ID),
  trial_id: trial7IdSchema,
  trial_version: z.literal(TRIAL_VERSION),
  nonce: base64UrlSchema(),
  case: trial7ScenarioSchema,
  issued_at: timestampSchema,
  expires_at: timestampSchema,
}).strict();
export type Trial7ChallengePayload = z.infer<typeof trial7ChallengePayloadSchema>;

const recoveryReasonCodeSchema = z.enum([
  "RECOVERY_SUCCESS",
  "IDEMPOTENT_REPLAY",
  "RETRY_LIMIT_EXCEEDED",
  "PERMANENT_FAILURE",
  "INVALID_ATTEMPT_PLAN",
  "INVALID_RETRY_POLICY",
  "IDEMPOTENCY_VIOLATION",
]);

const attemptStatusSchema = z.enum(["APPLIED", "RETRYABLE_FAILURE", "PERMANENT_FAILURE", "DUPLICATE_REPLAY"]);

const attemptRecordSchema = z.object({
  attempt: z.number().int().positive(),
  status: attemptStatusSchema,
}).strict();

const recoveryResultDataSchema = z.object({
  status: z.enum(["COMMITTED", "FAILED"]),
  final_state: jsonValueSchema,
  applied_count: z.number().int().nonnegative(),
  idempotency_key: z.string().min(1),
  attempts: z.array(attemptRecordSchema),
}).strict();

export const trial7ResultSchema = z.object({
  reason_code: recoveryReasonCodeSchema,
  result: recoveryResultDataSchema.nullable(),
}).strict();
export type Trial7Result = z.infer<typeof trial7ResultSchema>;

export const trial7SignedSubmissionPayloadSchema = z.object({
  submission_version: z.literal(SUBMISSION_VERSION),
  canonicalization: z.literal(CANONICALIZATION_ID),
  challenge_id: uuidSchema,
  challenge_hash: sha256HashSchema,
  agent_did: z.string().min(1),
  trial_id: trial7IdSchema,
  trial_version: z.literal(TRIAL_VERSION),
  result: trial7ResultSchema,
  submitted_at: timestampSchema,
}).strict();
export type Trial7SignedSubmissionPayload = z.infer<typeof trial7SignedSubmissionPayloadSchema>;

export const trial7SubmissionSignatureSchema = z.object({
  algorithm: z.literal("Ed25519"),
  encoding: z.literal("base64url"),
  value: base64UrlSchema(ED25519_SIGNATURE_LENGTH),
}).strict();

export const trial7SignedSubmissionEnvelopeSchema = z.object({
  payload: trial7SignedSubmissionPayloadSchema,
  signature: trial7SubmissionSignatureSchema,
}).strict();
export type Trial7SignedSubmissionEnvelope = z.infer<typeof trial7SignedSubmissionEnvelopeSchema>;

export const trial7HiddenVerifierContextSchema = z.object({
  case_class: trial7CaseClassSchema,
  expected_reason_code: recoveryReasonCodeSchema,
  expected_result: recoveryResultDataSchema.nullable(),
}).strict();
export type Trial7HiddenVerifierContext = z.infer<typeof trial7HiddenVerifierContextSchema>;
