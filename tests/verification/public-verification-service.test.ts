import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encodeBase58btc } from "../../lib/crypto/base58.js";
import { decodeBase64Url, encodeBase64Url } from "../../lib/crypto/base64url.js";
import { sha256 } from "../../lib/crypto/sha256.js";
import type {
  PublicVerificationRepository,
  StoredReceiptEvidence,
  StoredServerKey,
} from "../../lib/db/public-verification-repository.js";
import {
  signPassReceipt,
  type AttestationSigner,
  type UnsignedPassReceipt,
} from "../../lib/receipts/receipt.js";
import {
  PublicVerificationIntegrityError,
  PublicVerificationService,
} from "../../lib/verification/public-verification-service.js";
import { canonicalizeJsonToBytes } from "../../lib/crypto/canonical-json.js";

function agentDid(): string {
  const { publicKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  const raw = decodeBase64Url(jwk.x);
  const bytes = new Uint8Array(raw.length + 2);
  bytes.set([0xed, 0x01]);
  bytes.set(raw, 2);
  return `did:key:z${encodeBase58btc(bytes)}`;
}

function fixture() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  const signer: AttestationSigner = {
    keyId: "test-key-1",
    algorithm: "Ed25519",
    publicKeyEncoding: "base64url",
    publicKey: jwk.x,
    sign(message) {
      return encodeBase64Url(new Uint8Array(cryptoSign(null, Buffer.from(message), privateKey)));
    },
  };
  const unsigned: UnsignedPassReceipt = {
    receipt_version: "1",
    receipt_id: "11111111-1111-4111-8111-111111111111",
    agent_did: agentDid(),
    capability_id: "cryptography.signature-verification",
    trial_id: "ed25519-signature-verification",
    trial_version: "1",
    challenge_id: "22222222-2222-4222-8222-222222222222",
    challenge_hash: sha256(new TextEncoder().encode("challenge")),
    result_hash: sha256(new TextEncoder().encode("result")),
    verifier_id: "ed25519-signature-verifier",
    verifier_version: "1",
    verdict: "PASS",
    evidence_type: "DETERMINISTICALLY_VERIFIED",
    issued_at: "2026-08-31T07:00:00.000Z",
    server_key_id: signer.keyId,
  };
  const receipt = signPassReceipt(unsigned, signer);
  const key: StoredServerKey = {
    key_id: signer.keyId,
    algorithm: "Ed25519",
    public_key: signer.publicKey,
    encoding: "base64url",
    status: "ACTIVE",
    valid_from: "2026-08-31T07:00:00.000Z",
    valid_until: null,
  };
  return { signer, unsigned, receipt, key };
}

class FakeRepository implements PublicVerificationRepository {
  constructor(
    private readonly receipt: StoredReceiptEvidence | null,
    private readonly key: StoredServerKey | null,
  ) {}
  async findReceiptById() { return this.receipt; }
  async findServerKeyById() { return this.key; }
  async listServerKeys() { return this.key ? [this.key] : []; }
}

describe("PublicVerificationService", () => {
  it("returns a stored signed receipt and independently reports VALID", async () => {
    const f = fixture();
    const service = new PublicVerificationService(
      new FakeRepository(
        { unsignedPayload: f.unsigned, serverSignature: f.receipt.server_signature },
        f.key,
      ),
    );
    const result = await service.getVerification(f.receipt.receipt_id);
    expect(result?.signature_status).toBe("VALID");
    expect(result?.receipt).toEqual(f.receipt);
    expect(result?.server_key).not.toHaveProperty("private_key");
  });

  it("reports INVALID when signed receipt material is changed in storage", async () => {
    const f = fixture();
    const changed = {
      ...f.unsigned,
      result_hash: sha256(canonicalizeJsonToBytes({ changed: true })),
    };
    const service = new PublicVerificationService(
      new FakeRepository(
        { unsignedPayload: changed, serverSignature: f.receipt.server_signature },
        f.key,
      ),
    );
    const result = await service.getVerification(f.receipt.receipt_id);
    expect(result?.signature_status).toBe("INVALID");
  });

  it("fails closed when the historical public key is missing", async () => {
    const f = fixture();
    const service = new PublicVerificationService(
      new FakeRepository(
        { unsignedPayload: f.unsigned, serverSignature: f.receipt.server_signature },
        null,
      ),
    );
    await expect(service.getVerification(f.receipt.receipt_id)).rejects.toBeInstanceOf(
      PublicVerificationIntegrityError,
    );
  });
});
