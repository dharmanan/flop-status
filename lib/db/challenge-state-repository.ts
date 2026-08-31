import type { Pool } from "pg";

export interface ChallengeRecoveryState {
  challenge_id: string;
  state: "ISSUED" | "SUBMITTED" | "PASS" | "FAIL" | "UNKNOWN" | "EXPIRED";
  expires_at: string;
  receipt_id: string | null;
}

export interface ChallengeStateRepository {
  findChallengeState(challengeId: string): Promise<ChallengeRecoveryState | null>;
}

export class PgChallengeStateRepository implements ChallengeStateRepository {
  constructor(private readonly pool: Pool) {}

  async findChallengeState(challengeId: string): Promise<ChallengeRecoveryState | null> {
    const result = await this.pool.query<{
      challenge_id: string;
      state: ChallengeRecoveryState["state"];
      expires_at: Date | string;
      receipt_id: string | null;
    }>(
      `SELECT ci.id AS challenge_id, ci.state::text AS state,
         ci.expires_at, r.id AS receipt_id
       FROM challenge_instances ci
       LEFT JOIN receipts r ON r.challenge_id = ci.id
       WHERE ci.id = $1`,
      [challengeId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      challenge_id: row.challenge_id,
      state: row.state,
      expires_at: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
      receipt_id: row.receipt_id,
    };
  }
}
