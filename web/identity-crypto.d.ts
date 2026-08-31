export interface FlopIdentityBackup {
  format: "flop-identity-backup";
  version: 1;
  did: string;
  created_at: string;
  encryption: {
    algorithm: "AES-GCM";
    kdf: "PBKDF2-SHA256";
    iterations: number;
    salt: string;
    iv: string;
    ciphertext: string;
  };
}

export interface PortableIdentity {
  did: string;
  seedHex: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  backup: FlopIdentityBackup | null;
}

export interface UnlockedPrivateKey {
  did: string;
  seedHex: string;
  privateKeyBase64Url: string;
  publicKeyBase64Url: string;
  jwk: {
    kty: "OKP";
    crv: "Ed25519";
    x: string;
    d: string;
  };
}

export function bytesToBase64Url(bytes: Uint8Array): string;
export function base64UrlToBytes(value: string): Uint8Array;
export function bytesToHex(bytes: Uint8Array): string;
export function readSeed(text: string): string | null;
export function didFromPublicKey(raw: Uint8Array): string;
export function parseEd25519DidKey(did: string): Uint8Array;
export function createPortableIdentity(passphrase?: string | null): Promise<PortableIdentity>;
export function identityFromSeed(seedInput: string): Promise<PortableIdentity>;
export function createEncryptedBackupFromSeed(seedInput: string, passphrase: string): Promise<FlopIdentityBackup>;
export function unlockPrivateKeyBackup(backup: FlopIdentityBackup, passphrase: string): Promise<UnlockedPrivateKey>;
export function restorePortableIdentity(backup: FlopIdentityBackup, passphrase: string): Promise<PortableIdentity>;
export function serializeIdentitySeed(did: string, seedHex: string): string;
export function serializeBackup(backup: FlopIdentityBackup): string;
export function parseBackupJson(text: string): FlopIdentityBackup;
