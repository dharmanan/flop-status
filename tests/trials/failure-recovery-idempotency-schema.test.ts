import { describe, expect, it } from "vitest";
import { encodeBase64Url } from "../../lib/crypto/base64url.js";
import { sha256 } from "../../lib/crypto/sha256.js";
import {
  CANONICALIZATION_ID,
  CAPABILITY_ID,
  CHALLENGE_VERSION,
  SUBMISSION_VERSION,
  TRIAL_ID,
  TRIAL_VERSION,
} from "../../lib/trials/failure-recovery-idempotency/constants.js";
import {
  trial7ChallengePayloadSchema,
  trial7HiddenVerifierContextSchema,
  trial7ResultSchema,
  trial7ScenarioSchema,
  trial7SignedSubmissionEnvelopeSchema,
  trial7SignedSubmissionPayloadSchema,
} from "../../lib/trials/failure-recovery-idempotency/schema.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function validScenario() {
  return {
    operation: { idempotency_key: "op_1", type: "increment", path: "balance", amount: 25 },
    initial_state: { balance: 100 },
    attempt_plan: [{ attempt: 1, outcome: "SUCCESS" as const }],
    retry_policy: { max_attempts: 3, retry_on: ["TRANSIENT_FAILURE" as const] },
  };
}

function validChallengePayload() {
  const identity = generateTestEd25519Identity();
  return {
    challenge_version: CHALLENGE_VERSION,
    challenge_id: "5b1e6f2a-4c1a-4a4a-9c2a-1a2b3c4d5e6f",
    agent_did: identity.did,
    capability_id: CAPABILITY_ID,
    trial_id: TRIAL_ID,
    trial_version: TRIAL_VERSION,
    nonce: encodeBase64Url(new Uint8Array(16).fill(5)),
    case: validScenario(),
    issued_at: "2026-08-30T12:00:00Z",
    expires_at: "2026-08-30T12:10:00Z",
  };
}

function validResult() {
  return {
    reason_code: "RECOVERY_SUCCESS" as const,
    result: {
      status: "COMMITTED" as const,
      final_state: { balance: 125 },
      applied_count: 1,
      idempotency_key: "op_1",
      attempts: [{ attempt: 1, status: "APPLIED" as const }],
    },
  };
}

function validSubmissionPayload() {
  return {
    submission_version: SUBMISSION_VERSION,
    canonicalization: CANONICALIZATION_ID,
    challenge_id: "5b1e6f2a-4c1a-4a4a-9c2a-1a2b3c4d5e6f",
    challenge_hash: sha256(new TextEncoder().encode("challenge payload bytes")),
    agent_did: generateTestEd25519Identity().did,
    trial_id: TRIAL_ID,
    trial_version: TRIAL_VERSION,
    result: validResult(),
    submitted_at: "2026-08-30T12:01:00Z",
  };
}

describe("trial7ScenarioSchema", () => {
  it("accepts a well-formed scenario", () => {
    expect(trial7ScenarioSchema.safeParse(validScenario()).success).toBe(true);
  });

  it("accepts an operation type outside the supported vocabulary at the schema level", () => {
    const scenario = { ...validScenario(), operation: { ...validScenario().operation, type: "delete" } };
    expect(trial7ScenarioSchema.safeParse(scenario).success).toBe(true);
  });

  it("rejects an unknown extra field on the operation", () => {
    const scenario = { ...validScenario(), operation: { ...validScenario().operation, extra: true } };
    expect(trial7ScenarioSchema.safeParse(scenario).success).toBe(false);
  });

  it("rejects a non-positive attempt number", () => {
    const scenario = { ...validScenario(), attempt_plan: [{ attempt: 0, outcome: "SUCCESS" }] };
    expect(trial7ScenarioSchema.safeParse(scenario).success).toBe(false);
  });

  it("rejects an unknown attempt outcome", () => {
    const scenario = { ...validScenario(), attempt_plan: [{ attempt: 1, outcome: "MAYBE" }] };
    expect(trial7ScenarioSchema.safeParse(scenario).success).toBe(false);
  });

  it("rejects a retry policy with a non-positive max_attempts", () => {
    const scenario = { ...validScenario(), retry_policy: { max_attempts: 0, retry_on: ["TRANSIENT_FAILURE"] } };
    expect(trial7ScenarioSchema.safeParse(scenario).success).toBe(false);
  });
});

describe("trial7ChallengePayloadSchema", () => {
  it("accepts a well-formed challenge payload", () => {
    expect(trial7ChallengePayloadSchema.safeParse(validChallengePayload()).success).toBe(true);
  });

  it("rejects an unknown extra top-level field", () => {
    expect(trial7ChallengePayloadSchema.safeParse({ ...validChallengePayload(), extra: 1 }).success).toBe(false);
  });

  it("rejects a wrong capability_id", () => {
    expect(trial7ChallengePayloadSchema.safeParse({ ...validChallengePayload(), capability_id: "something.else" }).success).toBe(
      false,
    );
  });

  it("rejects a trial_id outside the historical/production pair", () => {
    expect(trial7ChallengePayloadSchema.safeParse({ ...validChallengePayload(), trial_id: "unknown-trial" }).success).toBe(false);
  });

  it("rejects a malformed challenge_id", () => {
    expect(trial7ChallengePayloadSchema.safeParse({ ...validChallengePayload(), challenge_id: "NOT-A-UUID" }).success).toBe(false);
  });
});

describe("trial7ResultSchema", () => {
  it("accepts a well-formed result, including a null result for a structural failure", () => {
    expect(trial7ResultSchema.safeParse(validResult()).success).toBe(true);
    expect(trial7ResultSchema.safeParse({ reason_code: "INVALID_ATTEMPT_PLAN", result: null }).success).toBe(true);
  });

  it("rejects an invalid reason_code", () => {
    expect(trial7ResultSchema.safeParse({ ...validResult(), reason_code: "MAYBE" }).success).toBe(false);
  });

  it("rejects an invalid attempt status", () => {
    const result = { ...validResult(), result: { ...validResult().result, attempts: [{ attempt: 1, status: "MAYBE" }] } };
    expect(trial7ResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects an extra field", () => {
    expect(trial7ResultSchema.safeParse({ ...validResult(), extra: 1 }).success).toBe(false);
  });
});

describe("trial7HiddenVerifierContextSchema", () => {
  it("accepts a well-formed hidden context for every case class", () => {
    for (const caseClass of [
      "SUCCESS_FIRST_ATTEMPT",
      "RECOVER_THEN_SUCCEED",
      "DUPLICATE_AFTER_SUCCESS",
      "RETRY_LIMIT_EXCEEDED",
      "PERMANENT_FAILURE",
    ]) {
      expect(
        trial7HiddenVerifierContextSchema.safeParse({
          case_class: caseClass,
          expected_reason_code: "RECOVERY_SUCCESS",
          expected_result: null,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects an unknown case_class", () => {
    expect(
      trial7HiddenVerifierContextSchema.safeParse({
        case_class: "NOT_A_CASE",
        expected_reason_code: "RECOVERY_SUCCESS",
        expected_result: null,
      }).success,
    ).toBe(false);
  });
});

describe("trial7SignedSubmissionPayloadSchema and envelope", () => {
  it("accepts a well-formed submission payload and envelope", () => {
    expect(trial7SignedSubmissionPayloadSchema.safeParse(validSubmissionPayload()).success).toBe(true);
    const envelope = {
      payload: validSubmissionPayload(),
      signature: { algorithm: "Ed25519" as const, encoding: "base64url" as const, value: encodeBase64Url(new Uint8Array(64)) },
    };
    expect(trial7SignedSubmissionEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it("rejects a wrong canonicalization id", () => {
    expect(trial7SignedSubmissionPayloadSchema.safeParse({ ...validSubmissionPayload(), canonicalization: "other" }).success).toBe(
      false,
    );
  });

  it("rejects a signature value of the wrong byte length", () => {
    const envelope = {
      payload: validSubmissionPayload(),
      signature: { algorithm: "Ed25519" as const, encoding: "base64url" as const, value: encodeBase64Url(new Uint8Array(63)) },
    };
    expect(trial7SignedSubmissionEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });
});
