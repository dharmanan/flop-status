import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { encodeBase64Url } from "../../lib/crypto/base64url.js";
import type {
  FinalizationContext,
  InsertCapabilityCertificateInput,
  InsertReceiptInput,
  InsertVerificationRunInput,
  PassFinalizationRepository,
  PassFinalizationTransaction,
} from "../../lib/db/finalization-repository.js";
import type { AttestationSigner } from "../../lib/receipts/receipt.js";

/**
 * In-memory PassFinalizationRepository so certificate issuance can be exercised
 * end to end without PostgreSQL. It records exactly which durable writes the
 * finalizer performed.
 */
export class InMemoryFinalizationRepository implements PassFinalizationRepository {
  verificationRuns: InsertVerificationRunInput[] = [];
  receipts: InsertReceiptInput[] = [];
  certificates: InsertCapabilityCertificateInput[] = [];
  capabilityRecords: Array<{ agentId: string; capabilityId: string; receiptId: string }> = [];
  finalStates: Array<{ challengeId: string; verdict: "PASS" | "FAIL" }> = [];

  constructor(private readonly context: FinalizationContext) {}

  async withFinalizationTransaction<T>(
    _challengeId: string,
    fn: (tx: PassFinalizationTransaction) => Promise<T>,
  ): Promise<T> {
    const repository = this;
    return fn({
      async loadContext() {
        return repository.context;
      },
      async insertVerificationRun(input) {
        repository.verificationRuns.push(input);
        return `verification-run-${repository.verificationRuns.length}`;
      },
      async ensureServerKey() {},
      async insertReceipt(input) {
        repository.receipts.push(input);
      },
      async insertCapabilityCertificate(input) {
        repository.certificates.push(input);
      },
      async markChallengeFinal(challengeId, verdict) {
        repository.finalStates.push({ challengeId, verdict });
      },
      async upsertCapabilityRecord(agentId, capabilityId, receiptId) {
        repository.capabilityRecords.push({ agentId, capabilityId, receiptId });
      },
    });
  }
}

export function createTestAttestationSigner(keyId = "test-attestation-key"): AttestationSigner {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  return {
    keyId,
    algorithm: "Ed25519",
    publicKeyEncoding: "base64url",
    publicKey: jwk.x,
    sign(message: Uint8Array): string {
      return encodeBase64Url(new Uint8Array(cryptoSign(null, Buffer.from(message), privateKey)));
    },
  };
}
