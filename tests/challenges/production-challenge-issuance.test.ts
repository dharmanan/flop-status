import { describe, expect, it } from "vitest";
import { issueCapabilityChallenge } from "../../lib/challenges/issuance-service.js";
import type { TrialDefinitionRow } from "../../lib/db/types.js";
import { PRODUCTION_CAPABILITIES } from "../../lib/runtime/capability-registry.js";
import { acceptCapabilitySignedSubmission } from "../../lib/submissions/submission-service.js";
import { canonicalizeJsonToBytes } from "../../lib/crypto/canonical-json.js";
import { encodeBase64Url } from "../../lib/crypto/base64url.js";
import { sha256 } from "../../lib/crypto/sha256.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";
import { InMemoryChallengeRepository } from "../helpers/in-memory-challenge-repository.js";
import { InMemorySubmissionRepository } from "../helpers/in-memory-submission-repository.js";

function seededRepository(): InMemoryChallengeRepository {
  const repository = new InMemoryChallengeRepository();
  for (const [index, capability] of PRODUCTION_CAPABILITIES.entries()) {
    const row: TrialDefinitionRow = {
      id: `production-trial-def-${index + 1}`,
      trialId: capability.productionTrialId,
      trialVersion: capability.productionTrialVersion,
      capabilityId: capability.capabilityId,
      verifierId: capability.verifierId,
      verifierVersion: capability.verifierVersion,
      canonicalizationId: "jcs-rfc8785-v1",
      definition: {},
      active: true,
      createdAt: new Date().toISOString(),
    };
    repository.seedTrialDefinition(row);
  }
  return repository;
}

describe("production certification challenge issuance", () => {
  for (const capability of PRODUCTION_CAPABILITIES) {
    it(`Capability ${capability.ordinal} issues a challenge bound to its production trial id`, async () => {
      const repository = seededRepository();
      const agentDid = generateTestEd25519Identity().did;

      const issued = await issueCapabilityChallenge(
        { agentDid, trialId: capability.productionTrialId },
        { repository },
      );

      const payload = issued.publicPayload as {
        agent_did: string;
        capability_id: string;
        trial_id: string;
        case: unknown;
        expires_at: string;
      };
      expect(payload.trial_id).toBe(capability.productionTrialId);
      expect(payload.capability_id).toBe(capability.capabilityId);
      expect(payload.agent_did).toBe(agentDid);
      expect(payload.case).toBeTruthy();
      expect(issued.challengeHash.startsWith("sha256:")).toBe(true);
    });

    it(`Capability ${capability.ordinal} keeps the expected answer in hidden context only`, async () => {
      const repository = seededRepository();
      const agentDid = generateTestEd25519Identity().did;

      const issued = await issueCapabilityChallenge(
        { agentDid, trialId: capability.productionTrialId },
        { repository },
      );
      const stored = repository.getChallengeById(issued.id);

      // The public payload the capability module receives must carry no
      // expected_* answer field anywhere, and must not embed the hidden context.
      expect(collectKeys(issued.publicPayload).filter((key) => key.startsWith("expected_"))).toEqual([]);
      expect(issued.publicPayload).not.toHaveProperty("hidden_context");

      const hiddenKeys = Object.keys(stored?.hiddenContext as Record<string, unknown>);
      expect(hiddenKeys.some((key) => key.startsWith("expected_"))).toBe(true);
    });

    it(`Capability ${capability.ordinal} produces two different challenges for two issuances`, async () => {
      const repository = seededRepository();
      const first = await issueCapabilityChallenge(
        { agentDid: generateTestEd25519Identity().did, trialId: capability.productionTrialId },
        { repository },
      );
      const second = await issueCapabilityChallenge(
        { agentDid: generateTestEd25519Identity().did, trialId: capability.productionTrialId },
        { repository },
      );
      expect(first.challengeHash).not.toBe(second.challengeHash);
    });
  }
});

describe("production certification submissions are DID signed and challenge bound", () => {
  for (const capability of PRODUCTION_CAPABILITIES) {
    it(`Capability ${capability.ordinal} accepts a correctly signed production submission`, async () => {
      const challengeRepository = seededRepository();
      const agent = generateTestEd25519Identity();
      const issued = await issueCapabilityChallenge(
        { agentDid: agent.did, trialId: capability.productionTrialId },
        { repository: challengeRepository },
      );
      const stored = challengeRepository.getChallengeById(issued.id)!;

      const submissionRepository = new InMemorySubmissionRepository({
        id: issued.id,
        agentId: "agent-1",
        agentDid: agent.did,
        trialDefinitionId: stored.trialDefinitionId,
        trialId: capability.productionTrialId,
        trialVersion: capability.productionTrialVersion,
        verifierId: capability.verifierId,
        verifierVersion: capability.verifierVersion,
        challengeHash: issued.challengeHash,
        state: "ISSUED",
        expiresAt: stored.expiresAt,
        publicPayload: stored.publicPayload,
        hiddenContext: stored.hiddenContext,
      });

      const payload = {
        submission_version: "1",
        canonicalization: "jcs-rfc8785-v1",
        challenge_id: issued.id,
        challenge_hash: issued.challengeHash,
        agent_did: agent.did,
        trial_id: capability.productionTrialId,
        trial_version: capability.productionTrialVersion,
        result: resultFor(capability.ordinal, stored.hiddenContext, stored.publicPayload),
        submitted_at: new Date().toISOString(),
      };
      const signature = agent.sign(canonicalizeJsonToBytes(payload));

      const accepted = await acceptCapabilitySignedSubmission(
        {
          challengeId: issued.id,
          envelope: {
            payload,
            signature: { algorithm: "Ed25519", encoding: "base64url", value: encodeBase64Url(signature) },
          },
          bodyByteLength: 1024,
        },
        { repository: submissionRepository },
      );

      expect(accepted.challengeId).toBe(issued.id);
      expect(accepted.resultHash.startsWith("sha256:")).toBe(true);
    });
  }
});

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

function resultFor(ordinal: number, hiddenContext: unknown, publicPayload: unknown): unknown {
  if (ordinal === 1) {
    const hidden = hiddenContext as { expected_valid: boolean };
    const payload = publicPayload as { case: { message: string } };
    return {
      valid: hidden.expected_valid,
      reason_code: hidden.expected_valid ? "SIGNATURE_VALID" : "SIGNATURE_INVALID",
      message_hash: sha256(new TextEncoder().encode(payload.case.message)),
    };
  }
  if (ordinal === 2) {
    const hidden = hiddenContext as { expected_canonical_json: string; expected_sha256: string };
    return { canonical_json: hidden.expected_canonical_json, sha256: hidden.expected_sha256 };
  }
  if (ordinal === 3) {
    const hidden = hiddenContext as { expected_cleaned_text: string; expected_canonical_message: string };
    return { cleaned_text: hidden.expected_cleaned_text, canonical_message: hidden.expected_canonical_message };
  }
  if (ordinal === 4) {
    const hidden = hiddenContext as {
      expected_status: string;
      expected_reason_code: string;
      expected_key_id: string | null;
    };
    return {
      status: hidden.expected_status,
      reason_code: hidden.expected_reason_code,
      key_id: hidden.expected_key_id,
    };
  }
  const hidden = hiddenContext as { expected_reason_code: string; expected_result: unknown };
  return { reason_code: hidden.expected_reason_code, result: hidden.expected_result };
}
