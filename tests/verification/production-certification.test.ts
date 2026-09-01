import { describe, expect, it } from "vitest";
import { decodeBase64Url } from "../../lib/crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../../lib/crypto/canonical-json.js";
import { sha256 } from "../../lib/crypto/sha256.js";
import type { FinalizationContext } from "../../lib/db/finalization-repository.js";
import { PRODUCTION_CAPABILITIES } from "../../lib/runtime/capability-registry.js";
import { generateCanonicalJsonSha256Challenge } from "../../lib/trials/canonical-json-sha256/challenge-generator.js";
import * as trial2Constants from "../../lib/trials/canonical-json-sha256/constants.js";
import { generateEd25519SignatureChallenge } from "../../lib/trials/ed25519-signature-verification/challenge-generator.js";
import * as trial1Constants from "../../lib/trials/ed25519-signature-verification/constants.js";
import { generateSignedReceiptVerificationChallenge } from "../../lib/trials/signed-receipt-verification/challenge-generator.js";
import * as trial4Constants from "../../lib/trials/signed-receipt-verification/constants.js";
import { generateTechnocoreCanonicalMessageChallenge } from "../../lib/trials/technocore-canonical-message/challenge-generator.js";
import * as trial3Constants from "../../lib/trials/technocore-canonical-message/constants.js";
import { finalizeCapabilityVerification } from "../../lib/verification/finalization-service.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";
import {
  createTestAttestationSigner,
  InMemoryFinalizationRepository,
} from "../helpers/in-memory-finalization-repository.js";

const agent = generateTestEd25519Identity();
const CHALLENGE_ID = "44444444-4444-4444-8444-444444444444";

interface GeneratedChallenge {
  publicPayload: unknown;
  hiddenContext: unknown;
  challengeHash: string;
}

interface CapabilityCase {
  ordinal: number;
  capabilityId: string;
  historicalTrialId: string;
  productionTrialId: string;
  trialVersion: string;
  verifierId: string;
  verifierVersion: string;
  certificateName: string;
  generate(trialId: string): GeneratedChallenge;
  expectedResult(generated: GeneratedChallenge): unknown;
  wrongResult: unknown;
}

const CAPABILITY_CASES: CapabilityCase[] = [
  {
    ordinal: 1,
    capabilityId: trial1Constants.CAPABILITY_ID,
    historicalTrialId: trial1Constants.TRIAL_ID,
    productionTrialId: trial1Constants.PRODUCTION_TRIAL_ID,
    trialVersion: trial1Constants.TRIAL_VERSION,
    verifierId: trial1Constants.VERIFIER_ID,
    verifierVersion: trial1Constants.VERIFIER_VERSION,
    certificateName: trial1Constants.CERTIFICATE_NAME,
    generate: (trialId) =>
      generateEd25519SignatureChallenge({
        agentDid: agent.did,
        trialId: trialId as typeof trial1Constants.TRIAL_ID,
        caseClass: "VALID_SIGNATURE",
      }),
    expectedResult: (generated) => {
      const payload = generated.publicPayload as { case: { message: string } };
      const hidden = generated.hiddenContext as { expected_valid: boolean };
      return {
        valid: hidden.expected_valid,
        reason_code: hidden.expected_valid ? "SIGNATURE_VALID" : "SIGNATURE_INVALID",
        message_hash: sha256(decodeBase64Url(payload.case.message)),
      };
    },
    wrongResult: {
      valid: false,
      reason_code: "SIGNATURE_INVALID",
      message_hash: sha256(new TextEncoder().encode("wrong")),
    },
  },
  {
    ordinal: 2,
    capabilityId: trial2Constants.CAPABILITY_ID,
    historicalTrialId: trial2Constants.TRIAL_ID,
    productionTrialId: trial2Constants.PRODUCTION_TRIAL_ID,
    trialVersion: trial2Constants.TRIAL_VERSION,
    verifierId: trial2Constants.VERIFIER_ID,
    verifierVersion: trial2Constants.VERIFIER_VERSION,
    certificateName: trial2Constants.CERTIFICATE_NAME,
    generate: (trialId) =>
      generateCanonicalJsonSha256Challenge({
        agentDid: agent.did,
        trialId: trialId as typeof trial2Constants.TRIAL_ID,
        caseClass: "NESTED_OBJECT",
      }),
    expectedResult: (generated) => {
      const hidden = generated.hiddenContext as { expected_canonical_json: string; expected_sha256: string };
      return { canonical_json: hidden.expected_canonical_json, sha256: hidden.expected_sha256 };
    },
    wrongResult: { canonical_json: "{}", sha256: sha256(new TextEncoder().encode("{}")) },
  },
  {
    ordinal: 3,
    capabilityId: trial3Constants.CAPABILITY_ID,
    historicalTrialId: trial3Constants.TRIAL_ID,
    productionTrialId: trial3Constants.PRODUCTION_TRIAL_ID,
    trialVersion: trial3Constants.TRIAL_VERSION,
    verifierId: trial3Constants.VERIFIER_ID,
    verifierVersion: trial3Constants.VERIFIER_VERSION,
    certificateName: trial3Constants.CERTIFICATE_NAME,
    generate: (trialId) =>
      generateTechnocoreCanonicalMessageChallenge({
        agentDid: agent.did,
        trialId: trialId as typeof trial3Constants.TRIAL_ID,
        caseClass: "WHITESPACE_CONTROL",
      }),
    expectedResult: (generated) => {
      const hidden = generated.hiddenContext as {
        expected_cleaned_text: string;
        expected_canonical_message: string;
      };
      return {
        cleaned_text: hidden.expected_cleaned_text,
        canonical_message: hidden.expected_canonical_message,
      };
    },
    wrongResult: { cleaned_text: "wrong text", canonical_message: "wrong|1700000000000|wrong text" },
  },
  {
    ordinal: 4,
    capabilityId: trial4Constants.CAPABILITY_ID,
    historicalTrialId: trial4Constants.TRIAL_ID,
    productionTrialId: trial4Constants.PRODUCTION_TRIAL_ID,
    trialVersion: trial4Constants.TRIAL_VERSION,
    verifierId: trial4Constants.VERIFIER_ID,
    verifierVersion: trial4Constants.VERIFIER_VERSION,
    certificateName: trial4Constants.CERTIFICATE_NAME,
    generate: (trialId) =>
      generateSignedReceiptVerificationChallenge({
        agentDid: agent.did,
        trialId: trialId as typeof trial4Constants.TRIAL_ID,
        caseClass: "VALID",
      }),
    expectedResult: (generated) => {
      const hidden = generated.hiddenContext as {
        expected_status: string;
        expected_reason_code: string;
        expected_key_id: string | null;
      };
      return {
        status: hidden.expected_status,
        reason_code: hidden.expected_reason_code,
        key_id: hidden.expected_key_id,
      };
    },
    wrongResult: { status: "INVALID", reason_code: "SIGNATURE_INVALID", key_id: "flop-trial4-key-a" },
  },
];

function contextFor(
  capability: CapabilityCase,
  trialId: string,
  result: unknown,
  generated: GeneratedChallenge,
): FinalizationContext {
  return {
    challengeId: CHALLENGE_ID,
    state: "SUBMITTED",
    agentId: "agent-1",
    agentDid: agent.did,
    submissionId: "submission-1",
    resultPayload: result,
    resultHash: sha256(canonicalizeJsonToBytes(result)),
    capabilityId: capability.capabilityId,
    trialId,
    trialVersion: capability.trialVersion,
    verifierId: capability.verifierId,
    verifierVersion: capability.verifierVersion,
    challengeHash: generated.challengeHash,
    publicPayload: generated.publicPayload,
    hiddenContext: generated.hiddenContext,
  };
}

async function finalize(capability: CapabilityCase, trialId: string, resultKind: "correct" | "wrong") {
  const generated = capability.generate(trialId);
  const result = resultKind === "correct" ? capability.expectedResult(generated) : capability.wrongResult;
  const repository = new InMemoryFinalizationRepository(contextFor(capability, trialId, result, generated));
  const outcome = await finalizeCapabilityVerification(CHALLENGE_ID, {
    repository,
    signer: createTestAttestationSigner(),
  });
  return { repository, outcome };
}

describe("production certification across Capabilities 1-4", () => {
  for (const capability of CAPABILITY_CASES) {
    const { ordinal } = capability;

    it(`Capability ${ordinal}: a correct production result issues exactly one certificate`, async () => {
      const { repository, outcome } = await finalize(capability, capability.productionTrialId, "correct");

      expect(outcome.verdict).toBe("PASS");
      expect(repository.receipts).toHaveLength(1);
      expect(repository.certificates).toHaveLength(1);
      expect(repository.certificates[0]?.certificateName).toBe(capability.certificateName);
      expect(repository.certificates[0]?.capabilityId).toBe(capability.capabilityId);
      expect(repository.certificates[0]?.trialId).toBe(capability.productionTrialId);
      expect(repository.certificates[0]?.receiptId).toBe(repository.receipts[0]?.id);
    });

    it(`Capability ${ordinal}: a wrong deterministic result fails without a certificate`, async () => {
      const { repository, outcome } = await finalize(capability, capability.productionTrialId, "wrong");

      expect(outcome.verdict).toBe("FAIL");
      expect(repository.receipts).toHaveLength(0);
      expect(repository.certificates).toHaveLength(0);
      expect(repository.finalStates).toEqual([{ challengeId: CHALLENGE_ID, verdict: "FAIL" }]);
    });

    it(`Capability ${ordinal}: a historical trial PASS creates evidence but never a certificate`, async () => {
      const { repository, outcome } = await finalize(capability, capability.historicalTrialId, "correct");

      expect(outcome.verdict).toBe("PASS");
      expect(repository.receipts).toHaveLength(1);
      expect(repository.receipts[0]?.trialId).toBe(capability.historicalTrialId);
      expect(repository.certificates).toHaveLength(0);
    });
  }

  it("keeps every production trial id distinct from its historical trial id", () => {
    for (const capability of PRODUCTION_CAPABILITIES) {
      expect(capability.productionTrialId).not.toBe(capability.historicalTrialId);
    }
  });
});
