import { describe, expect, it } from "vitest";
import { canonicalizeJson } from "../../lib/crypto/canonical-json.js";
import { generateCanonicalJsonSha256Challenge } from "../../lib/trials/canonical-json-sha256/challenge-generator.js";
import { PRODUCTION_TRIAL_ID as TRIAL2_PRODUCTION_ID } from "../../lib/trials/canonical-json-sha256/constants.js";
import type { Trial2CaseClass } from "../../lib/trials/canonical-json-sha256/schema.js";
import { verifyTrial2Result } from "../../lib/trials/canonical-json-sha256/verifier.js";
import { generateEd25519SignatureChallenge } from "../../lib/trials/ed25519-signature-verification/challenge-generator.js";
import { PRODUCTION_TRIAL_ID as TRIAL1_PRODUCTION_ID } from "../../lib/trials/ed25519-signature-verification/constants.js";
import type { Trial1CaseClass } from "../../lib/trials/ed25519-signature-verification/schema.js";
import { verifyTrial1Result } from "../../lib/trials/ed25519-signature-verification/verifier.js";
import { generateSignedReceiptVerificationChallenge } from "../../lib/trials/signed-receipt-verification/challenge-generator.js";
import { PRODUCTION_TRIAL_ID as TRIAL4_PRODUCTION_ID } from "../../lib/trials/signed-receipt-verification/constants.js";
import type { Trial4CaseClass } from "../../lib/trials/signed-receipt-verification/schema.js";
import { verifyTrial4Result } from "../../lib/trials/signed-receipt-verification/verifier.js";
import { generateTechnocoreCanonicalMessageChallenge } from "../../lib/trials/technocore-canonical-message/challenge-generator.js";
import { PRODUCTION_TRIAL_ID as TRIAL3_PRODUCTION_ID } from "../../lib/trials/technocore-canonical-message/constants.js";
import { cleanTechnocoreLine } from "../../lib/trials/technocore-canonical-message/protocol.js";
import type { Trial3CaseClass } from "../../lib/trials/technocore-canonical-message/schema.js";
import { verifyTrial3Result } from "../../lib/trials/technocore-canonical-message/verifier.js";
import * as capability2 from "../../web/capabilities/canonical-json-sha256.js";
import * as capability1 from "../../web/capabilities/ed25519-signature-verification.js";
import { canonicalizeJson as browserCanonicalizeJson } from "../../web/capabilities/jcs.js";
import * as capability4 from "../../web/capabilities/signed-receipt-verification.js";
import * as capability3 from "../../web/capabilities/technocore-canonical-message.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

const agent = generateTestEd25519Identity();

const TRIAL1_CASES: Trial1CaseClass[] = ["VALID_SIGNATURE", "INVALID_SIGNATURE"];
const TRIAL2_CASES: Trial2CaseClass[] = ["NESTED_OBJECT", "UNICODE_KEYS", "ARRAY_MIX", "NUMERIC_EDGE"];
const TRIAL3_CASES: Trial3CaseClass[] = ["WHITESPACE_CONTROL", "UNICODE_TEXT", "PIPE_TEXT", "PLAIN_TEXT"];
const TRIAL4_CASES: Trial4CaseClass[] = ["VALID", "TAMPERED_FIELD", "KEY_ID_MISMATCH", "UNKNOWN_KEY"];

describe("browser canonicalization agrees with the server RFC 8785 implementation", () => {
  const values: unknown[] = [
    { zeta: { enabled: true, count: 3 }, alpha: { nested: { c: null, a: "first", b: false } }, list: [3, 2, 1] },
    { "é": "precomposed", "€": "euro", "😀": "emoji", a: "token", "\r": "carriage-return-key" },
    [{ b: 2, a: 1 }, [true, null, "t", { y: "yes", x: "ex" }], "line\nfeed"],
    { tiny: 1e-27, large: 1e30, fraction: 333333333.33333329, zero: 0, negative: -0.000001 },
    "plain string",
    42,
    null,
    true,
    [],
    {},
  ];

  for (const [index, value] of values.entries()) {
    it(`produces identical canonical bytes for value ${index}`, () => {
      expect(browserCanonicalizeJson(value)).toBe(canonicalizeJson(value));
    });
  }

  it("rejects non-finite numbers rather than emitting invalid JSON", () => {
    expect(() => browserCanonicalizeJson({ bad: Number.POSITIVE_INFINITY })).toThrow();
  });
});

describe("the installed browser modules satisfy the deterministic FLOP verifiers", () => {
  for (const caseClass of TRIAL1_CASES) {
    it(`Capability 1 passes a fresh ${caseClass} production challenge`, async () => {
      const challenge = generateEd25519SignatureChallenge({
        agentDid: agent.did,
        trialId: TRIAL1_PRODUCTION_ID,
        caseClass,
      });
      const result = await capability1.executeEd25519SignatureVerification(challenge.publicPayload.case);
      const verification = verifyTrial1Result({
        publicPayload: challenge.publicPayload,
        hiddenContext: challenge.hiddenContext,
        result,
      });
      expect(verification.verdict).toBe("PASS");
    });
  }

  for (const caseClass of TRIAL2_CASES) {
    it(`Capability 2 passes a fresh ${caseClass} production challenge`, async () => {
      const challenge = generateCanonicalJsonSha256Challenge({
        agentDid: agent.did,
        trialId: TRIAL2_PRODUCTION_ID,
        caseClass,
      });
      const result = await capability2.executeCanonicalJsonSha256(challenge.publicPayload.case);
      const verification = verifyTrial2Result({
        publicPayload: challenge.publicPayload,
        hiddenContext: challenge.hiddenContext,
        result,
      });
      expect(verification.verdict).toBe("PASS");
      expect(verification.reason_code).toBe("EXPECTED_RESULT_MATCH");
    });
  }

  for (const caseClass of TRIAL3_CASES) {
    it(`Capability 3 passes a fresh ${caseClass} production challenge`, async () => {
      const challenge = generateTechnocoreCanonicalMessageChallenge({
        agentDid: agent.did,
        trialId: TRIAL3_PRODUCTION_ID,
        caseClass,
      });
      const result = await capability3.executeTechnocoreCanonicalMessage(challenge.publicPayload.case);
      const verification = verifyTrial3Result({
        publicPayload: challenge.publicPayload,
        hiddenContext: challenge.hiddenContext,
        result,
      });
      expect(verification.verdict).toBe("PASS");
      expect(result.canonical_message).toBe(
        `${challenge.publicPayload.case.room}|${challenge.publicPayload.case.nonce}|${result.cleaned_text}`,
      );
    });
  }

  for (const caseClass of TRIAL4_CASES) {
    it(`Capability 4 passes a fresh ${caseClass} production challenge`, async () => {
      const challenge = generateSignedReceiptVerificationChallenge({
        agentDid: agent.did,
        trialId: TRIAL4_PRODUCTION_ID,
        caseClass,
      });
      const result = await capability4.executeSignedReceiptVerification(
        challenge.publicPayload.case as never,
      );
      const verification = verifyTrial4Result({
        publicPayload: challenge.publicPayload,
        hiddenContext: challenge.hiddenContext,
        result,
      });
      expect(verification.verdict).toBe("PASS");
      expect(result.status).toBe(challenge.hiddenContext.expected_status);
    });
  }
});

describe("Capability 4 keeps UNKNOWN distinct from INVALID", () => {
  it("reports UNKNOWN, not INVALID, when the declared server key is outside the key set", async () => {
    const challenge = generateSignedReceiptVerificationChallenge({
      agentDid: agent.did,
      trialId: TRIAL4_PRODUCTION_ID,
      caseClass: "UNKNOWN_KEY",
    });
    const result = await capability4.executeSignedReceiptVerification(challenge.publicPayload.case as never);
    expect(result).toEqual({ status: "UNKNOWN", reason_code: "SERVER_KEY_NOT_FOUND", key_id: null });
  });

  it("reports INVALID for tampered evidence signed by a known key", async () => {
    const challenge = generateSignedReceiptVerificationChallenge({
      agentDid: agent.did,
      trialId: TRIAL4_PRODUCTION_ID,
      caseClass: "TAMPERED_FIELD",
    });
    const result = await capability4.executeSignedReceiptVerification(challenge.publicPayload.case as never);
    expect(result.status).toBe("INVALID");
    expect(result.reason_code).toBe("SIGNATURE_INVALID");
  });

  it("identifies the actually-signing key on a key id mismatch", async () => {
    const challenge = generateSignedReceiptVerificationChallenge({
      agentDid: agent.did,
      trialId: TRIAL4_PRODUCTION_ID,
      caseClass: "KEY_ID_MISMATCH",
    });
    const result = await capability4.executeSignedReceiptVerification(challenge.publicPayload.case as never);
    expect(result.status).toBe("INVALID");
    expect(result.reason_code).toBe("KEY_ID_MISMATCH");
    expect(result.key_id).toBe("flop-trial4-key-a");
  });
});

describe("browser Technocore cleaning matches the FLOP source of truth", () => {
  const samples = [
    "  alpha\n\tbeta\r\n gamma  ",
    "Merhaba  dünya 😀 ikinci satır",
    "payload | keeps | pipe characters",
    "deterministic capability proof",
    "tab\tandbell",
  ];

  for (const sample of samples) {
    it(`cleans ${JSON.stringify(sample)} to the same result as the server`, async () => {
      const result = await capability3.executeTechnocoreCanonicalMessage({ room: "r", nonce: "1", text: sample });
      expect(result.cleaned_text).toBe(cleanTechnocoreLine(sample));
    });
  }

  it("rejects text that is empty after cleaning", async () => {
    await expect(capability3.executeTechnocoreCanonicalMessage({ room: "r", nonce: "1", text: "   \n\t  " })).rejects.toThrow();
  });
});

describe("practice fixtures check the capability against an independent expectation", () => {
  it("Capability 1 practice agrees with how the fixture was built", async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const fixture = await capability1.createPracticeFixture();
      const result = await capability1.executeEd25519SignatureVerification(fixture.input);
      expect(await capability1.evaluatePractice(result, fixture)).toBe(true);
    }
  });

  it("Capability 2 practice expectations match the server canonicalization", async () => {
    const fixture = capability2.createPracticeFixture();
    expect(fixture.expected.canonical_json).toBe(canonicalizeJson(fixture.input.document));
    const result = await capability2.executeCanonicalJsonSha256(fixture.input);
    expect(await capability2.evaluatePractice(result, fixture)).toBe(true);
  });

  it("Capability 3 practice expectations match the server cleaning rule", async () => {
    const fixture = capability3.createPracticeFixture();
    expect(fixture.expected.cleaned_text).toBe(cleanTechnocoreLine(fixture.input.text));
    const result = await capability3.executeTechnocoreCanonicalMessage(fixture.input);
    expect(await capability3.evaluatePractice(result, fixture)).toBe(true);
  });

  it("Capability 4 practice agrees with how the fixture was built", async () => {
    const fixture = await capability4.createPracticeFixture();
    const result = await capability4.executeSignedReceiptVerification(fixture.input);
    expect(await capability4.evaluatePractice(result, fixture)).toBe(true);
  });
});
