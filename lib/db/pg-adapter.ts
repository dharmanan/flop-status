import { Pool, type PoolClient, type QueryResultRow } from "pg";
import {
  PostgresChallengeRepository,
  type ChallengeIssuanceRepository,
  type ChallengeIssuanceTransaction,
  type QueryExecutor,
} from "./challenge-repository.js";
import type { AgentRow, TrialDefinitionRow } from "./types.js";

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        normalizeValue(nested),
      ]),
    );
  }
  return value;
}

class PgExecutor implements QueryExecutor {
  constructor(private readonly queryable: Pick<Pool | PoolClient, "query">) {}

  async query<Row>(text: string, params: readonly unknown[]): Promise<{ rows: Row[] }> {
    const result = await this.queryable.query<QueryResultRow>(text, [...params]);
    return {
      rows: result.rows.map((row) => normalizeValue(row) as Row),
    };
  }
}

/**
 * Concrete repository backed by node-postgres.
 *
 * Non-transactional lookups may use the pool. For the advisory-lock section,
 * this adapter always checks out exactly one PoolClient and keeps BEGIN,
 * pg_advisory_xact_lock, callback queries and COMMIT/ROLLBACK on that same
 * PostgreSQL session before releasing the client.
 */
export class PgChallengeRepository implements ChallengeIssuanceRepository {
  constructor(private readonly pool: Pool) {}

  async findOrCreateAgentByDid(
    did: string,
    didMethod: string,
    keyType: string,
  ): Promise<AgentRow> {
    const repository = new PostgresChallengeRepository(new PgExecutor(this.pool));
    return repository.findOrCreateAgentByDid(did, didMethod, keyType);
  }

  async findActiveTrialDefinition(
    trialId: string,
    trialVersion: string,
  ): Promise<TrialDefinitionRow | null> {
    const repository = new PostgresChallengeRepository(new PgExecutor(this.pool));
    return repository.findActiveTrialDefinition(trialId, trialVersion);
  }

  async withAgentTrialLock<T>(
    agentId: string,
    trialDefinitionId: string,
    fn: (tx: ChallengeIssuanceTransaction) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      const repository = new PostgresChallengeRepository(new PgExecutor(client));
      return await repository.withAgentTrialLock(agentId, trialDefinitionId, fn);
    } finally {
      client.release();
    }
  }
}

export function createPgPool(connectionString: string): Pool {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}
