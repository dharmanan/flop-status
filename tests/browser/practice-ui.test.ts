import { describe, expect, it } from "vitest";
import {
  createFreshPracticeFixture,
  evaluatePracticeFixture,
  executePracticeFixture,
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
