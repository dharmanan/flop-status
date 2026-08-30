// Row shapes for the Trial 1 foundation tables defined in
// db/migrations/0001_trial1_foundation.sql. jsonb columns are typed as
// `unknown` here — this layer is trial-agnostic persistence, not domain
// validation. Callers (e.g. lib/challenges/issuance-service.ts) parse
// public_payload/hidden_context through the specific trial's Zod schema.

export type ChallengeState = "ISSUED" | "SUBMITTED" | "PASS" | "FAIL" | "UNKNOWN" | "EXPIRED";

export interface AgentRow {
  id: string;
  did: string;
  didMethod: string;
  keyType: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface TrialDefinitionRow {
  id: string;
  trialId: string;
  trialVersion: string;
  capabilityId: string;
  verifierId: string;
  verifierVersion: string;
  canonicalizationId: string;
  definition: unknown;
  active: boolean;
  createdAt: string;
}

export interface ChallengeInstanceRow {
  id: string;
  agentId: string;
  trialDefinitionId: string;
  state: ChallengeState;
  nonce: string;
  publicPayload: unknown;
  hiddenContext: unknown;
  challengeHash: string;
  issuedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface InsertChallengeInput {
  id: string;
  agentId: string;
  trialDefinitionId: string;
  nonce: string;
  publicPayload: unknown;
  hiddenContext: unknown;
  challengeHash: string;
  issuedAt: string;
  expiresAt: string;
}
