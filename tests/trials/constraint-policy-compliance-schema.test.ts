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
} from "../../lib/trials/constraint-policy-compliance/constants.js";
import {
  trial6ChallengePayloadSchema,
  trial6HiddenVerifierContextSchema,
  trial6PolicySpecSchema,
  trial6ResultSchema,
  trial6SignedSubmissionEnvelopeSchema,
  trial6SignedSubmissionPayloadSchema,
} from "../../lib/trials/constraint-policy-compliance/schema.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function validPolicy() {
  return {
    version: "1" as const,
    rules: [{ id: "required_country", type: "required", path: "order.country" }],
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
    nonce: encodeBase64Url(new Uint8Array(16).fill(4)),
    case: { document: { order: { country: "TR" } }, policy: validPolicy() },
    issued_at: "2026-08-30T12:00:00Z",
    expires_at: "2026-08-30T12:10:00Z",
  };
}

function validResult() {
  return {
    reason_code: "POLICY_COMPLIANT" as const,
    result: { compliant: true, violations: [], evaluated_rules: ["required_country"] },
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

describe("trial6PolicySpecSchema", () => {
  it("accepts a well-formed policy with every rule shape", () => {
    const policy = {
      version: "1" as const,
      rules: [
        { id: "a", type: "equals", path: "x", value: "y" },
        { id: "b", type: "one_of", path: "x", values: ["y", "z"] },
        { id: "c", type: "number_max", path: "x", value: 5 },
        { id: "d", type: "exists", path: "x" },
      ],
    };
    expect(trial6PolicySpecSchema.safeParse(policy).success).toBe(true);
  });

  it("accepts a rule type outside the supported vocabulary at the schema level", () => {
    expect(trial6PolicySpecSchema.safeParse({ version: "1", rules: [{ id: "a", type: "matches_regex", path: "x" }] }).success).toBe(
      true,
    );
  });

  it("rejects an unknown extra field on a rule", () => {
    const policy = { version: "1", rules: [{ id: "a", type: "exists", path: "x", extra: true }] };
    expect(trial6PolicySpecSchema.safeParse(policy).success).toBe(false);
  });

  it("rejects a rule missing its id", () => {
    expect(trial6PolicySpecSchema.safeParse({ version: "1", rules: [{ type: "exists", path: "x" }] }).success).toBe(false);
  });

  it("rejects a wrong version literal", () => {
    expect(trial6PolicySpecSchema.safeParse({ version: "2", rules: [] }).success).toBe(false);
  });
});

describe("trial6ChallengePayloadSchema", () => {
  it("accepts a well-formed challenge payload", () => {
    expect(trial6ChallengePayloadSchema.safeParse(validChallengePayload()).success).toBe(true);
  });

  it("rejects an unknown extra top-level field", () => {
    expect(trial6ChallengePayloadSchema.safeParse({ ...validChallengePayload(), extra: 1 }).success).toBe(false);
  });

  it("rejects a wrong capability_id", () => {
    expect(trial6ChallengePayloadSchema.safeParse({ ...validChallengePayload(), capability_id: "something.else" }).success).toBe(
      false,
    );
  });

  it("rejects a trial_id outside the historical/production pair", () => {
    expect(trial6ChallengePayloadSchema.safeParse({ ...validChallengePayload(), trial_id: "unknown-trial" }).success).toBe(false);
  });

  it("rejects a malformed challenge_id", () => {
    expect(trial6ChallengePayloadSchema.safeParse({ ...validChallengePayload(), challenge_id: "NOT-A-UUID" }).success).toBe(false);
  });
});

describe("trial6ResultSchema", () => {
  it("accepts a well-formed result, including a null result for a structural failure", () => {
    expect(trial6ResultSchema.safeParse(validResult()).success).toBe(true);
    expect(trial6ResultSchema.safeParse({ reason_code: "INVALID_POLICY", result: null }).success).toBe(true);
  });

  it("accepts a non-compliant result with violations", () => {
    const result = {
      reason_code: "POLICY_VIOLATION",
      result: { compliant: false, violations: [{ rule_id: "amount_limit", reason: "NUMBER_MAX_VIOLATION" }], evaluated_rules: ["amount_limit"] },
    };
    expect(trial6ResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects an invalid reason_code", () => {
    expect(trial6ResultSchema.safeParse({ ...validResult(), reason_code: "MAYBE" }).success).toBe(false);
  });

  it("rejects an invalid violation reason", () => {
    const result = {
      reason_code: "POLICY_VIOLATION",
      result: { compliant: false, violations: [{ rule_id: "x", reason: "NOT_A_REAL_REASON" }], evaluated_rules: ["x"] },
    };
    expect(trial6ResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects an extra field", () => {
    expect(trial6ResultSchema.safeParse({ ...validResult(), extra: 1 }).success).toBe(false);
  });
});

describe("trial6HiddenVerifierContextSchema", () => {
  it("accepts a well-formed hidden context for every case class", () => {
    for (const caseClass of ["COMPLIANT", "SINGLE_VIOLATION", "MULTIPLE_VIOLATIONS", "UNSUPPORTED_RULE", "INVALID_POLICY"]) {
      expect(
        trial6HiddenVerifierContextSchema.safeParse({
          case_class: caseClass,
          expected_reason_code: "POLICY_COMPLIANT",
          expected_result: null,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects an unknown case_class", () => {
    expect(
      trial6HiddenVerifierContextSchema.safeParse({
        case_class: "NOT_A_CASE",
        expected_reason_code: "POLICY_COMPLIANT",
        expected_result: null,
      }).success,
    ).toBe(false);
  });
});

describe("trial6SignedSubmissionPayloadSchema and envelope", () => {
  it("accepts a well-formed submission payload and envelope", () => {
    expect(trial6SignedSubmissionPayloadSchema.safeParse(validSubmissionPayload()).success).toBe(true);
    const envelope = {
      payload: validSubmissionPayload(),
      signature: { algorithm: "Ed25519" as const, encoding: "base64url" as const, value: encodeBase64Url(new Uint8Array(64)) },
    };
    expect(trial6SignedSubmissionEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it("rejects a wrong canonicalization id", () => {
    expect(trial6SignedSubmissionPayloadSchema.safeParse({ ...validSubmissionPayload(), canonicalization: "other" }).success).toBe(
      false,
    );
  });

  it("rejects a signature value of the wrong byte length", () => {
    const envelope = {
      payload: validSubmissionPayload(),
      signature: { algorithm: "Ed25519" as const, encoding: "base64url" as const, value: encodeBase64Url(new Uint8Array(63)) },
    };
    expect(trial6SignedSubmissionEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });
});
