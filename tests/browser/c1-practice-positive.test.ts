import { describe, expect, it } from "vitest";
import {
  createValidC1PracticeFixture,
  executeValidC1PracticeFixture,
} from "../../web/c1-practice-positive.js";

describe("Capability 1 positive practice fixture", () => {
  it("always creates a valid Ed25519 practice example", async () => {
    for (let i = 0; i < 8; i += 1) {
      const fixture = await createValidC1PracticeFixture();
      expect(fixture.expected_valid).toBe(true);
      expect(fixture.display.message).toMatch(/^FLOP practice [a-f0-9]+$/);

      const result = await executeValidC1PracticeFixture(fixture);
      expect(result.valid).toBe(true);
      expect(result.reason_code).toBe("SIGNATURE_VALID");
    }
  });
});
