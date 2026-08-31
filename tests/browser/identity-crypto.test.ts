import { describe, expect, it } from "vitest";
// The production identity module is intentionally plain browser JavaScript.
// @ts-expect-error no TypeScript declaration is required for this static frontend module
import {
  createPortableIdentity,
  parseBackupJson,
  parseEd25519DidKey,
  restorePortableIdentity,
  serializeBackup,
} from "../../web/identity-crypto.js";

describe("portable browser identity custody", () => {
  it("creates a nonextractable active key and an encrypted portable backup", async () => {
    const created = await createPortableIdentity("correct horse battery staple");

    expect(created.did.startsWith("did:key:z6Mk")).toBe(true);
    expect(created.privateKey.extractable).toBe(false);
    expect(created.backup.did).toBe(created.did);
    expect(created.backup.encryption.algorithm).toBe("AES-GCM");
    expect(created.backup.encryption.kdf).toBe("PBKDF2-SHA256");

    const serialized = serializeBackup(created.backup);
    expect(serialized).not.toContain('"d"');
    expect(serialized).not.toContain("correct horse battery staple");
  });

  it("restores the same DID while keeping the restored active key nonextractable", async () => {
    const passphrase = "another sufficiently long passphrase";
    const created = await createPortableIdentity(passphrase);
    const backup = parseBackupJson(serializeBackup(created.backup));
    const restored = await restorePortableIdentity(backup, passphrase);

    expect(restored.did).toBe(created.did);
    expect(restored.privateKey.extractable).toBe(false);
    expect(Array.from(parseEd25519DidKey(restored.did))).toEqual(Array.from(parseEd25519DidKey(created.did)));

    const payload = new TextEncoder().encode("custody round trip");
    const signature = await crypto.subtle.sign({ name: "Ed25519" }, restored.privateKey, payload);
    expect(await crypto.subtle.verify({ name: "Ed25519" }, restored.publicKey, signature, payload)).toBe(true);
  });

  it("rejects a wrong backup passphrase", async () => {
    const created = await createPortableIdentity("this is the right passphrase");
    await expect(restorePortableIdentity(created.backup, "this is definitely wrong")).rejects.toThrow(/could not be decrypted/i);
  });

  it("rejects unsupported existing DID methods", () => {
    expect(() => parseEd25519DidKey("did:web:example.com")).toThrow(/only Ed25519 did:key/i);
  });
});
