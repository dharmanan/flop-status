import type {
  SubmissionAcceptanceRepository,
  SubmissionAcceptanceTransaction,
} from "../../lib/db/submission-repository.js";
import type {
  InsertSubmissionInput,
  SubmissionChallengeContext,
  SubmissionRow,
} from "../../lib/db/types.js";

export class InMemorySubmissionRepository implements SubmissionAcceptanceRepository {
  private tail: Promise<void> = Promise.resolve();
  private submission: SubmissionRow | null = null;

  constructor(readonly challenge: SubmissionChallengeContext) {}

  async withChallengeLock<T>(
    challengeId: string,
    fn: (tx: SubmissionAcceptanceTransaction) => Promise<T>,
  ): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn(this.transactionScope(challengeId));
    } finally {
      release();
    }
  }

  getSubmissionCount(): number {
    return this.submission ? 1 : 0;
  }

  private transactionScope(expectedChallengeId: string): SubmissionAcceptanceTransaction {
    return {
      findChallengeForUpdate: async (challengeId) =>
        challengeId === expectedChallengeId && challengeId === this.challenge.id
          ? { ...this.challenge }
          : null,
      expireChallenge: async (challengeId) => {
        if (challengeId === this.challenge.id && this.challenge.state === "ISSUED") {
          this.challenge.state = "EXPIRED";
        }
      },
      insertSubmission: async (input: InsertSubmissionInput) => {
        if (this.submission) {
          throw new Error("duplicate submission");
        }
        this.submission = {
          id: "22222222-2222-4222-8222-222222222222",
          challengeId: input.challengeId,
          agentId: input.agentId,
          payload: input.payload,
          payloadHash: input.payloadHash,
          resultPayload: input.resultPayload,
          resultHash: input.resultHash,
          signatureAlgorithm: input.signatureAlgorithm,
          signatureEncoding: input.signatureEncoding,
          signatureValue: input.signatureValue,
          agentSignatureValid: true,
          receivedAt: "2026-08-30T19:01:00.000Z",
          createdAt: "2026-08-30T19:01:00.000Z",
        };
        return this.submission;
      },
      markChallengeSubmitted: async (challengeId) => {
        if (challengeId !== this.challenge.id || this.challenge.state !== "ISSUED") {
          throw new Error("challenge not issuable");
        }
        this.challenge.state = "SUBMITTED";
      },
    };
  }
}
