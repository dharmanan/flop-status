import type {
  AgentRow,
  ChallengeInstanceRow,
  InsertChallengeInput,
  TrialDefinitionRow,
} from "./types.js";

/**
 * Minimal, driver-agnostic SQL execution port. A concrete adapter (e.g. over
 * the `pg` package, not added in this checkpoint) implements this by running
 * `text` with positional `$n` parameters against a real PostgreSQL
 * connection. Nothing in this file imports a specific driver.
 *
 * Contract required by PostgresChallengeRepository.withAgentTrialLock: the
 * executor passed in must represent one checked-out connection for the
 * duration of that call (not a pool that may hand different queries to
 * different connections) — BEGIN, the advisory lock, and every query run by
 * the transaction callback must share one PostgreSQL session for the lock
 * and transaction to mean anything.
 */
export interface QueryExecutor {
  query<Row>(text: string, params: readonly unknown[]): Promise<{ rows: Row[] }>;
}

export interface ChallengeIssuanceTransaction {
  findActiveIssuedChallenge(
    agentId: string,
    trialDefinitionId: string,
  ): Promise<ChallengeInstanceRow | null>;
  expireChallenge(challengeId: string): Promise<void>;
  insertChallenge(input: InsertChallengeInput): Promise<ChallengeInstanceRow>;
}

export interface ChallengeIssuanceRepository {
  findOrCreateAgentByDid(did: string, didMethod: string, keyType: string): Promise<AgentRow>;
  findActiveTrialDefinition(
    trialId: string,
    trialVersion: string,
  ): Promise<TrialDefinitionRow | null>;
  /**
   * Runs fn inside one PostgreSQL transaction holding a transaction-scoped
   * advisory lock keyed by (agentId, trialDefinitionId), implementing the
   * "one active challenge" rule from docs/database-schema.md. The lock
   * releases automatically at commit/rollback (pg_advisory_xact_lock, not
   * the session-scoped variant).
   */
  withAgentTrialLock<T>(
    agentId: string,
    trialDefinitionId: string,
    fn: (tx: ChallengeIssuanceTransaction) => Promise<T>,
  ): Promise<T>;
}

const CHALLENGE_ROW_COLUMNS = `
    id, agent_id AS "agentId", trial_definition_id AS "trialDefinitionId",
    state, nonce, public_payload AS "publicPayload", hidden_context AS "hiddenContext",
    challenge_hash AS "challengeHash", issued_at AS "issuedAt", expires_at AS "expiresAt",
    submitted_at AS "submittedAt", completed_at AS "completedAt", created_at AS "createdAt"
`;

// SQL text is written once, here, with positional $n parameters only.
// PostgresChallengeRepository never concatenates a caller-supplied value
// into any of these strings — see the methods below and
// tests/db/challenge-repository.test.ts, which asserts this against a fake
// executor.
export const SQL = {
  BEGIN: "BEGIN",
  COMMIT: "COMMIT",
  ROLLBACK: "ROLLBACK",

  ADVISORY_LOCK: `SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 0))`,

  FIND_OR_CREATE_AGENT: `
    INSERT INTO agents (did, did_method, key_type)
    VALUES ($1, $2, $3)
    ON CONFLICT (did) DO UPDATE SET last_seen_at = now()
    RETURNING id, did, did_method AS "didMethod", key_type AS "keyType",
      created_at AS "createdAt", last_seen_at AS "lastSeenAt"
  `,

  FIND_ACTIVE_TRIAL_DEFINITION: `
    SELECT id, trial_id AS "trialId", trial_version AS "trialVersion",
      capability_id AS "capabilityId", verifier_id AS "verifierId",
      verifier_version AS "verifierVersion", canonicalization_id AS "canonicalizationId",
      definition, active, created_at AS "createdAt"
    FROM trial_definitions
    WHERE trial_id = $1 AND trial_version = $2 AND active = true
  `,

  FIND_ACTIVE_ISSUED_CHALLENGE: `
    SELECT ${CHALLENGE_ROW_COLUMNS}
    FROM challenge_instances
    WHERE agent_id = $1 AND trial_definition_id = $2 AND state = 'ISSUED'
    ORDER BY created_at DESC
    LIMIT 1
  `,

  EXPIRE_CHALLENGE: `
    UPDATE challenge_instances SET state = 'EXPIRED', completed_at = now()
    WHERE id = $1 AND state = 'ISSUED'
  `,

  INSERT_CHALLENGE: `
    INSERT INTO challenge_instances (
      id, agent_id, trial_definition_id, nonce, public_payload, hidden_context,
      challenge_hash, issued_at, expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING ${CHALLENGE_ROW_COLUMNS}
  `,
} as const;

/**
 * SQL-based ChallengeIssuanceRepository over any QueryExecutor. Contains no
 * import of a specific PostgreSQL driver — a concrete adapter wrapping a
 * real connection to satisfy QueryExecutor is a separate, later piece, added
 * only once a driver dependency is approved.
 */
export class PostgresChallengeRepository implements ChallengeIssuanceRepository {
  constructor(private readonly executor: QueryExecutor) {}

  async findOrCreateAgentByDid(
    did: string,
    didMethod: string,
    keyType: string,
  ): Promise<AgentRow> {
    const { rows } = await this.executor.query<AgentRow>(SQL.FIND_OR_CREATE_AGENT, [
      did,
      didMethod,
      keyType,
    ]);
    const row = rows[0];
    if (!row) {
      throw new Error("findOrCreateAgentByDid: insert/upsert did not return a row");
    }
    return row;
  }

  async findActiveTrialDefinition(
    trialId: string,
    trialVersion: string,
  ): Promise<TrialDefinitionRow | null> {
    const { rows } = await this.executor.query<TrialDefinitionRow>(
      SQL.FIND_ACTIVE_TRIAL_DEFINITION,
      [trialId, trialVersion],
    );
    return rows[0] ?? null;
  }

  async withAgentTrialLock<T>(
    agentId: string,
    trialDefinitionId: string,
    fn: (tx: ChallengeIssuanceTransaction) => Promise<T>,
  ): Promise<T> {
    await this.executor.query(SQL.BEGIN, []);
    try {
      await this.executor.query(SQL.ADVISORY_LOCK, [agentId, trialDefinitionId]);
      const result = await fn(this.transactionScope());
      await this.executor.query(SQL.COMMIT, []);
      return result;
    } catch (error) {
      await this.executor.query(SQL.ROLLBACK, []);
      throw error;
    }
  }

  private transactionScope(): ChallengeIssuanceTransaction {
    const executor = this.executor;
    return {
      async findActiveIssuedChallenge(agentId, trialDefinitionId) {
        const { rows } = await executor.query<ChallengeInstanceRow>(
          SQL.FIND_ACTIVE_ISSUED_CHALLENGE,
          [agentId, trialDefinitionId],
        );
        return rows[0] ?? null;
      },
      async expireChallenge(challengeId) {
        await executor.query(SQL.EXPIRE_CHALLENGE, [challengeId]);
      },
      async insertChallenge(input) {
        const { rows } = await executor.query<ChallengeInstanceRow>(SQL.INSERT_CHALLENGE, [
          input.id,
          input.agentId,
          input.trialDefinitionId,
          input.nonce,
          input.publicPayload,
          input.hiddenContext,
          input.challengeHash,
          input.issuedAt,
          input.expiresAt,
        ]);
        const row = rows[0];
        if (!row) {
          throw new Error("insertChallenge: insert did not return a row");
        }
        return row;
      },
    };
  }
}
