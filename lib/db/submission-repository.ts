import type { QueryExecutor } from "./challenge-repository.js";
import type {
  InsertSubmissionInput,
  SubmissionChallengeContext,
  SubmissionRow,
} from "./types.js";

export interface SubmissionAcceptanceTransaction {
  findChallengeForUpdate(challengeId: string): Promise<SubmissionChallengeContext | null>;
  expireChallenge(challengeId: string): Promise<void>;
  insertSubmission(input: InsertSubmissionInput): Promise<SubmissionRow>;
  markChallengeSubmitted(challengeId: string): Promise<void>;
}

export interface SubmissionAcceptanceRepository {
  withChallengeLock<T>(
    challengeId: string,
    fn: (tx: SubmissionAcceptanceTransaction) => Promise<T>,
  ): Promise<T>;
}

const SUBMISSION_ROW_COLUMNS = `
  id, challenge_id AS "challengeId", agent_id AS "agentId",
  payload, payload_hash AS "payloadHash", result_payload AS "resultPayload",
  result_hash AS "resultHash", signature_algorithm AS "signatureAlgorithm",
  signature_encoding AS "signatureEncoding", signature_value AS "signatureValue",
  agent_signature_valid AS "agentSignatureValid", received_at AS "receivedAt",
  created_at AS "createdAt"
`;

export const SUBMISSION_SQL = {
  BEGIN: "BEGIN",
  COMMIT: "COMMIT",
  ROLLBACK: "ROLLBACK",

  FIND_CHALLENGE_FOR_UPDATE: `
    SELECT ci.id, ci.agent_id AS "agentId", a.did AS "agentDid",
      ci.trial_definition_id AS "trialDefinitionId",
      td.trial_id AS "trialId", td.trial_version AS "trialVersion",
      td.verifier_id AS "verifierId", td.verifier_version AS "verifierVersion",
      ci.state, ci.public_payload AS "publicPayload", ci.hidden_context AS "hiddenContext",
      ci.challenge_hash AS "challengeHash", ci.expires_at AS "expiresAt"
    FROM challenge_instances ci
    JOIN agents a ON a.id = ci.agent_id
    JOIN trial_definitions td ON td.id = ci.trial_definition_id
    WHERE ci.id = $1
    FOR UPDATE OF ci
  `,

  EXPIRE_CHALLENGE: `
    UPDATE challenge_instances
    SET state = 'EXPIRED', completed_at = now()
    WHERE id = $1 AND state = 'ISSUED'
  `,

  INSERT_SUBMISSION: `
    INSERT INTO submissions (
      challenge_id, agent_id, payload, payload_hash, result_payload, result_hash,
      signature_algorithm, signature_encoding, signature_value, agent_signature_valid
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
    RETURNING ${SUBMISSION_ROW_COLUMNS}
  `,

  MARK_CHALLENGE_SUBMITTED: `
    UPDATE challenge_instances
    SET state = 'SUBMITTED', submitted_at = now()
    WHERE id = $1 AND state = 'ISSUED'
    RETURNING id
  `,
} as const;

export class PostgresSubmissionRepository implements SubmissionAcceptanceRepository {
  constructor(private readonly executor: QueryExecutor) {}

  async withChallengeLock<T>(
    challengeId: string,
    fn: (tx: SubmissionAcceptanceTransaction) => Promise<T>,
  ): Promise<T> {
    await this.executor.query(SUBMISSION_SQL.BEGIN, []);
    try {
      const result = await fn(this.transactionScope());
      await this.executor.query(SUBMISSION_SQL.COMMIT, []);
      return result;
    } catch (error) {
      await this.executor.query(SUBMISSION_SQL.ROLLBACK, []);
      throw error;
    }
  }

  private transactionScope(): SubmissionAcceptanceTransaction {
    const executor = this.executor;
    return {
      async findChallengeForUpdate(challengeId) {
        const { rows } = await executor.query<SubmissionChallengeContext>(
          SUBMISSION_SQL.FIND_CHALLENGE_FOR_UPDATE,
          [challengeId],
        );
        return rows[0] ?? null;
      },
      async expireChallenge(challengeId) {
        await executor.query(SUBMISSION_SQL.EXPIRE_CHALLENGE, [challengeId]);
      },
      async insertSubmission(input) {
        const { rows } = await executor.query<SubmissionRow>(SUBMISSION_SQL.INSERT_SUBMISSION, [
          input.challengeId,
          input.agentId,
          input.payload,
          input.payloadHash,
          input.resultPayload,
          input.resultHash,
          input.signatureAlgorithm,
          input.signatureEncoding,
          input.signatureValue,
        ]);
        const row = rows[0];
        if (!row) {
          throw new Error("insertSubmission: insert did not return a row");
        }
        return row;
      },
      async markChallengeSubmitted(challengeId) {
        const { rows } = await executor.query<{ id: string }>(
          SUBMISSION_SQL.MARK_CHALLENGE_SUBMITTED,
          [challengeId],
        );
        if (!rows[0]) {
          throw new Error("markChallengeSubmitted: ISSUED challenge was not updated");
        }
      },
    };
  }
}
