import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createFreshPracticeFixture,
  evaluatePracticeFixture,
  executePracticeFixture,
  interpretCapabilityUseResult,
  practiceFieldValues,
} from "../../web/practice-ui.js";

const EXPECTED_FIELD_IDS: Record<number, string[]> = {
  1: ["use-message", "use-public-key", "use-signature"],
  2: ["use-json-2"],
  3: ["use-room", "use-nonce", "use-text"],
  4: ["use-receipt", "use-server-keys"],
  5: ["use-source-5", "use-spec-5"],
  6: ["use-document-6", "use-policy-6"],
  7: ["use-scenario-7"],
};

const feedbackCss = readFileSync(new URL("../../web/capability-use-feedback.css", import.meta.url), "utf8");
const profileHint = readFileSync(new URL("../../web/tclk-profile-hint.js", import.meta.url), "utf8");

describe("C1-C7 practice fixtures", () => {
  for (const number of [1, 2, 3, 4, 5, 6, 7]) {
    it(`uses the visible practice fixture as the real Capability ${number} input`, async () => {
      const fixture = await createFreshPracticeFixture(number);
      const fields = practiceFieldValues(number, fixture);
      const expectedFieldIds = EXPECTED_FIELD_IDS[number] ?? [];
      expect(Object.keys(fields).sort()).toEqual([...expectedFieldIds].sort());
      for (const value of Object.values(fields)) expect(value.length).toBeGreaterThan(0);

      const result = await executePracticeFixture(number, fixture);
      await expect(evaluatePracticeFixture(number, result, fixture)).resolves.toBe(true);
    });

    it(`creates a fresh Capability ${number} practice fixture on every run`, async () => {
      const first = await createFreshPracticeFixture(number);
      const second = await createFreshPracticeFixture(number);
      expect(JSON.stringify(first.input)).not.toBe(JSON.stringify(second.input));
    });
  }

  it("uses a human-readable signed message for Capability 1", async () => {
    const fixture = await createFreshPracticeFixture(1);
    const fields = practiceFieldValues(1, fixture);
    expect(fields["use-message"]).toMatch(/^FLOP practice [a-f0-9]+$/);
  });
});

describe("C1-C7 human-readable use feedback", () => {
  it("reports a valid C1 signature as success in Turkish", () => {
    expect(interpretCapabilityUseResult(1, { valid: true, reason_code: "SIGNATURE_VALID" }, "tr")).toEqual({
      tone: "success",
      title: "İmza doğrulandı",
      detail: "Mesaj, public key ve imza birbiriyle eşleşiyor.",
    });
  });

  it("reports canonical JSON, canonical messages and transformations as success", () => {
    expect(interpretCapabilityUseResult(2, { canonical_json: "{}", sha256: "sha256:x" }, "tr").tone).toBe("success");
    expect(interpretCapabilityUseResult(3, { canonical_message: "room|1|hello" }, "tr").tone).toBe("success");
    expect(interpretCapabilityUseResult(5, { reason_code: "TRANSFORMATION_MATCH", result: {} }, "tr").tone).toBe("success");
  });

  it("distinguishes C4 VALID, UNKNOWN and INVALID", () => {
    expect(interpretCapabilityUseResult(4, { status: "VALID" }, "tr").tone).toBe("success");
    expect(interpretCapabilityUseResult(4, { status: "UNKNOWN" }, "tr").tone).toBe("warning");
    expect(interpretCapabilityUseResult(4, { status: "INVALID" }, "tr").tone).toBe("error");
  });

  it("treats a policy violation as a valid warning result rather than a system error", () => {
    const feedback = interpretCapabilityUseResult(6, { reason_code: "POLICY_VIOLATION", result: { violations: [{ rule_id: "x" }] } }, "tr");
    expect(feedback.tone).toBe("warning");
    expect(feedback.title).toBe("Politika ihlali bulundu");
  });

  it("treats committed C7 recovery as success and an exhausted retry plan as warning", () => {
    expect(interpretCapabilityUseResult(7, { reason_code: "IDEMPOTENT_REPLAY", result: { status: "COMMITTED", applied_count: 1 } }, "tr").tone).toBe("success");
    expect(interpretCapabilityUseResult(7, { reason_code: "RETRY_LIMIT_EXCEEDED", result: { status: "FAILED" } }, "tr").tone).toBe("warning");
  });

  it("loads CSP-safe external feedback CSS with separated title and detail blocks", () => {
    expect(profileHint).toContain('/capability-use-feedback.css?v=practice-feedback-v1');
    expect(profileHint).toContain('import("/practice-ui.js?v=practice-ui-v2")');
    expect(feedbackCss).toContain(".capability-use-feedback strong");
    expect(feedbackCss).toContain("display: block;");
    expect(feedbackCss).toContain(".capability-use-feedback span");
  });
});
