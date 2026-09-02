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
} from "../../lib/trials/structured-data-transformation/constants.js";
import {
  trial5ChallengePayloadSchema,
  trial5HiddenVerifierContextSchema,
  trial5ResultSchema,
  trial5SignedSubmissionEnvelopeSchema,
  trial5SignedSubmissionPayloadSchema,
  trial5TransformSpecSchema,
} from "../../lib/trials/structured-data-transformation/schema.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function validSpec() {
  return {
    version: "1" as const,
    operations: [{ op: "copy", from: "customer.name", to: "buyer.name" }],
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
    nonce: encodeBase64Url(new Uint8Array(16).fill(3)),
    case: { source: { customer: { name: "Ada" } }, spec: validSpec() },
    issued_at: "2026-08-30T12:00:00Z",
    expires_at: "2026-08-30T12:10:00Z",
  };
}

function validResult() {
  return { reason_code: "TRANSFORMATION_MATCH" as const, result: { buyer: { name: "Ada" } } };
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

describe("trial5TransformSpecSchema", () => {
  it("accepts a well-formed spec with every operation shape", () => {
    const spec = {
      version: "1" as const,
      operations: [
        { op: "copy", from: "a", to: "b" },
        { op: "rename", from: "a", to: "b" },
        { op: "set", to: "b", value: 1 },
        { op: "remove", from: "a" },
        { op: "map_array", from: "items", to: "lines", fields: { sku: { from: "sku", type: "string" as const } } },
      ],
    };
    expect(trial5TransformSpecSchema.safeParse(spec).success).toBe(true);
  });

  it("accepts an op string outside the supported vocabulary at the schema level", () => {
    expect(trial5TransformSpecSchema.safeParse({ version: "1", operations: [{ op: "eval" }] }).success).toBe(true);
  });

  it("rejects an unknown extra field on an operation", () => {
    const spec = { version: "1", operations: [{ op: "copy", from: "a", to: "b", extra: true }] };
    expect(trial5TransformSpecSchema.safeParse(spec).success).toBe(false);
  });

  it("rejects an unsupported coercion type inside fields", () => {
    const spec = { version: "1", operations: [{ op: "map_array", from: "a", to: "b", fields: { x: { from: "y", type: "date" } } }] };
    expect(trial5TransformSpecSchema.safeParse(spec).success).toBe(false);
  });

  it("rejects a wrong version literal", () => {
    expect(trial5TransformSpecSchema.safeParse({ version: "2", operations: [] }).success).toBe(false);
  });
});

describe("trial5ChallengePayloadSchema", () => {
  it("accepts a well-formed challenge payload", () => {
    expect(trial5ChallengePayloadSchema.safeParse(validChallengePayload()).success).toBe(true);
  });

  it("rejects an unknown extra top-level field", () => {
    expect(trial5ChallengePayloadSchema.safeParse({ ...validChallengePayload(), extra: 1 }).success).toBe(false);
  });

  it("rejects a wrong capability_id", () => {
    expect(trial5ChallengePayloadSchema.safeParse({ ...validChallengePayload(), capability_id: "something.else" }).success).toBe(
      false,
    );
  });

  it("rejects a trial_id outside the historical/production pair", () => {
    expect(trial5ChallengePayloadSchema.safeParse({ ...validChallengePayload(), trial_id: "unknown-trial" }).success).toBe(false);
  });

  it("rejects a non-RFC3339 issued_at", () => {
    expect(trial5ChallengePayloadSchema.safeParse({ ...validChallengePayload(), issued_at: "not-a-date" }).success).toBe(false);
  });

  it("rejects a malformed challenge_id", () => {
    expect(trial5ChallengePayloadSchema.safeParse({ ...validChallengePayload(), challenge_id: "NOT-A-UUID" }).success).toBe(false);
  });
});

describe("trial5ResultSchema", () => {
  it("accepts a well-formed result, including a null result payload", () => {
    expect(trial5ResultSchema.safeParse(validResult()).success).toBe(true);
    expect(trial5ResultSchema.safeParse({ reason_code: "SOURCE_PATH_MISSING", result: null }).success).toBe(true);
  });

  it("rejects an invalid reason_code", () => {
    expect(trial5ResultSchema.safeParse({ ...validResult(), reason_code: "MAYBE" }).success).toBe(false);
  });

  it("rejects an extra field", () => {
    expect(trial5ResultSchema.safeParse({ ...validResult(), extra: 1 }).success).toBe(false);
  });
});

describe("trial5HiddenVerifierContextSchema", () => {
  it("accepts a well-formed hidden context for every case class", () => {
    for (const caseClass of ["VALID", "SOURCE_PATH_MISSING", "INVALID_TYPE_COERCION", "UNSUPPORTED_OPERATION", "TARGET_PATH_CONFLICT"]) {
      expect(
        trial5HiddenVerifierContextSchema.safeParse({
          case_class: caseClass,
          expected_reason_code: "TRANSFORMATION_MATCH",
          expected_result: null,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects an unknown case_class", () => {
    expect(
      trial5HiddenVerifierContextSchema.safeParse({
        case_class: "NOT_A_CASE",
        expected_reason_code: "TRANSFORMATION_MATCH",
        expected_result: null,
      }).success,
    ).toBe(false);
  });
});

describe("trial5SignedSubmissionPayloadSchema and envelope", () => {
  it("accepts a well-formed submission payload and envelope", () => {
    expect(trial5SignedSubmissionPayloadSchema.safeParse(validSubmissionPayload()).success).toBe(true);
    const envelope = {
      payload: validSubmissionPayload(),
      signature: { algorithm: "Ed25519" as const, encoding: "base64url" as const, value: encodeBase64Url(new Uint8Array(64)) },
    };
    expect(trial5SignedSubmissionEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it("rejects a wrong canonicalization id", () => {
    expect(trial5SignedSubmissionPayloadSchema.safeParse({ ...validSubmissionPayload(), canonicalization: "other" }).success).toBe(
      false,
    );
  });

  it("rejects a signature value of the wrong byte length", () => {
    const envelope = {
      payload: validSubmissionPayload(),
      signature: { algorithm: "Ed25519" as const, encoding: "base64url" as const, value: encodeBase64Url(new Uint8Array(63)) },
    };
    expect(trial5SignedSubmissionEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });
});
