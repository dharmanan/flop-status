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
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  backup: FlopIdentityBackup;
}

export function bytesToBase64Url(bytes: Uint8Array): string;
export function base64UrlToBytes(value: string): Uint8Array;
export function didFromPublicKey(raw: Uint8Array): string;
export function parseEd25519DidKey(did: string): Uint8Array;
export function createPortableIdentity(passphrase: string): Promise<PortableIdentity>;
export function restorePortableIdentity(backup: FlopIdentityBackup, passphrase: string): Promise<PortableIdentity>;
export function serializeBackup(backup: FlopIdentityBackup): string;
export function parseBackupJson(text: string): FlopIdentityBackup;
