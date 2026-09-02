import type { Pool, PoolClient } from "pg";

export interface AgentProfileRecord {
  did: string;
  displayName: string;
  handle: string;
  claimedAt: string;
  updatedAt: string;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function ensureAgent(client: PoolClient, did: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO agents (did, did_method, key_type)
     VALUES ($1, 'key', 'Ed25519')
     ON CONFLICT (did) DO UPDATE SET last_seen_at = now()
     RETURNING id`,
    [did],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("agent upsert did not return id");
  return id;
}

export class PgAgentProfileRepository {
  constructor(private readonly pool: Pool) {}

  async consumeActionNonce(did: string, nonce: string, action: string, consumedAt: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const agentId = await ensureAgent(client, did);
      const inserted = await client.query(
        `INSERT INTO agent_action_nonces (agent_id, nonce, action, consumed_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (agent_id, nonce) DO NOTHING
         RETURNING nonce`,
        [agentId, nonce, action, consumedAt],
      );
      await client.query("COMMIT");
      return inserted.rowCount === 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertProfile(input: {
    did: string;
    displayName: string;
    handle: string;
    claimNonce: string;
    claimSignature: string;
    claimedAt: string;
  }): Promise<AgentProfileRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const agentId = await ensureAgent(client, input.did);
      const result = await client.query<{
        display_name: string;
        handle: string;
        claimed_at: Date | string;
        updated_at: Date | string;
      }>(
        `INSERT INTO agent_profiles (
           agent_id, display_name, handle, claim_nonce, claim_signature, claimed_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$6)
         ON CONFLICT (agent_id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           handle = EXCLUDED.handle,
           claim_nonce = EXCLUDED.claim_nonce,
           claim_signature = EXCLUDED.claim_signature,
           claimed_at = EXCLUDED.claimed_at,
           updated_at = EXCLUDED.updated_at
         RETURNING display_name, handle, claimed_at, updated_at`,
        [agentId, input.displayName, input.handle, input.claimNonce, input.claimSignature, input.claimedAt],
      );
      await client.query("COMMIT");
      const row = result.rows[0];
      if (!row) throw new Error("profile upsert did not return row");
      return {
        did: input.did,
        displayName: row.display_name,
        handle: row.handle,
        claimedAt: iso(row.claimed_at),
        updatedAt: iso(row.updated_at),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getProfileByDid(did: string): Promise<AgentProfileRecord | null> {
    const result = await this.pool.query<{
      did: string;
      display_name: string;
      handle: string;
      claimed_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT a.did, p.display_name, p.handle, p.claimed_at, p.updated_at
       FROM agent_profiles p
       JOIN agents a ON a.id = p.agent_id
       WHERE a.did = $1`,
      [did],
    );
    const row = result.rows[0];
    return row ? {
      did: row.did,
      displayName: row.display_name,
      handle: row.handle,
      claimedAt: iso(row.claimed_at),
      updatedAt: iso(row.updated_at),
    } : null;
  }

  async search(query: string, limit = 20): Promise<AgentProfileRecord[]> {
    const q = query.trim().toLowerCase();
    const result = await this.pool.query<{
      did: string;
      display_name: string;
      handle: string;
      claimed_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT a.did, p.display_name, p.handle, p.claimed_at, p.updated_at
       FROM agent_profiles p
       JOIN agents a ON a.id = p.agent_id
       WHERE $1 = ''
          OR p.handle ILIKE '%' || $1 || '%'
          OR p.display_name ILIKE '%' || $1 || '%'
          OR a.did ILIKE '%' || $1 || '%'
       ORDER BY
         CASE WHEN lower(p.handle) = $1 THEN 0 ELSE 1 END,
         lower(p.display_name), p.handle
       LIMIT $2`,
      [q, Math.max(1, Math.min(limit, 50))],
    );
    return result.rows.map((row) => ({
      did: row.did,
      displayName: row.display_name,
      handle: row.handle,
      claimedAt: iso(row.claimed_at),
      updatedAt: iso(row.updated_at),
    }));
  }
}
