import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { decodeBase64Url } from "../crypto/base64url.js";
import { sha256 } from "../crypto/sha256.js";
import type { SubmissionAcceptanceRepository } from "../db/submission-repository.js";
import {
  MalformedDidError,
  UnsupportedDidMethodError,
  UnsupportedKeyTypeError,
  parseEd25519DidKey,
} from "../identity/did-key.js";
import { verifyEd25519DidKeySignature } from "../identity/verify-signature.js";
import {
  PRODUCTION_TRIAL_ID as TRIAL2_PRODUCTION_ID,
  TRIAL_ID as TRIAL2_ID,
} from "../trials/canonical-json-sha256/constants.js";
import { trial2SignedSubmissionEnvelopeSchema } from "../trials/canonical-json-sha256/schema.js";
import {
  PRODUCTION_TRIAL_ID as TRIAL1_PRODUCTION_ID,
  TRIAL_ID as TRIAL1_ID,
} from "../trials/ed25519-signature-verification/constants.js";
import { trial1SignedSubmissionEnvelopeSchema } from "../trials/ed25519-signature-verification/schema.js";
import {
  PRODUCTION_TRIAL_ID as TRIAL4_PRODUCTION_ID,
  TRIAL_ID as TRIAL4_ID,
} from "../trials/signed-receipt-verification/constants.js";
import { trial4SignedSubmissionEnvelopeSchema } from "../trials/signed-receipt-verification/schema.js";
import {
  PRODUCTION_TRIAL_ID as TRIAL3_PRODUCTION_ID,
  TRIAL_ID as TRIAL3_ID,
} from "../trials/technocore-canonical-message/constants.js";
import { trial3SignedSubmissionEnvelopeSchema } from "../trials/technocore-canonical-message/schema.js";

export const MAX_SUBMISSION_BODY_BYTES = 32_768;

export type SubmissionErrorCode =
  | "INVALID_SUBMISSION_SCHEMA"
  | "CHALLENGE_NOT_FOUND"
  | "CHALLENGE_EXPIRED"
  | "CHALLENGE_ALREADY_CONSUMED"
  | "CHALLENGE_BINDING_MISMATCH"
  | "INVALID_AGENT_SIGNATURE"
  | "UNSUPPORTED_DID"
  | "INVALID_DID";

export class SubmissionAcceptanceError extends Error {
  constructor(readonly code: SubmissionErrorCode, message: string) {
    super(message);
    this.name = "SubmissionAcceptanceError";
  }
}

export interface AcceptSignedSubmissionInput {
  challengeId: string;
  envelope: unknown;
  bodyByteLength: number;
}
export type AcceptTrial1SubmissionInput = AcceptSignedSubmissionInput;

export interface AcceptSignedSubmissionDependencies {
  repository: SubmissionAcceptanceRepository;
  now?: () => Date;
}
export type AcceptTrial1SubmissionDependencies = AcceptSignedSubmissionDependencies;

export interface AcceptedSignedSubmission {
  id: string;
  challengeId: string;
  payloadHash: string;
  resultHash: string;
  receivedAt: string;
}
export type AcceptedTrial1Submission = AcceptedSignedSubmission;

type TransactionOutcome =
  | { kind: "accepted"; value: AcceptedSignedSubmission }
  | { kind: "expired" };

type ParsedEnvelope =
  | ReturnType<typeof trial1SignedSubmissionEnvelopeSchema.parse>
  | ReturnType<typeof trial2SignedSubmissionEnvelopeSchema.parse>
  | ReturnType<typeof trial3SignedSubmissionEnvelopeSchema.parse>
  | ReturnType<typeof trial4SignedSubmissionEnvelopeSchema.parse>;

type ParsedEnvelopeSchema =
  | typeof trial1SignedSubmissionEnvelopeSchema
  | typeof trial2SignedSubmissionEnvelopeSchema
  | typeof trial3SignedSubmissionEnvelopeSchema
  | typeof trial4SignedSubmissionEnvelopeSchema;

function assertSupportedDid(did: string): void {
  try {
    parseEd25519DidKey(did);
  } catch (error) {
    if (error instanceof UnsupportedDidMethodError || error instanceof UnsupportedKeyTypeError) {
      throw new SubmissionAcceptanceError("UNSUPPORTED_DID", error.message);
    }
    if (error instanceof MalformedDidError) {
      throw new SubmissionAcceptanceError("INVALID_DID", error.message);
    }
    throw error;
  }
}

function trialIdFromEnvelope(envelope: unknown): string | null {
  if (!envelope || typeof envelope !== "object") return null;
  const payload = (envelope as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") return null;
  const trialId = (payload as { trial_id?: unknown }).trial_id;
  return typeof trialId === "string" ? trialId : null;
}

const ENVELOPE_SCHEMAS_BY_TRIAL_ID = new Map<string, ParsedEnvelopeSchema>([
  [TRIAL1_ID, trial1SignedSubmissionEnvelopeSchema],
  [TRIAL1_PRODUCTION_ID, trial1SignedSubmissionEnvelopeSchema],
  [TRIAL2_ID, trial2SignedSubmissionEnvelopeSchema],
  [TRIAL2_PRODUCTION_ID, trial2SignedSubmissionEnvelopeSchema],
  [TRIAL3_ID, trial3SignedSubmissionEnvelopeSchema],
  [TRIAL3_PRODUCTION_ID, trial3SignedSubmissionEnvelopeSchema],
  [TRIAL4_ID, trial4SignedSubmissionEnvelopeSchema],
  [TRIAL4_PRODUCTION_ID, trial4SignedSubmissionEnvelopeSchema],
]);

function parseSupportedEnvelope(envelope: unknown): ParsedEnvelope {
  const trialId = trialIdFromEnvelope(envelope);
  const schema = trialId === null ? undefined : ENVELOPE_SCHEMAS_BY_TRIAL_ID.get(trialId);

  if (!schema) {
    throw new SubmissionAcceptanceError(
      "INVALID_SUBMISSION_SCHEMA",
      "submission trial_id is missing or unsupported",
    );
  }

  const parsed = schema.safeParse(envelope);
  if (!parsed.success) {
    throw new SubmissionAcceptanceError(
      "INVALID_SUBMISSION_SCHEMA",
      parsed.error.issues.map((issue) => issue.message).join("; "),
    );
  }
  return parsed.data as ParsedEnvelope;
}

export async function acceptCapabilitySignedSubmission(
  input: AcceptSignedSubmissionInput,
  deps: AcceptSignedSubmissionDependencies,
): Promise<AcceptedSignedSubmission> {
  if (!Number.isInteger(input.bodyByteLength) || input.bodyByteLength < 0) {
    throw new SubmissionAcceptanceError(
      "INVALID_SUBMISSION_SCHEMA",
      "bodyByteLength must be a non-negative integer",
    );
  }
  if (input.bodyByteLength > MAX_SUBMISSION_BODY_BYTES) {
    throw new SubmissionAcceptanceError(
      "INVALID_SUBMISSION_SCHEMA",
      `submission exceeds ${MAX_SUBMISSION_BODY_BYTES} byte limit`,
    );
  }

  const envelope = parseSupportedEnvelope(input.envelope);
  const payload = envelope.payload;
  if (input.challengeId !== payload.challenge_id) {
    throw new SubmissionAcceptanceError(
      "CHALLENGE_BINDING_MISMATCH",
      "path challenge id does not match signed payload challenge id",
    );
  }

  const now = deps.now ?? (() => new Date());
  const outcome = await deps.repository.withChallengeLock(input.challengeId, async (tx) => {
    const challenge = await tx.findChallengeForUpdate(input.challengeId);
    if (!challenge) {
      throw new SubmissionAcceptanceError("CHALLENGE_NOT_FOUND", "challenge does not exist");
    }

    if (
      challenge.agentDid !== payload.agent_did ||
      challenge.trialId !== payload.trial_id ||
      challenge.trialVersion !== payload.trial_version ||
      challenge.challengeHash !== payload.challenge_hash
    ) {
      throw new SubmissionAcceptanceError(
        "CHALLENGE_BINDING_MISMATCH",
        "signed submission does not match persisted challenge binding",
      );
    }

    if (challenge.state !== "ISSUED") {
      throw new SubmissionAcceptanceError(
        "CHALLENGE_ALREADY_CONSUMED",
        `challenge state is ${challenge.state}`,
      );
    }

    if (new Date(challenge.expiresAt).getTime() <= now().getTime()) {
      await tx.expireChallenge(challenge.id);
      return { kind: "expired" } as const;
    }

    assertSupportedDid(payload.agent_did);

    const canonicalPayloadBytes = canonicalizeJsonToBytes(payload);
    const signatureBytes = decodeBase64Url(envelope.signature.value);
    if (!verifyEd25519DidKeySignature(payload.agent_did, canonicalPayloadBytes, signatureBytes)) {
      throw new SubmissionAcceptanceError(
        "INVALID_AGENT_SIGNATURE",
        "agent signature does not verify over canonical submission payload",
      );
    }

    const payloadHash = sha256(canonicalPayloadBytes);
    const resultHash = sha256(canonicalizeJsonToBytes(payload.result));
    const row = await tx.insertSubmission({
      challengeId: challenge.id,
      agentId: challenge.agentId,
      payload,
      payloadHash,
      resultPayload: payload.result,
      resultHash,
      signatureAlgorithm: envelope.signature.algorithm,
      signatureEncoding: envelope.signature.encoding,
      signatureValue: envelope.signature.value,
    });
    await tx.markChallengeSubmitted(challenge.id);

    return {
      kind: "accepted",
      value: {
        id: row.id,
        challengeId: row.challengeId,
        payloadHash: row.payloadHash,
        resultHash: row.resultHash,
        receivedAt: row.receivedAt,
      },
    } as const;
  });

  if (outcome.kind === "expired") {
    throw new SubmissionAcceptanceError("CHALLENGE_EXPIRED", "challenge has expired");
  }
  return outcome.value;
}

export async function acceptTrial1SignedSubmission(
  input: AcceptTrial1SubmissionInput,
  deps: AcceptTrial1SubmissionDependencies,
): Promise<AcceptedTrial1Submission> {
  const trialId = trialIdFromEnvelope(input.envelope);
  if (trialId !== TRIAL1_ID && trialId !== TRIAL1_PRODUCTION_ID) {
    throw new SubmissionAcceptanceError("INVALID_SUBMISSION_SCHEMA", "expected Ed25519 signature verification submission");
  }
  return acceptCapabilitySignedSubmission(input, deps);
}
