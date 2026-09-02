import { z } from "zod";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { decodeBase64Url } from "../crypto/base64url.js";
import { parseEd25519DidKey } from "../identity/did-key.js";
import { verifyEd25519DidKeySignature } from "../identity/verify-signature.js";
import type { PgAgentProfileRepository } from "../db/agent-profile-repository.js";

const ACTION_WINDOW_MS = 10 * 60 * 1000;
const signatureSchema = z.object({ algorithm: z.literal("Ed25519"), encoding: z.literal("base64url"), value: z.string().min(1) }).strict();
const profilePayload = z.object({
  version: z.literal("1"),
  action: z.literal("UPSERT_AGENT_PROFILE"),
  actor_did: z.string().min(1),
  nonce: z.string().min(8).max(160),
  issued_at: z.string().datetime(),
  display_name: z.string().trim().min(1).max(64),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/),
}).strict();
const signedEnvelope = z.object({ payload: z.record(z.unknown()), signature: signatureSchema }).strict();

export type AgentProfileErrorCode =
  | "INVALID_AGENT_PROFILE_REQUEST"
  | "INVALID_AGENT_PROFILE_SIGNATURE"
  | "AGENT_PROFILE_ACTION_EXPIRED"
  | "AGENT_PROFILE_REPLAY"
  | "AGENT_HANDLE_TAKEN";

export class AgentProfileError extends Error {
  constructor(readonly code: AgentProfileErrorCode, message: string) {
    super(message);
    this.name = "AgentProfileError";
  }
}

export class AgentProfileService {
  constructor(private readonly repository: PgAgentProfileRepository) {}

  async upsert(input: unknown) {
    const envelope = signedEnvelope.safeParse(input);
    if (!envelope.success) throw new AgentProfileError("INVALID_AGENT_PROFILE_REQUEST", "invalid signed profile envelope");
    const parsed = profilePayload.safeParse(envelope.data.payload);
    if (!parsed.success) throw new AgentProfileError("INVALID_AGENT_PROFILE_REQUEST", parsed.error.issues.map((i) => i.message).join("; "));
    const payload = parsed.data;
    parseEd25519DidKey(payload.actor_did);
    const time = Date.parse(payload.issued_at);
    if (!Number.isFinite(time) || Math.abs(Date.now() - time) > ACTION_WINDOW_MS) throw new AgentProfileError("AGENT_PROFILE_ACTION_EXPIRED", "profile claim is outside the allowed time window");
    let signature: Uint8Array;
    try { signature = decodeBase64Url(envelope.data.signature.value); }
    catch { throw new AgentProfileError("INVALID_AGENT_PROFILE_SIGNATURE", "profile signature is not canonical base64url"); }
    if (!verifyEd25519DidKeySignature(payload.actor_did, canonicalizeJsonToBytes(payload), signature)) {
      throw new AgentProfileError("INVALID_AGENT_PROFILE_SIGNATURE", "profile claim signature is invalid for actor DID");
    }
    const consumed = await this.repository.consumeActionNonce(payload.actor_did, payload.nonce, payload.action, payload.issued_at);
    if (!consumed) throw new AgentProfileError("AGENT_PROFILE_REPLAY", "profile action nonce was already consumed");
    try {
      return { profile: await this.repository.upsertProfile({
        did: payload.actor_did,
        displayName: payload.display_name,
        handle: payload.handle,
        claimNonce: payload.nonce,
        claimSignature: envelope.data.signature.value,
        claimedAt: payload.issued_at,
      }) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("agent_profiles_handle_key") || message.includes("duplicate key")) {
        throw new AgentProfileError("AGENT_HANDLE_TAKEN", "agent handle is already in use");
      }
      throw error;
    }
  }

  async getByDid(did: string) {
    parseEd25519DidKey(did);
    return { profile: await this.repository.getProfileByDid(did) };
  }

  async search(query: string) {
    return { profiles: await this.repository.search(query) };
  }
}
