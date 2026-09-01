import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const constants = readFileSync(new URL("../../lib/trials/canonical-json-sha256/constants.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../../lib/runtime/trial1-api-service.ts", import.meta.url), "utf8");
const finalization = readFileSync(new URL("../../lib/verification/finalization-service.ts", import.meta.url), "utf8");
const moduleSource = readFileSync(new URL("../../web/capabilities/canonical-json-sha256.js", import.meta.url), "utf8");

describe("Production Capability 2 wiring", () => {
  it("has a certificate-eligible production trial distinct from historical Trial 2", () => {
    expect(constants).toContain('TRIAL_ID = "canonical-json-sha256"');
    expect(constants).toContain('PRODUCTION_TRIAL_ID = "canonical-json-sha256-certification"');
  });

  it("requires the installed production capability before issuing its certification challenge", () => {
    expect(api).toContain("TRIAL2_PRODUCTION_ID");
    expect(api).toContain("TRIAL2_CAPABILITY_ID");
    expect(api).toContain("requireCapabilityInstalled");
  });

  it("creates a separate Capability 2 certificate only for the production trial", () => {
    expect(finalization).toContain("TRIAL2_PRODUCTION_ID");
    expect(finalization).toContain("TRIAL2_CERTIFICATE_NAME");
    expect(finalization).toContain("certificateMetadata");
  });

  it("uses RFC8785-style deterministic canonicalization and browser SHA256", () => {
    expect(moduleSource).toContain("Object.keys(value)");
    expect(moduleSource).toContain(".sort()");
    expect(moduleSource).toContain('crypto.subtle.digest("SHA-256"');
    expect(moduleSource).toContain("executeCanonicalJsonSha256");
  });
});
