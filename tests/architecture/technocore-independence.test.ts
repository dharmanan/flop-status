import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CORE_PATHS = [
  "../../lib/trials/ed25519-signature-verification/verifier.ts",
  "../../lib/verification/finalization-service.ts",
  "../../lib/submissions/submission-service.ts",
  "../../lib/challenges/issuance-service.ts",
] as const;

describe("Trial 1 Technocore independence", () => {
  it("does not import or call Technocore from the core challenge, submission, verifier or finalization path", () => {
    for (const relativePath of CORE_PATHS) {
      const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      expect(source.toLowerCase(), relativePath).not.toContain("technocore");
    }
  });
});
