import { describe, expect, it } from "vitest";
import type { TrialDefinitionRow } from "../../lib/db/types.js";
import {
  ActiveChallengeExistsError,
  issueEd25519SignatureChallenge,
} from "../../lib/challenges/issuance-service.js";
import {
  CANONICALIZATION_ID,
  CAPABILITY_ID,
  TRIAL_ID,
  TRIAL_VERSION,
  VERIFIER_ID,
  VERIFIER_VERSION,
} from "../../lib/trials/ed25519-signature-verification/constants.js";
import { trial1ChallengePayloadSchema } from "../../lib/trials/ed25519-signature-verification/schema.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";
import { InMemoryChallengeRepository } from "../helpers/in-memory-challenge-repository.js";

function seededRepository(): InMemoryChallengeRepository {
  const repository = new InMemoryChallengeRepository();
  const trialDefinition: TrialDefinitionRow = {
    id: "trial-def-1",
    trialId: TRIAL_ID,
    trialVersion: TRIAL_VERSION,
    capabilityId: CAPABILITY_ID,
    verifierId: VERIFIER_ID,
    verifierVersion: VERIFIER_VERSION,
    canonicalizationId: CANONICALIZATION_ID,
    definition: {},
    active: true,
    createdAt: new Date().toISOString(),
  };
  repository.seedTrialDefinition(trialDefinition);
  return repository;
}

describe("issueEd25519SignatureChallenge", () => {
  it("rejects a second issuance while an active ISSUED challenge exists with a typed ActiveChallengeExistsError", async () => {
    const repository = seededRepository();
    const agentDid = generateTestEd25519Identity().did;

    const first = await issueEd25519SignatureChallenge({ agentDid }, { repository });

    let caught: unknown;
    try {
      await issueEd25519SignatureChallenge({ agentDid }, { repository });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ActiveChallengeExistsError);
    expect((caught as ActiveChallengeExistsError).activeChallengeId).toBe(first.id);
  });

  it("expires a stale ISSUED challenge and issues a fresh one instead of reusing it", async () => {
    const repository = seededRepository();
    const agentDid = generateTestEd25519Identity().did;
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const afterTtl = new Date("2026-01-01T00:11:00.000Z"); // TTL is 10 minutes

    const first = await issueEd25519SignatureChallenge(
      { agentDid },
      { repository, now: () => issuedAt },
    );
    const second = await issueEd25519SignatureChallenge(
      { agentDid },
      { repository, now: () => afterTtl },
    );

    expect(second.id).not.toBe(first.id);
    expect(repository.getChallengeById(first.id)?.state).toBe("EXPIRED");
    expect(repository.getChallengeById(second.id)?.state).toBe("ISSUED");
  });

  it("never returns hiddenContext in the public result", async () => {
    const repository = seededRepository();
    const agentDid = generateTestEd25519Identity().did;

    const result = await issueEd25519SignatureChallenge({ agentDid }, { repository });

    expect(Object.hasOwn(result, "hiddenContext")).toBe(false);
    expect(JSON.stringify(result)).not.toContain("expected_valid");
  });

  it("maps the generator output correctly into the persisted challenge_instances model", async () => {
    const repository = seededRepository();
    const agentDid = generateTestEd25519Identity().did;

    const result = await issueEd25519SignatureChallenge({ agentDid }, { repository });
    const row = repository.getChallengeById(result.id);

    expect(row).not.toBeNull();
    expect(row?.publicPayload).toEqual(result.publicPayload);
    expect(row?.challengeHash).toBe(result.challengeHash);
    expect(row?.nonce).toBe(result.publicPayload.nonce);
    expect(row?.issuedAt).toBe(result.publicPayload.issued_at);
    expect(row?.expiresAt).toBe(result.publicPayload.expires_at);
    expect(row?.hiddenContext).toEqual(
      expect.objectContaining({
        case_class: expect.any(String),
        expected_valid: expect.any(Boolean),
      }),
    );
    expect(trial1ChallengePayloadSchema.safeParse(row?.publicPayload).success).toBe(true);
  });

  it("does not need test-only randomness/clock injection on the production call path", async () => {
    const repository = seededRepository();
    const agentDid = generateTestEd25519Identity().did;

    // Only `repository` is supplied — the same call shape production code
    // would use. now/randomBytes fall through to
    // generateEd25519SignatureChallenge's own CSPRNG-backed defaults.
    const result = await issueEd25519SignatureChallenge({ agentDid }, { repository });

    expect(trial1ChallengePayloadSchema.safeParse(result.publicPayload).success).toBe(true);
  });

  it("allows exactly one of two concurrent issuance requests for the same DID to succeed", async () => {
    const repository = seededRepository();
    const agentDid = generateTestEd25519Identity().did;

    const [settledA, settledB] = await Promise.allSettled([
      issueEd25519SignatureChallenge({ agentDid }, { repository }),
      issueEd25519SignatureChallenge({ agentDid }, { repository }),
    ]);

    const fulfilled = [settledA, settledB].filter((r) => r.status === "fulfilled");
    const rejected = [settledA, settledB].filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ActiveChallengeExistsError,
    );
  });
});
