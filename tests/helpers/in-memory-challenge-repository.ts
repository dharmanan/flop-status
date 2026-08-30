import type {
  ChallengeIssuanceRepository,
  ChallengeIssuanceTransaction,
} from "../../lib/db/challenge-repository.js";
import type {
  AgentRow,
  ChallengeInstanceRow,
  InsertChallengeInput,
  TrialDefinitionRow,
} from "../../lib/db/types.js";

/**
 * In-memory fake ChallengeIssuanceRepository for unit-testing the issuance
 * service without a database driver or a real PostgreSQL instance.
 *
 * withAgentTrialLock provides genuine mutual exclusion per (agentId,
 * trialDefinitionId): concurrent calls for the same key queue and run one at
 * a time, the same guarantee pg_advisory_xact_lock is expected to provide.
 * That makes this fake useful for exercising real async race conditions in
 * the issuance service's own orchestration logic. It does NOT prove that
 * PostgreSQL's advisory lock behaves this way in practice — that is only
 * verifiable against a real PostgreSQL instance (see test report).
 */
export class InMemoryChallengeRepository implements ChallengeIssuanceRepository {
  private agentsByDid = new Map<string, AgentRow>();
  private trialDefinitions: TrialDefinitionRow[] = [];
  private challenges = new Map<string, ChallengeInstanceRow>();
  private lockChain = new Map<string, Promise<unknown>>();
  private nextAgentId = 1;

  seedTrialDefinition(row: TrialDefinitionRow): void {
    this.trialDefinitions.push(row);
  }

  getChallengeById(id: string): ChallengeInstanceRow | null {
    return this.challenges.get(id) ?? null;
  }

  async findOrCreateAgentByDid(
    did: string,
    didMethod: string,
    keyType: string,
  ): Promise<AgentRow> {
    const existing = this.agentsByDid.get(did);
    if (existing) {
      const updated: AgentRow = { ...existing, lastSeenAt: new Date().toISOString() };
      this.agentsByDid.set(did, updated);
      return updated;
    }
    const row: AgentRow = {
      id: `agent-${this.nextAgentId++}`,
      did,
      didMethod,
      keyType,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };
    this.agentsByDid.set(did, row);
    return row;
  }

  async findActiveTrialDefinition(
    trialId: string,
    trialVersion: string,
  ): Promise<TrialDefinitionRow | null> {
    return (
      this.trialDefinitions.find(
        (row) => row.trialId === trialId && row.trialVersion === trialVersion && row.active,
      ) ?? null
    );
  }

  async withAgentTrialLock<T>(
    agentId: string,
    trialDefinitionId: string,
    fn: (tx: ChallengeIssuanceTransaction) => Promise<T>,
  ): Promise<T> {
    const key = `${agentId}:${trialDefinitionId}`;
    const previous = this.lockChain.get(key) ?? Promise.resolve();

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.lockChain.set(
      key,
      previous.then(() => held),
    );

    await previous;
    try {
      return await fn(this.transactionScope());
    } finally {
      release();
    }
  }

  private transactionScope(): ChallengeIssuanceTransaction {
    return {
      findActiveIssuedChallenge: async (agentId, trialDefinitionId) => {
        for (const row of this.challenges.values()) {
          if (
            row.agentId === agentId &&
            row.trialDefinitionId === trialDefinitionId &&
            row.state === "ISSUED"
          ) {
            return row;
          }
        }
        return null;
      },
      expireChallenge: async (challengeId) => {
        const row = this.challenges.get(challengeId);
        if (row && row.state === "ISSUED") {
          this.challenges.set(challengeId, { ...row, state: "EXPIRED" });
        }
      },
      insertChallenge: async (input: InsertChallengeInput) => {
        const row: ChallengeInstanceRow = {
          id: input.id,
          agentId: input.agentId,
          trialDefinitionId: input.trialDefinitionId,
          state: "ISSUED",
          nonce: input.nonce,
          publicPayload: input.publicPayload,
          hiddenContext: input.hiddenContext,
          challengeHash: input.challengeHash,
          issuedAt: input.issuedAt,
          expiresAt: input.expiresAt,
          submittedAt: null,
          completedAt: null,
          createdAt: new Date().toISOString(),
        };
        this.challenges.set(row.id, row);
        return row;
      },
    };
  }
}
