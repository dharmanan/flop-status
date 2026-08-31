import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../web/agent.js", import.meta.url), "utf8");
const capability = readFileSync(
  new URL("../../web/capabilities/ed25519-signature-verification.js", import.meta.url),
  "utf8",
);

describe("production capability browser custody boundary", () => {
  it("requests only the production Capability 1 certification challenge", () => {
    expect(source).toContain('trial_id: PRODUCTION_TRIAL_ID');
    expect(source).toContain('PRODUCTION_TRIAL_ID');
    expect(source).not.toContain('trialId: "canonical-json-sha256"');
    expect(source).not.toContain('trialId: "technocore-canonical-message"');
    expect(source).not.toContain('trialId: "signed-receipt-verification"');
  });

  it("uses the same versioned capability module for practice, verification and normal use", () => {
    expect(source).toContain('executeEd25519SignatureVerification(fixture.input)');
    expect(source).toContain('executeEd25519SignatureVerification(challenge.case)');
    expect(source).toContain('executeEd25519SignatureVerification({');
    expect(capability).toContain('export async function executeEd25519SignatureVerification');
  });

  it("submits only the canonical payload and DID signature for certification", () => {
    expect(source).toContain('body: JSON.stringify({\n          payload,');
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
    expect(source).toContain('/product-capabilities/${encodeURIComponent(CAPABILITY_ID)}/acquire');
    expect(source).toContain('{ method: "POST" }');
  });

  it("removes old test-specific solver implementations from the production browser controller", () => {
    expect(source).not.toContain("solveTrial1");
    expect(source).not.toContain("solveTrial2");
    expect(source).not.toContain("solveTrial3");
    expect(source).not.toContain("solveTrial4");
    expect(source).not.toContain("cleanTechnocoreLine");
    expect(source).not.toContain("verifyReceiptWithKey");
  });
});
