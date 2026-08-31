import type { Pool } from "pg";

export interface PublicAgentCapability {
  capability_id: string;
  evidence_type: string;
  passed_trials: number;
  latest_receipt_id: string | null;
  first_verified_at: string | null;
  last_verified_at: string | null;
}

export interface PublicAgentSummary {
  did: string;
  capabilities: PublicAgentCapability[];
}

export interface PublicAgentRepository {
  findAgentByDid(did: string): Promise<PublicAgentSummary | null>;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export class PgPublicAgentRepository implements PublicAgentRepository {
  constructor(private readonly pool: Pool) {}

  async findAgentByDid(did: string): Promise<PublicAgentSummary | null> {
    const agent = await this.pool.query<{ did: string }>(
      "SELECT did FROM agents WHERE did = $1",
      [did],
    );
    if (!agent.rows[0]) return null;

    const capabilities = await this.pool.query<{
      capability_id: string;
      evidence_type: string;
      passed_trials: number;
      latest_receipt_id: string | null;
      first_verified_at: Date | string | null;
      last_verified_at: Date | string | null;
    }>(
      `SELECT capability_id, evidence_type::text AS evidence_type, passed_trials,
         latest_receipt_id, first_verified_at, last_verified_at
       FROM capability_records
       WHERE agent_id = (SELECT id FROM agents WHERE did = $1)
       ORDER BY capability_id ASC`,
      [did],
    );

    return {
      did,
      capabilities: capabilities.rows.map((row) => ({
        capability_id: row.capability_id,
        evidence_type: row.evidence_type,
        passed_trials: row.passed_trials,
        latest_receipt_id: row.latest_receipt_id,
        first_verified_at: iso(row.first_verified_at),
        last_verified_at: iso(row.last_verified_at),
      })),
    };
  }
}
