import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../web/agent.js", import.meta.url), "utf8");

const capabilityDir = fileURLToPath(new URL("../../web/capabilities/", import.meta.url));
const capabilityModules = Object.fromEntries(
  readdirSync(capabilityDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => [name, readFileSync(capabilityDir + name, "utf8")]),
);

const EXECUTORS = [
  ["ed25519-signature-verification.js", "executeEd25519SignatureVerification"],
  ["canonical-json-sha256.js", "executeCanonicalJsonSha256"],
  ["technocore-canonical-message.js", "executeTechnocoreCanonicalMessage"],
  ["signed-receipt-verification.js", "executeSignedReceiptVerification"],
  ["structured-data-transformation.js", "executeStructuredDataTransformation"],
  ["constraint-policy-compliance.js", "executeConstraintPolicyCompliance"],
  ["failure-recovery-idempotency.js", "executeFailureRecoveryIdempotency"],
] as const;

describe("production capability browser custody boundary", () => {
  it("requests only production certification trial ids for each capability", () => {
    for (const [file, executor] of EXECUTORS) {
      expect(capabilityModules[file]).toContain(`export async function ${executor}`);
      expect(capabilityModules[file]).toMatch(/PRODUCTION_TRIAL_ID = "[a-z0-9-]+-certification"/);
    }
    expect(source).not.toContain('trialId: "canonical-json-sha256"');
    expect(source).not.toContain('trialId: "technocore-canonical-message"');
    expect(source).not.toContain('trialId: "signed-receipt-verification"');
    expect(source).not.toContain('trialId: "ed25519-signature-verification"');
    expect(source).not.toContain('trialId: "structured-data-transformation"');
    expect(source).not.toContain('trialId: "constraint-policy-compliance"');
    expect(source).not.toContain('trialId: "failure-recovery-idempotency"');
  });

  it("uses the same installed module for practice, certification and normal use — one executor per capability", () => {
    // The page controller only ever calls config.execute; there is no
    // certification-specific code path and no second implementation.
    expect(source).toContain("await config.execute(fixture.input)");
    expect(source).toContain("await config.execute(challenge.case)");
    expect(source).toContain("executeEd25519SignatureVerification({ public_key: publicKey");
    expect(source).toContain("executeCanonicalJsonSha256({ document: document_ })");
    expect(source).toContain("executeTechnocoreCanonicalMessage({ room, nonce, text })");
    expect(source).toContain("executeSignedReceiptVerification({ receipt, server_keys: serverKeys })");
    expect(source).toContain("executeStructuredDataTransformation({ source, spec })");
    expect(source).toContain("executeConstraintPolicyCompliance({ document: document_, policy })");
    expect(source).toContain("await executeFailureRecoveryIdempotency(scenario)");
  });

  it("submits only the canonical payload and DID signature for certification", () => {
    expect(source).toContain("body: JSON.stringify({\n          payload,");
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

  it("never sends seed, private key or passphrase from a capability module", () => {
    for (const [file, text] of Object.entries(capabilityModules)) {
      expect(text, file).not.toContain("fetch(");
      expect(text, file).not.toContain("pendingSeed");
      expect(text, file).not.toContain("passphrase");
      expect(text, file).not.toContain("seedHex");
    }
  });

  it("acquires by public DID and capability id without sending private material", () => {
    expect(source).toContain("/product-capabilities/${encodeURIComponent(config.capabilityId)}/acquire");
    expect(source).toContain('{ method: "POST" }');
  });

  it("keeps test-specific solvers out of the production browser controller and modules", () => {
    for (const text of [source, ...Object.values(capabilityModules)]) {
      expect(text).not.toContain("solveTrial1");
      expect(text).not.toContain("solveTrial2");
      expect(text).not.toContain("solveTrial3");
      expect(text).not.toContain("solveTrial4");
    }
    expect(source).not.toContain("cleanTechnocoreLine");
    expect(source).not.toContain("verifyReceiptWithKey");
  });

  it("never hands a hidden expected answer to a capability module", () => {
    for (const text of [source, ...Object.values(capabilityModules)]) {
      expect(text).not.toContain("hidden_context");
      expect(text).not.toContain("hiddenContext");
    }
    expect(source).not.toMatch(/challenge\.(expected|hidden)/);
  });
});
