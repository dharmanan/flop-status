import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../web/agent.js", import.meta.url), "utf8");
const capability1 = readFileSync(
  new URL("../../web/capabilities/ed25519-signature-verification.js", import.meta.url),
  "utf8",
);
const capability2 = readFileSync(
  new URL("../../web/capabilities/canonical-json-sha256.js", import.meta.url),
  "utf8",
);

describe("production capability browser custody boundary", () => {
  it("requests only certificate-eligible production trials for Capability 1 and 2", () => {
    expect(source).toContain("CAPABILITY1_TRIAL_ID");
    expect(source).toContain("CAPABILITY2_TRIAL_ID");
    expect(capability1).toContain('PRODUCTION_TRIAL_ID = "ed25519-signature-verification-certification"');
    expect(capability2).toContain('PRODUCTION_TRIAL_ID = "canonical-json-sha256-certification"');
    expect(source).not.toContain('trialId: "technocore-canonical-message"');
    expect(source).not.toContain('trialId: "signed-receipt-verification"');
  });

  it("uses the same versioned Capability 1 implementation for practice, verification and normal use", () => {
    expect(source).toContain("executeEd25519SignatureVerification(fixture.input)");
    expect(source).toContain("certifyCapability(1, executeEd25519SignatureVerification)");
    expect(source).toContain("executeEd25519SignatureVerification({ public_key: publicKey");
    expect(capability1).toContain("export async function executeEd25519SignatureVerification");
  });

  it("uses the same versioned Capability 2 implementation for practice, verification and normal use", () => {
    expect(source).toContain("executeCanonicalJsonSha256(fixture.input)");
    expect(source).toContain("certifyCapability(2, executeCanonicalJsonSha256)");
    expect(source).toContain("executeCanonicalJsonSha256({ document })");
    expect(capability2).toContain("export async function executeCanonicalJsonSha256");
  });

  it("submits only canonical payload and DID signature for certification", () => {
    expect(source).toContain("body: JSON.stringify({\n        payload,");
    expect(source).toContain('signature: { algorithm: "Ed25519", encoding: "base64url", value: bytesToBase64Url(signature) }');
  });

  it("does not serialize seed, backup passphrase or private key material into API request bodies", () => {
    expect(source).not.toMatch(/JSON\.stringify\([^)]*(pendingSeed|seedHex|passphrase|privateKey|private_jwk)/s);
    expect(source).not.toMatch(/body:\s*JSON\.stringify\([^)]*(backup|restore-passphrase|backup-passphrase)/s);
  });

  it("keeps seed and backup operations local to browser APIs", () => {
    expect(source).toContain("navigator.clipboard.writeText(pendingSeed)");
    expect(source).toContain("createEncryptedBackupFromSeed(pendingSeed, passphrase)");
    expect(source).toContain("restorePortableIdentity(backup, passphrase)");
    expect(source).toContain("indexedDB.open(DB_NAME, 1)");
  });

  it("acquires by public DID and capability id without sending private material", () => {
    expect(source).toContain('/product-capabilities/${encodeURIComponent(config.capabilityId)}/acquire');
    expect(source).toContain('{ method: "POST" }');
  });

  it("does not reintroduce old test-specific solver functions", () => {
    expect(source).not.toContain("solveTrial1");
    expect(source).not.toContain("solveTrial2");
    expect(source).not.toContain("solveTrial3");
    expect(source).not.toContain("solveTrial4");
    expect(source).not.toContain("cleanTechnocoreLine");
    expect(source).not.toContain("verifyReceiptWithKey");
  });
});
