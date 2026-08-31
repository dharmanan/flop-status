// Row shapes for Trial 1 persistence. jsonb columns are typed as `unknown`
// here because this layer is trial-agnostic persistence; domain callers parse
// them through the relevant strict trial schemas.

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

export interface SubmissionChallengeContext {
  id: string;
  agentId: string;
  agentDid: string;
  trialDefinitionId: string;
  trialId: string;
  trialVersion: string;
  verifierId: string;
  verifierVersion: string;
  state: ChallengeState;
  publicPayload: unknown;
  hiddenContext: unknown;
  challengeHash: string;
  expiresAt: string;
}

export interface SubmissionRow {
  id: string;
  challengeId: string;
  agentId: string;
  payload: unknown;
  payloadHash: string;
  resultPayload: unknown;
  resultHash: string;
  signatureAlgorithm: string;
  signatureEncoding: string;
  signatureValue: string;
  agentSignatureValid: boolean;
  receivedAt: string;
  createdAt: string;
}

export interface InsertSubmissionInput {
  challengeId: string;
  agentId: string;
  payload: unknown;
  payloadHash: string;
  resultPayload: unknown;
  resultHash: string;
  signatureAlgorithm: string;
  signatureEncoding: string;
  signatureValue: string;
}
