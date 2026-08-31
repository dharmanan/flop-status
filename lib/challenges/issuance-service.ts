import type { ChallengeIssuanceRepository } from "../db/challenge-repository.js";
import { parseEd25519DidKey } from "../identity/did-key.js";
import {
  generateCanonicalJsonSha256Challenge,
  type Trial2ChallengeGeneratorDependencies,
} from "../trials/canonical-json-sha256/challenge-generator.js";
import {
  TRIAL_ID as TRIAL2_ID,
  TRIAL_VERSION as TRIAL2_VERSION,
} from "../trials/canonical-json-sha256/constants.js";
import {
  generateEd25519SignatureChallenge,
  type ClockFn,
  type RandomBytesFn,
} from "../trials/ed25519-signature-verification/challenge-generator.js";
import {
  TRIAL_ID as TRIAL1_ID,
  TRIAL_VERSION as TRIAL1_VERSION,
} from "../trials/ed25519-signature-verification/constants.js";
import type { Trial1ChallengePayload } from "../trials/ed25519-signature-verification/schema.js";

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

export class UnsupportedTrialError extends Error {
  constructor(readonly trialId: string) {
    super(`unsupported trial: ${trialId}`);
    this.name = "UnsupportedTrialError";
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

export interface IssueCapabilityChallengeInput {
  agentDid: string;
  trialId: string;
}

export interface IssueCapabilityChallengeDependencies {
  repository: ChallengeIssuanceRepository;
  now?: ClockFn;
  randomBytes?: RandomBytesFn;
}

export interface IssuedChallenge {
  id: string;
  publicPayload: unknown;
  challengeHash: string;
}

interface GeneratedChallenge {
  publicPayload: {
    challenge_id: string;
    nonce: string;
    issued_at: string;
    expires_at: string;
  };
  hiddenContext: unknown;
  challengeHash: string;
}

async function persistGeneratedChallenge(
  input: { agentDid: string; trialId: string; trialVersion: string },
  generated: GeneratedChallenge,
  deps: IssueCapabilityChallengeDependencies,
): Promise<IssuedChallenge> {
  const { repository } = deps;
  const now = deps.now ?? (() => new Date());

  const trialDefinition = await repository.findActiveTrialDefinition(input.trialId, input.trialVersion);
  if (!trialDefinition) {
    throw new TrialDefinitionNotFoundError(input.trialId, input.trialVersion);
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

export async function issueCapabilityChallenge(
  input: IssueCapabilityChallengeInput,
  deps: IssueCapabilityChallengeDependencies,
): Promise<IssuedChallenge> {
  parseEd25519DidKey(input.agentDid);

  if (input.trialId === TRIAL1_ID) {
    const generated = generateEd25519SignatureChallenge(
      { agentDid: input.agentDid },
      { now: deps.now, randomBytes: deps.randomBytes },
    );
    return persistGeneratedChallenge(
      { agentDid: input.agentDid, trialId: TRIAL1_ID, trialVersion: TRIAL1_VERSION },
      generated,
      deps,
    );
  }

  if (input.trialId === TRIAL2_ID) {
    const generatorDeps: Trial2ChallengeGeneratorDependencies = {
      now: deps.now,
      randomBytes: deps.randomBytes,
    };
    const generated = generateCanonicalJsonSha256Challenge(
      { agentDid: input.agentDid },
      generatorDeps,
    );
    return persistGeneratedChallenge(
      { agentDid: input.agentDid, trialId: TRIAL2_ID, trialVersion: TRIAL2_VERSION },
      generated,
      deps,
    );
  }

  throw new UnsupportedTrialError(input.trialId);
}

/**
 * Backward-compatible Trial 1 entry point retained for accepted tests and
 * internal verification scripts. New runtime code should use
 * issueCapabilityChallenge so later trials share the same issuance engine.
 */
export async function issueEd25519SignatureChallenge(
  input: IssueEd25519ChallengeInput,
  deps: IssueEd25519ChallengeDependencies,
): Promise<{ id: string; publicPayload: Trial1ChallengePayload; challengeHash: string }> {
  const issued = await issueCapabilityChallenge(
    { agentDid: input.agentDid, trialId: TRIAL1_ID },
    deps,
  );
  return issued as { id: string; publicPayload: Trial1ChallengePayload; challengeHash: string };
}
