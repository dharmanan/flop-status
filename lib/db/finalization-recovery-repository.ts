import type { Pool } from "pg";
import {
  PgPassFinalizationRepository,
  type PassFinalizationRepository,
  type PassFinalizationTransaction,
} from "./finalization-repository.js";

export interface Trial1FinalizationRepository extends PassFinalizationRepository {
  recordUnknownFinalization(
    challengeId: string,
    reasonCode: string,
    occurredAt: string,
  ): Promise<void>;
}

export class PgTrial1FinalizationRepository implements Trial1FinalizationRepository {
  private readonly normal: PgPassFinalizationRepository;

  constructor(private readonly pool: Pool) {
    this.normal = new PgPassFinalizationRepository(pool);
  }

  withFinalizationTransaction<T>(
    challengeId: string,
    fn: (tx: PassFinalizationTransaction) => Promise<T>,
  ): Promise<T> {
    return this.normal.withFinalizationTransaction(challengeId, fn);
  }

  async recordUnknownFinalization(
    challengeId: string,
    reasonCode: string,
    occurredAt: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    await client.query("BEGIN");
    try {
      const context = await client.query<{
        submission_id: string;
        verifier_id: string;
        verifier_version: string;
        state: string;
      }>(
        `SELECT s.id AS submission_id, td.verifier_id, td.verifier_version, ci.state::text AS state
         FROM challenge_instances ci
         JOIN submissions s ON s.challenge_id = ci.id
         JOIN trial_definitions td ON td.id = ci.trial_definition_id
         WHERE ci.id = $1
         FOR UPDATE OF ci`,
        [challengeId],
      );
      const row = context.rows[0];
      if (!row) throw new Error("UNKNOWN recovery context not found");
      if (row.state !== "SUBMITTED") {
        throw new Error(`UNKNOWN recovery requires SUBMITTED state, got ${row.state}`);
      }

      await client.query(
        `INSERT INTO verification_runs (
           challenge_id, submission_id, verifier_id, verifier_version, verdict,
           reason_code, started_at, completed_at
         ) VALUES ($1,$2,$3,$4,'UNKNOWN',$5,$6,$6)`,
        [challengeId, row.submission_id, row.verifier_id, row.verifier_version, reasonCode, occurredAt],
      );
      const updated = await client.query(
        `UPDATE challenge_instances
         SET state = 'UNKNOWN', completed_at = $2
         WHERE id = $1 AND state = 'SUBMITTED'
         RETURNING id`,
        [challengeId, occurredAt],
      );
      if (updated.rowCount !== 1) throw new Error("challenge was not SUBMITTED during UNKNOWN recovery");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
