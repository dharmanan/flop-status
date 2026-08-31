import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CORE_PATHS = [
  "../../lib/trials/ed25519-signature-verification/verifier.ts",
  "../../lib/trials/canonical-json-sha256/verifier.ts",
  "../../lib/trials/technocore-canonical-message/protocol.ts",
  "../../lib/trials/technocore-canonical-message/verifier.ts",
  "../../lib/verification/finalization-service.ts",
  "../../lib/submissions/submission-service.ts",
  "../../lib/challenges/issuance-service.ts",
] as const;

const FORBIDDEN_EXTERNAL_DEPENDENCIES = [
  "technocore.chat",
  "https://technocore",
  "http://technocore",
  "proxyget(",
  "/api/technocore",
] as const;

describe("Technocore network independence", () => {
  it("keeps core challenge, submission and verification independent of Technocore availability", () => {
    for (const relativePath of CORE_PATHS) {
      const source = readFileSync(new URL(relativePath, import.meta.url), "utf8").toLowerCase();
      for (const forbidden of FORBIDDEN_EXTERNAL_DEPENDENCIES) {
        expect(source, relativePath).not.toContain(forbidden);
      }
    }
  });

  it("keeps the local Trial 3 protocol helper and verifier free of network calls", () => {
    for (const relativePath of [
      "../../lib/trials/technocore-canonical-message/protocol.ts",
      "../../lib/trials/technocore-canonical-message/verifier.ts",
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      expect(source, relativePath).not.toMatch(/\bfetch\s*\(/);
    }
  });
});
