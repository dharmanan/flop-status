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
} from "../../lib/trials/technocore-canonical-message/constants.js";
import {
  trial3ChallengePayloadSchema,
  trial3ResultSchema,
  trial3SignedSubmissionEnvelopeSchema,
} from "../../lib/trials/technocore-canonical-message/schema.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

const identity = generateTestEd25519Identity();
const challenge = {
  challenge_version: CHALLENGE_VERSION,
  challenge_id: "11111111-1111-4111-8111-111111111111",
  agent_did: identity.did,
  capability_id: CAPABILITY_ID,
  trial_id: TRIAL_ID,
  trial_version: TRIAL_VERSION,
  nonce: encodeBase64Url(new Uint8Array(16).fill(7)),
  case: {
    room: "proof-room",
    nonce: "1700000000000",
    text: " alpha\n beta ",
  },
  issued_at: "2026-08-31T20:00:00.000Z",
  expires_at: "2026-08-31T20:10:00.000Z",
};
const result = {
  cleaned_text: "alpha beta",
  canonical_message: "proof-room|1700000000000|alpha beta",
};

function envelope() {
  return {
    payload: {
      submission_version: SUBMISSION_VERSION,
      canonicalization: CANONICALIZATION_ID,
      challenge_id: challenge.challenge_id,
      challenge_hash: sha256(new TextEncoder().encode("challenge")),
      agent_did: identity.did,
      trial_id: TRIAL_ID,
      trial_version: TRIAL_VERSION,
      result,
      submitted_at: "2026-08-31T20:01:00.000Z",
    },
    signature: {
      algorithm: "Ed25519" as const,
      encoding: "base64url" as const,
      value: encodeBase64Url(new Uint8Array(64).fill(9)),
    },
  };
}

describe("Trial 3 schemas", () => {
  it("accepts the exact challenge and result shapes", () => {
    expect(trial3ChallengePayloadSchema.parse(challenge)).toEqual(challenge);
    expect(trial3ResultSchema.parse(result)).toEqual(result);
  });

  it("rejects unknown challenge, case and result fields", () => {
    expect(() => trial3ChallengePayloadSchema.parse({ ...challenge, unexpected: true })).toThrow();
    expect(() => trial3ChallengePayloadSchema.parse({ ...challenge, case: { ...challenge.case, unexpected: true } })).toThrow();
    expect(() => trial3ResultSchema.parse({ ...result, unexpected: true })).toThrow();
  });

  it("accepts the standard signed envelope and rejects unknown envelope fields", () => {
    const valid = envelope();
    expect(trial3SignedSubmissionEnvelopeSchema.parse(valid)).toEqual(valid);
    expect(() => trial3SignedSubmissionEnvelopeSchema.parse({ ...valid, unexpected: true })).toThrow();
  });
});
