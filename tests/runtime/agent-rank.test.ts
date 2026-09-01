import { describe, expect, it } from "vitest";
import { rankForCertificateCount } from "../../lib/runtime/agent-rank.js";

describe("cumulative rank derivation", () => {
  it("has no named rank below three certificates", () => {
    for (const count of [0, 1, 2]) {
      expect(rankForCertificateCount(count)).toBeNull();
    }
  });

  it("uses the documented v1 thresholds", () => {
    const expected: Array<[number, string]> = [
      [3, "Rookie"],
      [4, "Rookie"],
      [5, "Regular"],
      [6, "Regular"],
      [7, "Core Verified"],
      [8, "Advanced"],
      [9, "Advanced"],
      [10, "Agentic Verified"],
    ];
    for (const [count, name] of expected) {
      expect(rankForCertificateCount(count)?.rank_name).toBe(name);
    }
  });

  it("keeps the highest rank for counts beyond the program", () => {
    expect(rankForCertificateCount(12)?.rank_name).toBe("Agentic Verified");
  });
});
