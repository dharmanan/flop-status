const encoder = new TextEncoder();
const decoder = new TextDecoder();
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ED25519_PREFIX = Uint8Array.of(0xed, 0x01);
const ED25519_PKCS8_PREFIX = Uint8Array.of(0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20);
const BACKUP_FORMAT = "flop-identity-backup";
const BACKUP_VERSION = 1;
const BACKUP_ITERATIONS = 310000;

export function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/.test(value)) throw new Error("invalid base64url value");
  const pad = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/i.test(value)) throw new Error("Ed25519 seed must be 64 hexadecimal characters");
  const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

export function readSeed(text) {
  const match = String(text ?? "").replace(/[^0-9a-fA-F]+/g, " ").match(/\b[0-9a-fA-F]{64}\b/);
  return match ? match[0].toLowerCase() : null;
}

function base58Encode(bytes) {
  if (bytes.length === 0) return "";
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] * 256;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  let output = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) output += BASE58_ALPHABET[digits[i]];
  return output;
}

function base58Decode(value) {
  if (typeof value !== "string" || value.length === 0) throw new Error("invalid base58btc value");
  const bytes = [0];
  for (const char of value) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit < 0) throw new Error("invalid base58btc character");
    let carry = digit;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let zeros = 0;
  while (zeros < value.length && value[zeros] === "1") zeros += 1;
  const output = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) output[output.length - 1 - i] = bytes[i];
  return output;
}

export function didFromPublicKey(raw) {
  if (!(raw instanceof Uint8Array) || raw.length !== 32) throw new Error("Ed25519 public key must be 32 bytes");
  const prefixed = new Uint8Array(34);
  prefixed.set(ED25519_PREFIX, 0);
  prefixed.set(raw, 2);
  return "did:key:z" + base58Encode(prefixed);
}

export function parseEd25519DidKey(did) {
  if (typeof did !== "string" || !did.startsWith("did:key:z")) throw new Error("only Ed25519 did:key identities are supported");
  const decoded = base58Decode(did.slice("did:key:z".length));
  if (decoded.length !== 34 || decoded[0] !== ED25519_PREFIX[0] || decoded[1] !== ED25519_PREFIX[1]) {
    throw new Error("unsupported or malformed Ed25519 did:key");
  }
  return decoded.slice(2);
}

async function deriveBackupKey(passphrase, salt, iterations, usages) {
  if (typeof passphrase !== "string" || passphrase.length < 10) throw new Error("backup passphrase must be at least 10 characters");
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

function backupAad(did) {
  return encoder.encode(`${BACKUP_FORMAT}:v${BACKUP_VERSION}:${did}`);
}

async function encryptPrivateJwk(did, privateJwk, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, salt, BACKUP_ITERATIONS, ["encrypt"]);
  const plaintext = encoder.encode(JSON.stringify({ did, private_jwk: privateJwk }));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: backupAad(did), tagLength: 128 },
    key,
    plaintext,
  ));
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    did,
    created_at: new Date().toISOString(),
    encryption: {
      algorithm: "AES-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: BACKUP_ITERATIONS,
      salt: bytesToBase64Url(salt),
      iv: bytesToBase64Url(iv),
      ciphertext: bytesToBase64Url(ciphertext),
    },
  };
}

function validateBackupEnvelope(backup) {
  if (!backup || typeof backup !== "object") throw new Error("backup file is not a JSON object");
  if (backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) throw new Error("unsupported FLOP identity backup version");
  parseEd25519DidKey(backup.did);
  const encryption = backup.encryption;
  if (!encryption || encryption.algorithm !== "AES-GCM" || encryption.kdf !== "PBKDF2-SHA256") throw new Error("unsupported backup encryption");
  if (!Number.isInteger(encryption.iterations) || encryption.iterations < 100000 || encryption.iterations > 1000000) throw new Error("invalid backup KDF work factor");
  base64UrlToBytes(encryption.salt);
  base64UrlToBytes(encryption.iv);
  base64UrlToBytes(encryption.ciphertext);
  return backup;
}

async function decryptPrivateJwk(backupInput, passphrase) {
  const backup = validateBackupEnvelope(backupInput);
  const encryption = backup.encryption;
  const salt = base64UrlToBytes(encryption.salt);
  const iv = base64UrlToBytes(encryption.iv);
  const ciphertext = base64UrlToBytes(encryption.ciphertext);
  const key = await deriveBackupKey(passphrase, salt, encryption.iterations, ["decrypt"]);
  let plaintext;
  try {
    plaintext = new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: backupAad(backup.did), tagLength: 128 },
      key,
      ciphertext,
    ));
  } catch {
    throw new Error("backup could not be decrypted; check the passphrase and file integrity");
  }
  let payload;
  try { payload = JSON.parse(decoder.decode(plaintext)); }
  catch { throw new Error("decrypted backup payload is invalid"); }
  if (!payload || payload.did !== backup.did || !payload.private_jwk) throw new Error("backup identity binding is invalid");
  const jwk = payload.private_jwk;
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || typeof jwk.x !== "string" || typeof jwk.d !== "string") throw new Error("backup does not contain an Ed25519 private key");
  const rawPublic = base64UrlToBytes(jwk.x);
  const seedBytes = base64UrlToBytes(jwk.d);
  if (seedBytes.length !== 32) throw new Error("backup does not contain a 32-byte Ed25519 seed");
  if (didFromPublicKey(rawPublic) !== backup.did) throw new Error("backup public key does not match its DID");
  return { backup, jwk, rawPublic, seedHex: bytesToHex(seedBytes) };
}

async function materialFromSeed(seedInput) {
  const seedHex = readSeed(seedInput);
  if (!seedHex) throw new Error("no 64-character Ed25519 seed was found");
  const seedBytes = hexToBytes(seedHex);
  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + seedBytes.length);
  pkcs8.set(ED25519_PKCS8_PREFIX, 0);
  pkcs8.set(seedBytes, ED25519_PKCS8_PREFIX.length);
  const extractablePrivate = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", extractablePrivate);
  if (typeof jwk.x !== "string" || typeof jwk.d !== "string") throw new Error("could not derive Ed25519 key material from seed");
  const rawPublic = base64UrlToBytes(jwk.x);
  const did = didFromPublicKey(rawPublic);
  return { did, seedHex, jwk, rawPublic };
}

async function activeIdentityFromMaterial(material) {
  const privateKey = await crypto.subtle.importKey("jwk", material.jwk, { name: "Ed25519" }, false, ["sign"]);
  const publicKey = await crypto.subtle.importKey("raw", material.rawPublic, { name: "Ed25519" }, true, ["verify"]);
  if (privateKey.extractable) throw new Error("active private key must be nonextractable");
  return { did: material.did, seedHex: material.seedHex, privateKey, publicKey };
}

export async function createPortableIdentity(passphrase = null) {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const rawPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (typeof privateJwk.d !== "string") throw new Error("generated Ed25519 key did not expose a seed");
  const seedBytes = base64UrlToBytes(privateJwk.d);
  if (seedBytes.length !== 32) throw new Error("generated Ed25519 seed must be 32 bytes");
  const seedHex = bytesToHex(seedBytes);
  const did = didFromPublicKey(rawPublic);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "Ed25519" }, false, ["sign"]);
  const publicKey = await crypto.subtle.importKey("raw", rawPublic, { name: "Ed25519" }, true, ["verify"]);
  if (privateKey.extractable) throw new Error("active private key must be nonextractable");
  const backup = passphrase ? await encryptPrivateJwk(did, privateJwk, passphrase) : null;
  return { did, seedHex, privateKey, publicKey, backup };
}

export async function identityFromSeed(seedInput) {
  return activeIdentityFromMaterial(await materialFromSeed(seedInput));
}

export async function createEncryptedBackupFromSeed(seedInput, passphrase) {
  const material = await materialFromSeed(seedInput);
  return encryptPrivateJwk(material.did, material.jwk, passphrase);
}

export async function unlockPrivateKeyBackup(backupInput, passphrase) {
  const { backup, jwk, seedHex } = await decryptPrivateJwk(backupInput, passphrase);
  return {
    did: backup.did,
    seedHex,
    privateKeyBase64Url: jwk.d,
    publicKeyBase64Url: jwk.x,
    jwk: { kty: "OKP", crv: "Ed25519", x: jwk.x, d: jwk.d },
  };
}

export async function restorePortableIdentity(backupInput, passphrase) {
  const { backup, jwk, rawPublic, seedHex } = await decryptPrivateJwk(backupInput, passphrase);
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
  const publicKey = await crypto.subtle.importKey("raw", rawPublic, { name: "Ed25519" }, true, ["verify"]);
  if (privateKey.extractable) throw new Error("restored active private key must be nonextractable");
  return { did: backup.did, seedHex, privateKey, publicKey, backup };
}

export function serializeIdentitySeed(did, seedHex) {
  parseEd25519DidKey(did);
  hexToBytes(seedHex);
  return `FLOP agent identity\ncreated ${new Date().toISOString()}\n\nDID  (public)\n${did}\n\nSEED (private - anyone with this controls this identity)\n${seedHex}\n\nKeep this file offline. Never paste the seed into a website you do not trust.\n`;
}

export function serializeBackup(backup) {
  validateBackupEnvelope(backup);
  return JSON.stringify(backup, null, 2) + "\n";
}

export function parseBackupJson(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error("backup file is not valid JSON"); }
  return validateBackupEnvelope(parsed);
}
