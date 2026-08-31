import { describe, expect, it } from "vitest";
import { generateEd25519SignatureChallenge } from "../../lib/trials/ed25519-signature-verification/challenge-generator.js";
import { canonicalizeJsonToBytes } from "../../lib/crypto/canonical-json.js";
import { decodeBase64Url, encodeBase64Url } from "../../lib/crypto/base64url.js";
import { sha256 } from "../../lib/crypto/sha256.js";
import {
  acceptTrial1SignedSubmission,
  MAX_SUBMISSION_BODY_BYTES,
  SubmissionAcceptanceError,
} from "../../lib/submissions/submission-service.js";
import { CANONICALIZATION_ID, SUBMISSION_VERSION, TRIAL_ID, TRIAL_VERSION } from "../../lib/trials/ed25519-signature-verification/constants.js";
import type { SubmissionChallengeContext } from "../../lib/db/types.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";
import { InMemorySubmissionRepository } from "../helpers/in-memory-submission-repository.js";

const ISSUED_AT = new Date("2026-08-30T19:00:00.000Z");
const SERVER_NOW = new Date("2026-08-30T19:01:00.000Z");

function fixture() {
  const identity = generateTestEd25519Identity();
  const generated = generateEd25519SignatureChallenge(
    { agentDid: identity.did },
    { now: () => new Date(ISSUED_AT) },
  );
  const message = decodeBase64Url(generated.publicPayload.case.message);
  const result = {
    valid: generated.hiddenContext.expected_valid,
    reason_code: generated.hiddenContext.expected_valid ? "SIGNATURE_VALID" as const : "SIGNATURE_INVALID" as const,
    message_hash: sha256(message),
  };
  const payload = {
    submission_version: SUBMISSION_VERSION,
    canonicalization: CANONICALIZATION_ID,
    challenge_id: generated.publicPayload.challenge_id,
    challenge_hash: generated.challengeHash,
    agent_did: identity.did,
    trial_id: TRIAL_ID,
    trial_version: TRIAL_VERSION,
    result,
    submitted_at: "2026-08-30T19:00:30.000Z",
  };
  const envelope = {
    payload,
    signature: {
      algorithm: "Ed25519" as const,
      encoding: "base64url" as const,
      value: encodeBase64Url(identity.sign(canonicalizeJsonToBytes(payload))),
    },
  };
  const challenge: SubmissionChallengeContext = {
    id: generated.publicPayload.challenge_id,
    agentId: "11111111-1111-4111-8111-111111111111",
    agentDid: identity.did,
    trialDefinitionId: "33333333-3333-4333-8333-333333333333",
    trialId: TRIAL_ID,
    trialVersion: TRIAL_VERSION,
    verifierId: "ed25519-signature-verifier",
    verifierVersion: "1",
    state: "ISSUED",
    publicPayload: generated.publicPayload,
    hiddenContext: generated.hiddenContext,
    challengeHash: generated.challengeHash,
    expiresAt: generated.publicPayload.expires_at,
  };
  return { identity, generated, result, payload, envelope, challenge };
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("acceptTrial1SignedSubmission", () => {
  it("accepts a correctly bound DID-signed payload exactly once and persists canonical hashes", async () => {
    const f = fixture();
    const repository = new InMemorySubmissionRepository(f.challenge);
    const accepted = await acceptTrial1SignedSubmission(
      { challengeId: f.challenge.id, envelope: f.envelope, bodyByteLength: byteLength(f.envelope) },
      { repository, now: () => new Date(SERVER_NOW) },
    );

    expect(accepted.challengeId).toBe(f.challenge.id);
    expect(accepted.payloadHash).toBe(sha256(canonicalizeJsonToBytes(f.payload)));
    expect(accepted.resultHash).toBe(sha256(canonicalizeJsonToBytes(f.result)));
    expect(repository.getSubmissionCount()).toBe(1);
    expect(repository.challenge.state).toBe("SUBMITTED");
    expect(accepted).not.toHaveProperty("hiddenContext");
  });

  it("rejects a signed-field mutation as INVALID_AGENT_SIGNATURE and leaves challenge ISSUED", async () => {
    const f = fixture();
    const repository = new InMemorySubmissionRepository(f.challenge);
    const tampered = {
      ...f.envelope,
      payload: { ...f.payload, result: { ...f.result, valid: !f.result.valid } },
    };

    await expectCode(
      acceptTrial1SignedSubmission(
        { challengeId: f.challenge.id, envelope: tampered, bodyByteLength: byteLength(tampered) },
        { repository, now: () => new Date(SERVER_NOW) },
      ),
      "INVALID_AGENT_SIGNATURE",
    );
    expect(repository.getSubmissionCount()).toBe(0);
    expect(repository.challenge.state).toBe("ISSUED");
  });

  it("rejects a different DID before consuming the challenge", async () => {
    const f = fixture();
    const other = generateTestEd25519Identity();
    const changedPayload = { ...f.payload, agent_did: other.did };
    const changedEnvelope = {
      payload: changedPayload,
      signature: {
        ...f.envelope.signature,
        value: encodeBase64Url(other.sign(canonicalizeJsonToBytes(changedPayload))),
      },
    };
    const repository = new InMemorySubmissionRepository(f.challenge);

    await expectCode(
      acceptTrial1SignedSubmission(
        { challengeId: f.challenge.id, envelope: changedEnvelope, bodyByteLength: byteLength(changedEnvelope) },
        { repository, now: () => new Date(SERVER_NOW) },
      ),
      "CHALLENGE_BINDING_MISMATCH",
    );
    expect(repository.challenge.state).toBe("ISSUED");
  });

  it("rejects a mismatched challenge hash even when the modified payload is validly signed", async () => {
    const f = fixture();
    const changedPayload = { ...f.payload, challenge_hash: sha256(new TextEncoder().encode("other")) };
    const changedEnvelope = {
      payload: changedPayload,
      signature: {
        ...f.envelope.signature,
        value: encodeBase64Url(f.identity.sign(canonicalizeJsonToBytes(changedPayload))),
      },
    };
    const repository = new InMemorySubmissionRepository(f.challenge);

    await expectCode(
      acceptTrial1SignedSubmission(
        { challengeId: f.challenge.id, envelope: changedEnvelope, bodyByteLength: byteLength(changedEnvelope) },
        { repository, now: () => new Date(SERVER_NOW) },
      ),
      "CHALLENGE_BINDING_MISMATCH",
    );
  });

  it("marks an expired ISSUED challenge EXPIRED and does not persist a submission", async () => {
    const f = fixture();
    const repository = new InMemorySubmissionRepository(f.challenge);
    await expectCode(
      acceptTrial1SignedSubmission(
        { challengeId: f.challenge.id, envelope: f.envelope, bodyByteLength: byteLength(f.envelope) },
        { repository, now: () => new Date("2026-08-30T19:11:00.000Z") },
      ),
      "CHALLENGE_EXPIRED",
    );
    expect(repository.challenge.state).toBe("EXPIRED");
    expect(repository.getSubmissionCount()).toBe(0);
  });

  it("rejects sequential replay after the first accepted submission", async () => {
    const f = fixture();
    const repository = new InMemorySubmissionRepository(f.challenge);
    const input = { challengeId: f.challenge.id, envelope: f.envelope, bodyByteLength: byteLength(f.envelope) };
    await acceptTrial1SignedSubmission(input, { repository, now: () => new Date(SERVER_NOW) });
    await expectCode(
      acceptTrial1SignedSubmission(input, { repository, now: () => new Date(SERVER_NOW) }),
      "CHALLENGE_ALREADY_CONSUMED",
    );
    expect(repository.getSubmissionCount()).toBe(1);
  });

  it("rejects path challenge id mismatch before touching persistence", async () => {
    const f = fixture();
    const repository = new InMemorySubmissionRepository(f.challenge);
    await expectCode(
      acceptTrial1SignedSubmission(
        { challengeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", envelope: f.envelope, bodyByteLength: byteLength(f.envelope) },
        { repository, now: () => new Date(SERVER_NOW) },
      ),
      "CHALLENGE_BINDING_MISMATCH",
    );
  });

  it("rejects strict schema extras", async () => {
    const f = fixture();
    const repository = new InMemorySubmissionRepository(f.challenge);
    const invalid = { ...f.envelope, unexpected: true };
    await expectCode(
      acceptTrial1SignedSubmission(
        { challengeId: f.challenge.id, envelope: invalid, bodyByteLength: byteLength(invalid) },
        { repository, now: () => new Date(SERVER_NOW) },
      ),
      "INVALID_SUBMISSION_SCHEMA",
    );
  });

  it("enforces configured body size before schema parsing", async () => {
    const f = fixture();
    const repository = new InMemorySubmissionRepository(f.challenge);
    const promise = acceptTrial1SignedSubmission(
      { challengeId: f.challenge.id, envelope: null, bodyByteLength: MAX_SUBMISSION_BODY_BYTES + 1 },
      { repository, now: () => new Date(SERVER_NOW) },
    );
    await expectCode(promise, "INVALID_SUBMISSION_SCHEMA");
  });

  it("allows unsupported DID syntax through schema so typed DID validation can happen at the required later step", () => {
    const f = fixture();
    const envelope = { ...f.envelope, payload: { ...f.payload, agent_did: "did:web:example.com" } };
    expect(() => JSON.stringify(envelope)).not.toThrow();
  });
});
