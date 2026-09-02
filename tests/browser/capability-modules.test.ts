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
import { generateConstraintPolicyComplianceChallenge } from "../../lib/trials/constraint-policy-compliance/challenge-generator.js";
import { PRODUCTION_TRIAL_ID as TRIAL6_PRODUCTION_ID } from "../../lib/trials/constraint-policy-compliance/constants.js";
import type { Trial6CaseClass } from "../../lib/trials/constraint-policy-compliance/schema.js";
import { evaluatePolicy } from "../../lib/trials/constraint-policy-compliance/evaluate.js";
import { verifyTrial6Result } from "../../lib/trials/constraint-policy-compliance/verifier.js";
import { generateFailureRecoveryIdempotencyChallenge } from "../../lib/trials/failure-recovery-idempotency/challenge-generator.js";
import { PRODUCTION_TRIAL_ID as TRIAL7_PRODUCTION_ID } from "../../lib/trials/failure-recovery-idempotency/constants.js";
import type { Trial7CaseClass } from "../../lib/trials/failure-recovery-idempotency/schema.js";
import { simulateFailureRecovery } from "../../lib/trials/failure-recovery-idempotency/simulate.js";
import { verifyTrial7Result } from "../../lib/trials/failure-recovery-idempotency/verifier.js";
import { generateStructuredDataTransformationChallenge } from "../../lib/trials/structured-data-transformation/challenge-generator.js";
import { PRODUCTION_TRIAL_ID as TRIAL5_PRODUCTION_ID } from "../../lib/trials/structured-data-transformation/constants.js";
import type { Trial5CaseClass } from "../../lib/trials/structured-data-transformation/schema.js";
import { applyTransformation } from "../../lib/trials/structured-data-transformation/transform.js";
import { verifyTrial5Result } from "../../lib/trials/structured-data-transformation/verifier.js";
import { generateTechnocoreCanonicalMessageChallenge } from "../../lib/trials/technocore-canonical-message/challenge-generator.js";
import { PRODUCTION_TRIAL_ID as TRIAL3_PRODUCTION_ID } from "../../lib/trials/technocore-canonical-message/constants.js";
import { cleanTechnocoreLine } from "../../lib/trials/technocore-canonical-message/protocol.js";
import type { Trial3CaseClass } from "../../lib/trials/technocore-canonical-message/schema.js";
import { verifyTrial3Result } from "../../lib/trials/technocore-canonical-message/verifier.js";
import * as capability2 from "../../web/capabilities/canonical-json-sha256.js";
import * as capability1 from "../../web/capabilities/ed25519-signature-verification.js";
import { canonicalizeJson as browserCanonicalizeJson } from "../../web/capabilities/jcs.js";
import * as capability4 from "../../web/capabilities/signed-receipt-verification.js";
import * as capability6 from "../../web/capabilities/constraint-policy-compliance.js";
import * as capability7 from "../../web/capabilities/failure-recovery-idempotency.js";
import * as capability5 from "../../web/capabilities/structured-data-transformation.js";
import * as capability3 from "../../web/capabilities/technocore-canonical-message.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

const agent = generateTestEd25519Identity();

const TRIAL1_CASES: Trial1CaseClass[] = ["VALID_SIGNATURE", "INVALID_SIGNATURE"];
const TRIAL2_CASES: Trial2CaseClass[] = ["NESTED_OBJECT", "UNICODE_KEYS", "ARRAY_MIX", "NUMERIC_EDGE"];
const TRIAL3_CASES: Trial3CaseClass[] = ["WHITESPACE_CONTROL", "UNICODE_TEXT", "PIPE_TEXT", "PLAIN_TEXT"];
const TRIAL4_CASES: Trial4CaseClass[] = ["VALID", "TAMPERED_FIELD", "KEY_ID_MISMATCH", "UNKNOWN_KEY"];
const TRIAL5_CASES: Trial5CaseClass[] = [
  "VALID",
  "SOURCE_PATH_MISSING",
  "INVALID_TYPE_COERCION",
  "UNSUPPORTED_OPERATION",
  "TARGET_PATH_CONFLICT",
];
const TRIAL6_CASES: Trial6CaseClass[] = ["COMPLIANT", "SINGLE_VIOLATION", "MULTIPLE_VIOLATIONS", "UNSUPPORTED_RULE", "INVALID_POLICY"];
const TRIAL7_CASES: Trial7CaseClass[] = [
  "SUCCESS_FIRST_ATTEMPT",
  "RECOVER_THEN_SUCCEED",
  "DUPLICATE_AFTER_SUCCESS",
  "RETRY_LIMIT_EXCEEDED",
  "PERMANENT_FAILURE",
];

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

describe("browser structured data transformation agrees with the server engine", () => {
  const cases: Array<{ source: unknown; spec: unknown }> = [
    {
      source: { customer: { name: "Ada", country: "TR" }, items: [{ sku: "A12", qty: "2", price: 125.5 }] },
      spec: {
        version: "1",
        operations: [
          { op: "rename", from: "customer.name", to: "buyer.full_name" },
          { op: "copy", from: "customer.country", to: "buyer.country" },
          {
            op: "map_array",
            from: "items",
            to: "lines",
            fields: {
              sku: { from: "sku", type: "string" },
              quantity: { from: "qty", type: "integer" },
              unit_price: { from: "price", type: "number" },
            },
          },
        ],
      },
    },
    { source: { a: 1 }, spec: { version: "1", operations: [{ op: "copy", from: "b", to: "c" }] } },
    { source: { items: [{ sku: 1 }] }, spec: { version: "1", operations: [{ op: "map_array", from: "items", to: "lines", fields: { sku: { from: "sku", type: "integer" } } }] } },
    { source: { a: 1 }, spec: { version: "1", operations: [{ op: "eval", from: "a", to: "b" }] } },
    {
      source: { a: 1, b: 2 },
      spec: { version: "1", operations: [{ op: "copy", from: "a", to: "x.y" }, { op: "copy", from: "b", to: "x.y" }] },
    },
  ];

  for (const [index, { source, spec }] of cases.entries()) {
    it(`produces identical reason_code and result for case ${index}`, async () => {
      const browserResult = await capability5.executeStructuredDataTransformation({ source, spec });
      const serverResult = applyTransformation(source, spec as never);
      expect(browserResult).toEqual(serverResult);
    });
  }
});

describe("browser constraint & policy compliance agrees with the server engine", () => {
  const cases: Array<{ document: unknown; policy: unknown }> = [
    {
      document: { order: { country: "TR", currency: "TRY", amount: 1250, customer_type: "business" } },
      policy: {
        version: "1",
        rules: [
          { id: "currency_by_country", type: "equals", path: "order.currency", value: "TRY" },
          { id: "amount_limit", type: "number_max", path: "order.amount", value: 5000 },
          { id: "customer_type", type: "one_of", path: "order.customer_type", values: ["individual", "business"] },
          { id: "required_country", type: "required", path: "order.country" },
        ],
      },
    },
    {
      document: { order: { amount: 9999, currency: "USD" } },
      policy: {
        version: "1",
        rules: [
          { id: "amount_limit", type: "number_max", path: "order.amount", value: 5000 },
          { id: "currency_by_country", type: "equals", path: "order.currency", value: "TRY" },
        ],
      },
    },
    { document: { a: 1 }, policy: { version: "1", rules: [{ id: "bad", type: "matches_regex", path: "a" }] } },
    { document: { a: 1 }, policy: { version: "1", rules: [{ id: "bad", type: "number_min", path: "a" }] } },
  ];

  for (const [index, { document, policy }] of cases.entries()) {
    it(`produces identical reason_code and result for case ${index}`, async () => {
      const browserResult = await capability6.executeConstraintPolicyCompliance({ document, policy });
      const serverResult = evaluatePolicy(document, policy as never);
      expect(browserResult).toEqual(serverResult);
    });
  }
});

describe("browser failure recovery & idempotency agrees with the server engine", () => {
  const scenarios: unknown[] = [
    {
      operation: { idempotency_key: "op_a", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
      retry_policy: { max_attempts: 3, retry_on: ["TRANSIENT_FAILURE"] },
    },
    {
      operation: { idempotency_key: "op_b", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [
        { attempt: 1, outcome: "SUCCESS" },
        { attempt: 2, outcome: "DUPLICATE_DELIVERY" },
      ],
      retry_policy: { max_attempts: 3, retry_on: ["TRANSIENT_FAILURE"] },
    },
    {
      operation: { idempotency_key: "op_c", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [
        { attempt: 1, outcome: "TRANSIENT_FAILURE" },
        { attempt: 2, outcome: "TRANSIENT_FAILURE" },
      ],
      retry_policy: { max_attempts: 1, retry_on: ["TRANSIENT_FAILURE"] },
    },
    {
      operation: { idempotency_key: "op_d", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [{ attempt: 1, outcome: "PERMANENT_FAILURE" }],
      retry_policy: { max_attempts: 3, retry_on: ["TRANSIENT_FAILURE"] },
    },
    {
      operation: { idempotency_key: "op_e", type: "append_unique", path: "tags", value: "vip" },
      initial_state: { tags: ["new"] },
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
      retry_policy: { max_attempts: 3, retry_on: ["TRANSIENT_FAILURE"] },
    },
    {
      operation: { idempotency_key: "op_f", type: "increment", path: "balance", amount: 5 },
      initial_state: { balance: "not-a-number" },
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
      retry_policy: { max_attempts: 3, retry_on: ["TRANSIENT_FAILURE"] },
    },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    it(`produces identical reason_code and result for case ${index}`, async () => {
      const browserResult = await capability7.executeFailureRecoveryIdempotency(scenario as never);
      const serverResult = simulateFailureRecovery(scenario);
      expect(browserResult).toEqual(serverResult);
    });
  }
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

  for (const caseClass of TRIAL5_CASES) {
    it(`Capability 5 passes a fresh ${caseClass} production challenge`, async () => {
      const challenge = generateStructuredDataTransformationChallenge({
        agentDid: agent.did,
        trialId: TRIAL5_PRODUCTION_ID,
        caseClass,
      });
      const result = await capability5.executeStructuredDataTransformation(challenge.publicPayload.case as never);
      const verification = verifyTrial5Result({
        publicPayload: challenge.publicPayload,
        hiddenContext: challenge.hiddenContext,
        result,
      });
      expect(verification.verdict).toBe("PASS");
      expect(verification.reason_code).toBe("EXPECTED_RESULT_MATCH");
      expect(result.reason_code).toBe(challenge.hiddenContext.expected_reason_code);
    });
  }

  for (const caseClass of TRIAL6_CASES) {
    it(`Capability 6 passes a fresh ${caseClass} production challenge`, async () => {
      const challenge = generateConstraintPolicyComplianceChallenge({
        agentDid: agent.did,
        trialId: TRIAL6_PRODUCTION_ID,
        caseClass,
      });
      const result = await capability6.executeConstraintPolicyCompliance(challenge.publicPayload.case as never);
      const verification = verifyTrial6Result({
        publicPayload: challenge.publicPayload,
        hiddenContext: challenge.hiddenContext,
        result,
      });
      expect(verification.verdict).toBe("PASS");
      expect(verification.reason_code).toBe("EXPECTED_RESULT_MATCH");
      expect(result.reason_code).toBe(challenge.hiddenContext.expected_reason_code);
    });
  }

  for (const caseClass of TRIAL7_CASES) {
    it(`Capability 7 passes a fresh ${caseClass} production challenge`, async () => {
      const challenge = generateFailureRecoveryIdempotencyChallenge({
        agentDid: agent.did,
        trialId: TRIAL7_PRODUCTION_ID,
        caseClass,
      });
      const result = await capability7.executeFailureRecoveryIdempotency(challenge.publicPayload.case as never);
      const verification = verifyTrial7Result({
        publicPayload: challenge.publicPayload,
        hiddenContext: challenge.hiddenContext,
        result,
      });
      expect(verification.verdict).toBe("PASS");
      expect(verification.reason_code).toBe("EXPECTED_RESULT_MATCH");
      expect(result.reason_code).toBe(challenge.hiddenContext.expected_reason_code);
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

  it("Capability 5 practice agrees with how the fixture was built", async () => {
    const fixture = capability5.createPracticeFixture();
    const result = await capability5.executeStructuredDataTransformation(fixture.input);
    expect(await capability5.evaluatePractice(result, fixture)).toBe(true);
  });

  it("Capability 6 practice agrees with how the fixture was built", async () => {
    const fixture = capability6.createPracticeFixture();
    const result = await capability6.executeConstraintPolicyCompliance(fixture.input);
    expect(await capability6.evaluatePractice(result, fixture)).toBe(true);
  });

  it("Capability 7 practice agrees with how the fixture was built", async () => {
    const fixture = capability7.createPracticeFixture();
    const result = await capability7.executeFailureRecoveryIdempotency(fixture.input);
    expect(await capability7.evaluatePractice(result, fixture)).toBe(true);
  });
});
