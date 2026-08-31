import type { Pool, PoolClient } from "pg";

export interface FinalizationContext {
  challengeId: string;
  state: string;
  agentId: string;
  agentDid: string;
  submissionId: string;
  resultPayload: unknown;
  resultHash: string;
  capabilityId: string;
  trialId: string;
  trialVersion: string;
  verifierId: string;
  verifierVersion: string;
  challengeHash: string;
  publicPayload: unknown;
  hiddenContext: unknown;
}

export interface InsertVerificationRunInput {
  challengeId: string;
  submissionId: string;
  verifierId: string;
  verifierVersion: string;
  verdict: "PASS" | "FAIL";
  reasonCode: string;
  startedAt: string;
  completedAt: string;
}

export interface EnsureServerKeyInput {
  keyId: string;
  algorithm: "Ed25519";
  publicKey: string;
  publicKeyEncoding: "base64url";
  validFrom: string;
}

export interface InsertReceiptInput {
  id: string;
  receiptVersion: string;
  challengeId: string;
  submissionId: string;
  verificationRunId: string;
  agentId: string;
  capabilityId: string;
  trialId: string;
  trialVersion: string;
  challengeHash: string;
  resultHash: string;
  verifierId: string;
  verifierVersion: string;
  issuedAt: string;
  serverKeyId: string;
  unsignedPayload: unknown;
  serverSignature: string;
}

export interface InsertCapabilityCertificateInput {
  id: string;
  agentId: string;
  capabilityId: string;
  certificateName: string;
  capabilityVersion: string;
  programVersion: string;
  trialId: string;
  trialVersion: string;
  verifierId: string;
  verifierVersion: string;
  receiptId: string;
  issuedAt: string;
}

export interface PassFinalizationTransaction {
  loadContext(): Promise<FinalizationContext | null>;
  insertVerificationRun(input: InsertVerificationRunInput): Promise<string>;
  ensureServerKey(input: EnsureServerKeyInput): Promise<void>;
  insertReceipt(input: InsertReceiptInput): Promise<void>;
  insertCapabilityCertificate(input: InsertCapabilityCertificateInput): Promise<void>;
  markChallengeFinal(challengeId: string, verdict: "PASS" | "FAIL", completedAt: string): Promise<void>;
  upsertCapabilityRecord(agentId: string, capabilityId: string, receiptId: string, verifiedAt: string): Promise<void>;
}

export interface PassFinalizationRepository {
  withFinalizationTransaction<T>(
    challengeId: string,
    fn: (tx: PassFinalizationTransaction) => Promise<T>,
  ): Promise<T>;
}

export class PgPassFinalizationRepository implements PassFinalizationRepository {
  constructor(private readonly pool: Pool) {}

  async withFinalizationTransaction<T>(
    challengeId: string,
    fn: (tx: PassFinalizationTransaction) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    await client.query("BEGIN");
    try {
      const result = await fn(this.transactionScope(client, challengeId));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private transactionScope(client: PoolClient, challengeId: string): PassFinalizationTransaction {
    return {
      async loadContext() {
        const result = await client.query<FinalizationContext>(
          `SELECT ci.id AS "challengeId", ci.state,
             ci.agent_id AS "agentId", a.did AS "agentDid",
             s.id AS "submissionId", s.result_payload AS "resultPayload", s.result_hash AS "resultHash",
             td.capability_id AS "capabilityId", td.trial_id AS "trialId",
             td.trial_version AS "trialVersion", td.verifier_id AS "verifierId",
             td.verifier_version AS "verifierVersion", ci.challenge_hash AS "challengeHash",
             ci.public_payload AS "publicPayload", ci.hidden_context AS "hiddenContext"
           FROM challenge_instances ci
           JOIN agents a ON a.id = ci.agent_id
           JOIN trial_definitions td ON td.id = ci.trial_definition_id
           JOIN submissions s ON s.challenge_id = ci.id
           WHERE ci.id = $1
           FOR UPDATE OF ci`,
          [challengeId],
        );
        return result.rows[0] ?? null;
      },

      async insertVerificationRun(input) {
        const result = await client.query<{ id: string }>(
          `INSERT INTO verification_runs (
             challenge_id, submission_id, verifier_id, verifier_version, verdict,
             reason_code, started_at, completed_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id`,
          [
            input.challengeId,
            input.submissionId,
            input.verifierId,
            input.verifierVersion,
            input.verdict,
            input.reasonCode,
            input.startedAt,
            input.completedAt,
          ],
        );
        const id = result.rows[0]?.id;
        if (!id) throw new Error("verification run insert did not return id");
        return id;
      },

      async ensureServerKey(input) {
        await client.query(
          `INSERT INTO server_signing_keys (
             key_id, algorithm, public_key, public_key_encoding, status, valid_from
           ) VALUES ($1,$2,$3,$4,'ACTIVE',$5)
           ON CONFLICT (key_id) DO NOTHING`,
          [input.keyId, input.algorithm, input.publicKey, input.publicKeyEncoding, input.validFrom],
        );
        const existing = await client.query<{
          algorithm: string;
          public_key: string;
          public_key_encoding: string;
        }>(
          `SELECT algorithm, public_key, public_key_encoding
           FROM server_signing_keys WHERE key_id = $1`,
          [input.keyId],
        );
        const row = existing.rows[0];
        if (
          !row ||
          row.algorithm !== input.algorithm ||
          row.public_key !== input.publicKey ||
          row.public_key_encoding !== input.publicKeyEncoding
        ) {
          throw new Error("server key id is already bound to different public key metadata");
        }
      },

      async insertReceipt(input) {
        await client.query(
          `INSERT INTO receipts (
             id, receipt_version, challenge_id, submission_id, verification_run_id,
             agent_id, capability_id, trial_id, trial_version, challenge_hash,
             result_hash, verifier_id, verifier_version, verdict, evidence_type,
             issued_at, server_key_id, unsigned_payload, server_signature, signature_encoding
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
             'PASS','DETERMINISTICALLY_VERIFIED',$14,$15,$16,$17,'base64url'
           )`,
          [
            input.id,
            input.receiptVersion,
            input.challengeId,
            input.submissionId,
            input.verificationRunId,
            input.agentId,
            input.capabilityId,
            input.trialId,
            input.trialVersion,
            input.challengeHash,
            input.resultHash,
            input.verifierId,
            input.verifierVersion,
            input.issuedAt,
            input.serverKeyId,
            input.unsignedPayload,
            input.serverSignature,
          ],
        );
      },

      async insertCapabilityCertificate(input) {
        await client.query(
          `INSERT INTO capability_certificates (
             id, agent_id, capability_id, certificate_name, capability_version,
             program_version, trial_id, trial_version, verifier_id, verifier_version,
             receipt_id, status, issued_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ACTIVE',$12)
           ON CONFLICT (agent_id, capability_id, capability_version, program_version)
           DO NOTHING`,
          [
            input.id,
            input.agentId,
            input.capabilityId,
            input.certificateName,
            input.capabilityVersion,
            input.programVersion,
            input.trialId,
            input.trialVersion,
            input.verifierId,
            input.verifierVersion,
            input.receiptId,
            input.issuedAt,
          ],
        );
      },

      async markChallengeFinal(id, verdict, completedAt) {
        const result = await client.query(
          `UPDATE challenge_instances
           SET state = $2, completed_at = $3
           WHERE id = $1 AND state = 'SUBMITTED'
           RETURNING id`,
          [id, verdict, completedAt],
        );
        if (result.rowCount !== 1) {
          throw new Error("challenge was not SUBMITTED during finalization");
        }
      },

      async upsertCapabilityRecord(agentId, capabilityId, receiptId, verifiedAt) {
        await client.query(
          `INSERT INTO capability_records (
             agent_id, capability_id, evidence_type, passed_trials, latest_receipt_id,
             first_verified_at, last_verified_at
           ) VALUES ($1,$2,'DETERMINISTICALLY_VERIFIED',1,$3,$4,$4)
           ON CONFLICT (agent_id, capability_id) DO UPDATE SET
             evidence_type = 'DETERMINISTICALLY_VERIFIED',
             passed_trials = capability_records.passed_trials + 1,
             latest_receipt_id = EXCLUDED.latest_receipt_id,
             first_verified_at = COALESCE(capability_records.first_verified_at, EXCLUDED.first_verified_at),
             last_verified_at = EXCLUDED.last_verified_at,
             updated_at = now()`,
          [agentId, capabilityId, receiptId, verifiedAt],
        );
      },
    };
  }
}
