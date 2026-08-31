import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../web/agent.js", import.meta.url), "utf8");

describe("browser custody network boundary", () => {
  it("sends only public challenge identity fields when creating supported trials", () => {
    expect(source).toContain('body: JSON.stringify({ agent_did: identity.did, trial_id: trial.trialId })');
    expect(source).toContain('trialId: "ed25519-signature-verification"');
    expect(source).toContain('trialId: "canonical-json-sha256"');
    expect(source).toContain('trialId: "technocore-canonical-message"');
    expect(source).toContain('trialId: "signed-receipt-verification"');
  });

  it("submits only the signed envelope after the challenge is solved", () => {
    expect(source).toContain("const envelope = {");
    expect(source).toContain("payload,\n    signature: { algorithm: \"Ed25519\", encoding: \"base64url\", value: signatureValue },");
    expect(source).toContain("body: JSON.stringify(envelope)");
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

  it("solves Trial 3 locally without a Technocore network call", () => {
    expect(source).toContain("cleanTechnocoreLine(challenge.case.text)");
    expect(source).toContain('canonical_message: `${challenge.case.room}|${challenge.case.nonce}|${cleanedText}`');
    expect(source).not.toContain("technocore.chat");
  });

  it("solves Trial 4 locally from receipt and public-key challenge data", () => {
    expect(source).toContain("verifyReceiptWithKey(receipt, declared)");
    expect(source).toContain('reason_code: "SERVER_KEY_NOT_FOUND"');
    expect(source).toContain('reason_code: "KEY_ID_MISMATCH"');
  });
});
