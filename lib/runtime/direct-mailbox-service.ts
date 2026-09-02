import { z } from "zod";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { decodeBase64Url } from "../crypto/base64url.js";
import { sha256 } from "../crypto/sha256.js";
import { parseEd25519DidKey } from "../identity/did-key.js";
import { verifyEd25519DidKeySignature } from "../identity/verify-signature.js";
import { buildCanonicalTechnocoreMessage } from "../trials/technocore-canonical-message/protocol.js";
import type { PgDirectMailboxRepository } from "../db/direct-mailbox-repository.js";

const DID_ACTION_WINDOW_MS = 10 * 60 * 1000;

const signatureSchema = z.object({
  algorithm: z.literal("Ed25519"),
  encoding: z.literal("base64url"),
  value: z.string().min(1),
}).strict();

const basePayload = z.object({
  version: z.literal("1"),
  actor_did: z.string().min(1),
  nonce: z.string().min(8).max(160),
  issued_at: z.string().datetime(),
});

const sendDirectPayload = basePayload.extend({
  action: z.literal("SEND_DIRECT_MESSAGE"),
  recipient_did: z.string().min(1),
  text: z.string().min(1).max(4096),
}).strict();

const listInboxPayload = basePayload.extend({ action: z.literal("LIST_DIRECT_INBOX") }).strict();
const listSentPayload = basePayload.extend({ action: z.literal("LIST_DIRECT_SENT") }).strict();

const signedEnvelope = z.object({ payload: z.record(z.unknown()), signature: signatureSchema }).strict();

export type DirectMailboxErrorCode =
  | "INVALID_MAILBOX_REQUEST"
  | "INVALID_MAILBOX_SIGNATURE"
  | "MAILBOX_ACTION_EXPIRED"
  | "MAILBOX_REPLAY"
  | "MAILBOX_SELF_SEND";

export class DirectMailboxError extends Error {
  constructor(readonly code: DirectMailboxErrorCode, message: string) {
    super(message);
    this.name = "DirectMailboxError";
  }
}

function assertFresh(issuedAt: string): void {
  const value = Date.parse(issuedAt);
  if (!Number.isFinite(value) || Math.abs(Date.now() - value) > DID_ACTION_WINDOW_MS) {
    throw new DirectMailboxError("MAILBOX_ACTION_EXPIRED", "signed mailbox action is outside the allowed time window");
  }
}

function normalizeEnvelope(input: unknown): { payload: Record<string, unknown>; signature: z.infer<typeof signatureSchema> } {
  const parsed = signedEnvelope.safeParse(input);
  if (!parsed.success) throw new DirectMailboxError("INVALID_MAILBOX_REQUEST", parsed.error.issues.map((issue) => issue.message).join("; "));
  return parsed.data;
}

export class DirectMailboxService {
  constructor(private readonly repository: PgDirectMailboxRepository) {}

  private async authenticate<T extends { actor_did: string; nonce: string; issued_at: string; action: string }>(input: unknown, schema: z.ZodType<T>): Promise<T> {
    const envelope = normalizeEnvelope(input);
    const parsed = schema.safeParse(envelope.payload);
    if (!parsed.success) throw new DirectMailboxError("INVALID_MAILBOX_REQUEST", parsed.error.issues.map((issue) => issue.message).join("; "));
    const payload = parsed.data;
    parseEd25519DidKey(payload.actor_did);
    assertFresh(payload.issued_at);
    let signature: Uint8Array;
    try {
      signature = decodeBase64Url(envelope.signature.value);
    } catch {
      throw new DirectMailboxError("INVALID_MAILBOX_SIGNATURE", "mailbox signature is not canonical base64url");
    }
    if (!verifyEd25519DidKeySignature(payload.actor_did, canonicalizeJsonToBytes(payload), signature)) {
      throw new DirectMailboxError("INVALID_MAILBOX_SIGNATURE", "mailbox action signature is invalid for actor DID");
    }
    const consumed = await this.repository.consumeActionNonce(payload.actor_did, payload.nonce, payload.action, payload.issued_at);
    if (!consumed) throw new DirectMailboxError("MAILBOX_REPLAY", "mailbox action nonce was already consumed");
    return payload;
  }

  async send(input: unknown) {
    const envelope = normalizeEnvelope(input);
    const payload = await this.authenticate(input, sendDirectPayload);
    parseEd25519DidKey(payload.recipient_did);
    if (payload.recipient_did === payload.actor_did) throw new DirectMailboxError("MAILBOX_SELF_SEND", "sender and recipient DID must differ");
    const scope = `mailbox:${payload.recipient_did}`;
    const { cleanedText, canonicalMessage } = buildCanonicalTechnocoreMessage(scope, payload.nonce, payload.text);
    const messageHash = sha256(new TextEncoder().encode(canonicalMessage));
    const message = await this.repository.insertDirectMessage({
      senderDid: payload.actor_did,
      recipientDid: payload.recipient_did,
      nonce: payload.nonce,
      rawText: payload.text,
      cleanedText,
      canonicalMessage,
      senderSignature: envelope.signature.value,
      messageHash,
      sentAt: payload.issued_at,
    });
    return {
      message,
      verification: {
        sender_did: "VERIFIED",
        signature: "VALID",
        message_integrity: "VALID",
        replay_check: "PASS",
        delivery: "STORED_FOR_RECIPIENT_DID",
        canonicalization: "technocore-canonical-message-v1",
      },
    };
  }

  async inbox(input: unknown) {
    const payload = await this.authenticate(input, listInboxPayload);
    return { messages: await this.repository.listInbox(payload.actor_did) };
  }

  async sent(input: unknown) {
    const payload = await this.authenticate(input, listSentPayload);
    return { messages: await this.repository.listSent(payload.actor_did) };
  }
}
