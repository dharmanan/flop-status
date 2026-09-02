import { describe, expect, it } from "vitest";
import {
  createEncryptedBackupFromSeed,
  createPortableIdentity,
  identityFromSeed,
  parseBackupJson,
  parseEd25519DidKey,
  readIdentitySeedProfile,
  readSeed,
  restorePortableIdentity,
  serializeBackup,
  serializeIdentitySeed,
  unlockPrivateKeyBackup,
} from "../../web/identity-crypto.js";

describe("portable browser identity custody", () => {
  it("creates a user-owned 32-byte seed and a nonextractable active key", async () => {
    const created = await createPortableIdentity();

    expect(created.did.startsWith("did:key:z6Mk")).toBe(true);
    expect(created.seedHex).toMatch(/^[0-9a-f]{64}$/);
    expect(created.privateKey.extractable).toBe(false);
    expect(created.backup).toBeNull();
  });

  it("restores the exact same DID from the seed and from the downloaded identity text", async () => {
    const created = await createPortableIdentity();
    const restored = await identityFromSeed(created.seedHex);
    const fileText = serializeIdentitySeed(created.did, created.seedHex);
    const restoredFromFile = await identityFromSeed(fileText);

    expect(restored.did).toBe(created.did);
    expect(restoredFromFile.did).toBe(created.did);
    expect(restored.privateKey.extractable).toBe(false);
    expect(readSeed(fileText)).toBe(created.seedHex);
    expect(Array.from(parseEd25519DidKey(restored.did))).toEqual(Array.from(parseEd25519DidKey(created.did)));
  });

  it("carries public agent name and handle metadata without changing seed restore", async () => {
    const created = await createPortableIdentity();
    const fileText = serializeIdentitySeed(created.did, created.seedHex, { displayName: "kohen", handle: "koheneric" });
    const restored = await identityFromSeed(fileText);

    expect(restored.did).toBe(created.did);
    expect(readSeed(fileText)).toBe(created.seedHex);
    expect(readIdentitySeedProfile(fileText)).toEqual({ displayName: "kohen", handle: "koheneric" });
    expect(fileText).toContain("AGENT NAME (public)\nkohen");
    expect(fileText).toContain("HANDLE (public)\n@koheneric");
  });

  it("keeps legacy seed files valid when no profile metadata exists", async () => {
    const created = await createPortableIdentity();
    const legacyText = `FLOP agent identity\n\nDID  (public)\n${created.did}\n\nSEED (private - anyone with this controls this identity)\n${created.seedHex}\n`;
    const restored = await identityFromSeed(legacyText);

    expect(restored.did).toBe(created.did);
    expect(readIdentitySeedProfile(legacyText)).toBeNull();
  });

  it("creates an optional encrypted backup from the same seed without plaintext seed or passphrase", async () => {
    const passphrase = "correct horse battery staple";
    const created = await createPortableIdentity();
    const backup = await createEncryptedBackupFromSeed(created.seedHex, passphrase);

    expect(backup.did).toBe(created.did);
    expect(backup.encryption.algorithm).toBe("AES-GCM");
    expect(backup.encryption.kdf).toBe("PBKDF2-SHA256");

    const serialized = serializeBackup(backup);
    expect(serialized).not.toContain(created.seedHex);
    expect(serialized).not.toContain(passphrase);
  });

  it("reveals the seed from encrypted backup only after the correct passphrase is supplied", async () => {
    const passphrase = "private key reveal passphrase";
    const created = await createPortableIdentity();
    const backup = await createEncryptedBackupFromSeed(created.seedHex, passphrase);
    const unlocked = await unlockPrivateKeyBackup(backup, passphrase);

    expect(unlocked.did).toBe(created.did);
    expect(unlocked.seedHex).toBe(created.seedHex);
    expect(unlocked.jwk.kty).toBe("OKP");
    expect(unlocked.jwk.crv).toBe("Ed25519");
    await expect(unlockPrivateKeyBackup(backup, "wrong password value")).rejects.toThrow(/could not be decrypted/i);
  });

  it("restores the same DID from optional encrypted backup with nonextractable active key", async () => {
    const passphrase = "another sufficiently long passphrase";
    const created = await createPortableIdentity();
    const encrypted = await createEncryptedBackupFromSeed(created.seedHex, passphrase);
    const backup = parseBackupJson(serializeBackup(encrypted));
    const restored = await restorePortableIdentity(backup, passphrase);

    expect(restored.did).toBe(created.did);
    expect(restored.seedHex).toBe(created.seedHex);
    expect(restored.privateKey.extractable).toBe(false);

    const payload = new TextEncoder().encode("custody round trip");
    const signature = await crypto.subtle.sign({ name: "Ed25519" }, restored.privateKey, payload);
    expect(await crypto.subtle.verify({ name: "Ed25519" }, restored.publicKey, signature, payload)).toBe(true);
  });

  it("rejects unsupported existing DID methods", () => {
    expect(() => parseEd25519DidKey("did:web:example.com")).toThrow(/only Ed25519 did:key/i);
  });
});