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
} from "../../lib/trials/ed25519-signature-verification/constants.js";
import {
  trial1ChallengePayloadSchema,
  trial1ResultSchema,
  trial1SignedSubmissionEnvelopeSchema,
  trial1SignedSubmissionPayloadSchema,
} from "../../lib/trials/ed25519-signature-verification/schema.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

const CHALLENGE_MESSAGE = new TextEncoder().encode("challenge message bytes");

function validChallengePayload() {
  const identity = generateTestEd25519Identity();
  const signature = identity.sign(CHALLENGE_MESSAGE);
  return {
    challenge_version: CHALLENGE_VERSION,
    challenge_id: "5b1e6f2a-4c1a-4a4a-9c2a-1a2b3c4d5e6f",
    agent_did: identity.did,
    capability_id: CAPABILITY_ID,
    trial_id: TRIAL_ID,
    trial_version: TRIAL_VERSION,
    nonce: encodeBase64Url(new Uint8Array(16).fill(9)),
    case: {
      algorithm: "Ed25519" as const,
      public_key: encodeBase64Url(identity.publicKey),
      message: encodeBase64Url(CHALLENGE_MESSAGE),
      signature: encodeBase64Url(signature),
    },
    issued_at: "2026-08-30T12:00:00Z",
    expires_at: "2026-08-30T12:10:00Z",
  };
}

function validResult() {
  return {
    valid: true,
    reason_code: "SIGNATURE_VALID" as const,
    message_hash: sha256(CHALLENGE_MESSAGE),
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

describe("trial1ChallengePayloadSchema", () => {
  it("accepts a well-formed challenge payload", () => {
    expect(trial1ChallengePayloadSchema.safeParse(validChallengePayload()).success).toBe(true);
  });

  it("rejects an unknown extra top-level field", () => {
    const payload = { ...validChallengePayload(), extra_field: "not allowed" };
    expect(trial1ChallengePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an unknown extra field inside case", () => {
    const payload = validChallengePayload();
    const withExtra = { ...payload, case: { ...payload.case, extra: 1 } };
    expect(trial1ChallengePayloadSchema.safeParse(withExtra).success).toBe(false);
  });

  it("rejects a wrong capability_id", () => {
    const payload = { ...validChallengePayload(), capability_id: "something.else" };
    expect(trial1ChallengePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a non did:key agent_did", () => {
    const payload = { ...validChallengePayload(), agent_did: "did:web:example.com" };
    expect(trial1ChallengePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a public_key of the wrong byte length", () => {
    const payload = validChallengePayload();
    const withBadKey = {
      ...payload,
      case: { ...payload.case, public_key: encodeBase64Url(new Uint8Array(31)) },
    };
    expect(trial1ChallengePayloadSchema.safeParse(withBadKey).success).toBe(false);
  });

  it("rejects a non-RFC3339 issued_at", () => {
    const payload = { ...validChallengePayload(), issued_at: "2026-08-30 12:00:00" };
    expect(trial1ChallengePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a malformed challenge_id", () => {
    const payload = { ...validChallengePayload(), challenge_id: "NOT-A-UUID" };
    expect(trial1ChallengePayloadSchema.safeParse(payload).success).toBe(false);
  });
});

describe("trial1ResultSchema", () => {
  it("accepts a well-formed result", () => {
    expect(trial1ResultSchema.safeParse(validResult()).success).toBe(true);
  });

  it("rejects an extra field", () => {
    expect(trial1ResultSchema.safeParse({ ...validResult(), extra: 1 }).success).toBe(false);
  });

  it("rejects an invalid reason_code", () => {
    expect(trial1ResultSchema.safeParse({ ...validResult(), reason_code: "MAYBE" }).success).toBe(
      false,
    );
  });

  it("rejects a malformed message_hash", () => {
    expect(
      trial1ResultSchema.safeParse({ ...validResult(), message_hash: "not-a-hash" }).success,
    ).toBe(false);
  });

  it("rejects a missing required field", () => {
    const { valid: _valid, ...rest } = validResult();
    expect(trial1ResultSchema.safeParse(rest).success).toBe(false);
  });
});

describe("trial1SignedSubmissionPayloadSchema", () => {
  it("accepts a well-formed submission payload", () => {
    expect(trial1SignedSubmissionPayloadSchema.safeParse(validSubmissionPayload()).success).toBe(
      true,
    );
  });

  it("rejects a wrong canonicalization id", () => {
    const payload = { ...validSubmissionPayload(), canonicalization: "custom-json-v1" };
    expect(trial1SignedSubmissionPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an extra field", () => {
    const payload = { ...validSubmissionPayload(), unexpected: true };
    expect(trial1SignedSubmissionPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a nested result with an extra field", () => {
    const payload = validSubmissionPayload();
    const withExtra = { ...payload, result: { ...payload.result, extra: 1 } };
    expect(trial1SignedSubmissionPayloadSchema.safeParse(withExtra).success).toBe(false);
  });
});

describe("trial1SignedSubmissionEnvelopeSchema", () => {
  it("accepts a well-formed envelope", () => {
    const envelope = {
      payload: validSubmissionPayload(),
      signature: {
        algorithm: "Ed25519" as const,
        encoding: "base64url" as const,
        value: encodeBase64Url(new Uint8Array(64).fill(1)),
      },
    };
    expect(trial1SignedSubmissionEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it("rejects a signature value of the wrong byte length", () => {
    const envelope = {
      payload: validSubmissionPayload(),
      signature: {
        algorithm: "Ed25519" as const,
        encoding: "base64url" as const,
        value: encodeBase64Url(new Uint8Array(63)),
      },
    };
    expect(trial1SignedSubmissionEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });

  it("rejects an extra top-level field", () => {
    const envelope = {
      payload: validSubmissionPayload(),
      signature: {
        algorithm: "Ed25519" as const,
        encoding: "base64url" as const,
        value: encodeBase64Url(new Uint8Array(64)),
      },
      extra: true,
    };
    expect(trial1SignedSubmissionEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });
});
