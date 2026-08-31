import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encodeBase64Url } from "../../lib/crypto/base64url.js";
import { verifyPassReceiptSignature } from "../../lib/receipts/receipt.js";
import {
  ATTESTATION_KEY_ID_ENV,
  ATTESTATION_PRIVATE_KEY_ENV,
  AttestationConfigurationError,
  loadAttestationSignerFromEnv,
} from "../../lib/receipts/attestation-signer.js";
import { signPassReceipt } from "../../lib/receipts/receipt.js";
import { sha256 } from "../../lib/crypto/sha256.js";

function envFixture() {
  const { privateKey } = generateKeyPairSync("ed25519");
  const der = privateKey.export({ format: "der", type: "pkcs8" });
  return {
    [ATTESTATION_KEY_ID_ENV]: "capability-lab-attestation-test-1",
    [ATTESTATION_PRIVATE_KEY_ENV]: encodeBase64Url(new Uint8Array(der)),
  } as NodeJS.ProcessEnv;
}

function unsignedReceipt(serverKeyId: string) {
  return {
    receipt_version: "1" as const,
    receipt_id: "11111111-1111-4111-8111-111111111111",
    agent_did: "did:key:z6MkrJVnaZkeFzdQy7uZJ4M6vP4qcBkpGRq1YhJHaCQYqNPa",
    capability_id: "cryptography.signature-verification",
    trial_id: "ed25519-signature-verification",
    trial_version: "1",
    challenge_id: "22222222-2222-4222-8222-222222222222",
    challenge_hash: sha256(new TextEncoder().encode("challenge")),
    result_hash: sha256(new TextEncoder().encode("result")),
    verifier_id: "ed25519-signature-verifier",
    verifier_version: "1",
    verdict: "PASS" as const,
    evidence_type: "DETERMINISTICALLY_VERIFIED" as const,
    issued_at: "2026-08-31T08:00:00.000Z",
    server_key_id: serverKeyId,
  };
}

describe("Railway attestation signer configuration", () => {
  it("loads an Ed25519 PKCS8 private key and signs receipts with the derived public key", () => {
    const signer = loadAttestationSignerFromEnv(envFixture());
    const receipt = signPassReceipt(unsignedReceipt(signer.keyId), signer);
    expect(verifyPassReceiptSignature(receipt, signer.publicKey)).toBe(true);
    expect(signer).not.toHaveProperty("privateKey");
  });

  it("rejects missing private key configuration", () => {
    expect(() =>
      loadAttestationSignerFromEnv({ [ATTESTATION_KEY_ID_ENV]: "key-1" }),
    ).toThrow(AttestationConfigurationError);
  });

  it("rejects invalid key ids", () => {
    const env = envFixture();
    env[ATTESTATION_KEY_ID_ENV] = "bad key id with spaces";
    expect(() => loadAttestationSignerFromEnv(env)).toThrow(AttestationConfigurationError);
  });

  it("rejects non-key base64url data", () => {
    expect(() =>
      loadAttestationSignerFromEnv({
        [ATTESTATION_KEY_ID_ENV]: "key-1",
        [ATTESTATION_PRIVATE_KEY_ENV]: encodeBase64Url(new TextEncoder().encode("not-a-key")),
      }),
    ).toThrow(AttestationConfigurationError);
  });
});
