import type { ChallengeIssuanceRepository } from "../db/challenge-repository.js";
import { parseEd25519DidKey } from "../identity/did-key.js";
import {
  generateEd25519SignatureChallenge,
  type ClockFn,
  type RandomBytesFn,
} from "../trials/ed25519-signature-verification/challenge-generator.js";
import { TRIAL_ID, TRIAL_VERSION } from "../trials/ed25519-signature-verification/constants.js";
import type { Trial1ChallengePayload } from "../trials/ed25519-signature-verification/schema.js";

// Milestone 1 accepted values per docs/database-schema.md — Trial 1 accepts
// only Ed25519 did:key, enforced above by parseEd25519DidKey before this is
// ever used, so hardcoding here matches what has already been validated.
const AGENT_DID_METHOD = "key";
const AGENT_KEY_TYPE = "Ed25519";

export class ActiveChallengeExistsError extends Error {
  readonly activeChallengeId: string;
  readonly expiresAt: string;

  constructor(activeChallengeId: string, expiresAt: string) {
    super(`an active ISSUED challenge already exists: ${activeChallengeId}`);
    this.name = "ActiveChallengeExistsError";
    this.activeChallengeId = activeChallengeId;
    this.expiresAt = expiresAt;
  }
}

export class TrialDefinitionNotFoundError extends Error {
  constructor(trialId: string, trialVersion: string) {
    super(
      `no active trial definition for ${trialId}@${trialVersion} — has the migration seed run?`,
    );
    this.name = "TrialDefinitionNotFoundError";
  }
}

export interface IssueEd25519ChallengeInput {
  agentDid: string;
}

export interface IssueEd25519ChallengeDependencies {
  repository: ChallengeIssuanceRepository;
  now?: ClockFn;
  randomBytes?: RandomBytesFn;
}

// The model handed back to callers. There is deliberately no hiddenContext
// field on this type — it is structurally impossible to leak the hidden
// verifier context through this return shape.
export interface IssuedChallenge {
  id: string;
  publicPayload: Trial1ChallengePayload;
  challengeHash: string;
}

/**
 * Race-safe Trial 1 challenge issuance. Serializes issuance per
 * (agent, trial) using the repository's advisory transaction lock,
 * transitions a stale ISSUED challenge to EXPIRED before replacing it, and
 * refuses a second challenge while one is still active — matching the
 * transaction boundary described in docs/database-schema.md.
 *
 * now/randomBytes are optional and exist only for deterministic tests; the
 * production call path (only `repository` supplied) falls through to
 * generateEd25519SignatureChallenge's own CSPRNG-backed defaults.
 */
export async function issueEd25519SignatureChallenge(
  input: IssueEd25519ChallengeInput,
  deps: IssueEd25519ChallengeDependencies,
): Promise<IssuedChallenge> {
  const { repository } = deps;
  const now = deps.now ?? (() => new Date());

  // Fail fast with a typed did:key error before touching the database.
  parseEd25519DidKey(input.agentDid);

  const trialDefinition = await repository.findActiveTrialDefinition(TRIAL_ID, TRIAL_VERSION);
  if (!trialDefinition) {
    throw new TrialDefinitionNotFoundError(TRIAL_ID, TRIAL_VERSION);
  }

  const agent = await repository.findOrCreateAgentByDid(
    input.agentDid,
    AGENT_DID_METHOD,
    AGENT_KEY_TYPE,
  );

  return repository.withAgentTrialLock(agent.id, trialDefinition.id, async (tx) => {
    const active = await tx.findActiveIssuedChallenge(agent.id, trialDefinition.id);

    if (active) {
      const isExpired = new Date(active.expiresAt).getTime() <= now().getTime();
      if (!isExpired) {
        throw new ActiveChallengeExistsError(active.id, active.expiresAt);
      }
      await tx.expireChallenge(active.id);
    }

    const generated = generateEd25519SignatureChallenge(
      { agentDid: input.agentDid },
      { now: deps.now, randomBytes: deps.randomBytes },
    );

    const row = await tx.insertChallenge({
      id: generated.publicPayload.challenge_id,
      agentId: agent.id,
      trialDefinitionId: trialDefinition.id,
      nonce: generated.publicPayload.nonce,
      publicPayload: generated.publicPayload,
      hiddenContext: generated.hiddenContext,
      challengeHash: generated.challengeHash,
      issuedAt: generated.publicPayload.issued_at,
      expiresAt: generated.publicPayload.expires_at,
    });

    return {
      id: row.id,
      publicPayload: generated.publicPayload,
      challengeHash: generated.challengeHash,
    };
  });
}
