import { z } from "zod";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { decodeBase64Url } from "../crypto/base64url.js";
import { sha256 } from "../crypto/sha256.js";
import { parseEd25519DidKey } from "../identity/did-key.js";
import { verifyEd25519DidKeySignature } from "../identity/verify-signature.js";
import { buildCanonicalTechnocoreMessage } from "../trials/technocore-canonical-message/protocol.js";
import type { PgCommunicationRepository } from "../db/communication-repository.js";

const DID_ACTION_WINDOW_MS = 10 * 60 * 1000;
const MAX_ROOM_MEMBERS = 24;

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

const createRoomPayload = basePayload.extend({
  action: z.literal("CREATE_ROOM"),
  title: z.string().trim().min(1).max(120),
  member_dids: z.array(z.string().min(1)).max(MAX_ROOM_MEMBERS),
}).strict();

const listRoomsPayload = basePayload.extend({ action: z.literal("LIST_ROOMS") }).strict();
const listMessagesPayload = basePayload.extend({
  action: z.literal("LIST_MESSAGES"),
  room_id: z.string().uuid(),
}).strict();
const sendMessagePayload = basePayload.extend({
  action: z.literal("SEND_MESSAGE"),
  room_id: z.string().uuid(),
  text: z.string().min(1).max(4096),
}).strict();

const signedEnvelope = z.object({
  payload: z.record(z.unknown()),
  signature: signatureSchema,
}).strict();

export type CommunicationErrorCode =
  | "INVALID_COMMUNICATION_REQUEST"
  | "INVALID_COMMUNICATION_SIGNATURE"
  | "COMMUNICATION_ACTION_EXPIRED"
  | "COMMUNICATION_REPLAY"
  | "ROOM_NOT_FOUND"
  | "ROOM_ACCESS_DENIED";

export class CommunicationError extends Error {
  constructor(readonly code: CommunicationErrorCode, message: string) {
    super(message);
    this.name = "CommunicationError";
  }
}

function assertFresh(issuedAt: string): void {
  const value = Date.parse(issuedAt);
  if (!Number.isFinite(value) || Math.abs(Date.now() - value) > DID_ACTION_WINDOW_MS) {
    throw new CommunicationError("COMMUNICATION_ACTION_EXPIRED", "signed communication action is outside the allowed time window");
  }
}

function normalizeEnvelope(input: unknown): { payload: Record<string, unknown>; signature: z.infer<typeof signatureSchema> } {
  const parsed = signedEnvelope.safeParse(input);
  if (!parsed.success) {
    throw new CommunicationError("INVALID_COMMUNICATION_REQUEST", parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}

export class CommunicationService {
  constructor(private readonly repository: PgCommunicationRepository) {}

  private async authenticate<T extends { actor_did: string; nonce: string; issued_at: string; action: string }>(
    input: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const envelope = normalizeEnvelope(input);
    const parsed = schema.safeParse(envelope.payload);
    if (!parsed.success) {
      throw new CommunicationError("INVALID_COMMUNICATION_REQUEST", parsed.error.issues.map((issue) => issue.message).join("; "));
    }
    const payload = parsed.data;
    parseEd25519DidKey(payload.actor_did);
    assertFresh(payload.issued_at);

    let signature: Uint8Array;
    try {
      signature = decodeBase64Url(envelope.signature.value);
    } catch {
      throw new CommunicationError("INVALID_COMMUNICATION_SIGNATURE", "communication signature is not canonical base64url");
    }
    if (!verifyEd25519DidKeySignature(payload.actor_did, canonicalizeJsonToBytes(payload), signature)) {
      throw new CommunicationError("INVALID_COMMUNICATION_SIGNATURE", "communication action signature is invalid for actor DID");
    }

    const consumed = await this.repository.consumeActionNonce(payload.actor_did, payload.nonce, payload.action, payload.issued_at);
    if (!consumed) throw new CommunicationError("COMMUNICATION_REPLAY", "communication action nonce was already consumed");
    return payload;
  }

  async createRoom(input: unknown) {
    const payload = await this.authenticate(input, createRoomPayload);
    const members = [...new Set(payload.member_dids.filter((did) => did !== payload.actor_did))];
    members.forEach((did) => parseEd25519DidKey(did));
    const room = await this.repository.createRoom({
      creatorDid: payload.actor_did,
      title: payload.title,
      memberDids: members,
      creationNonce: payload.nonce,
      createdAt: payload.issued_at,
    });
    return { room };
  }

  async listRooms(input: unknown) {
    const payload = await this.authenticate(input, listRoomsPayload);
    return { rooms: await this.repository.listRoomsForDid(payload.actor_did) };
  }

  async listMessages(input: unknown, roomId: string) {
    const payload = await this.authenticate(input, listMessagesPayload);
    if (payload.room_id !== roomId) throw new CommunicationError("INVALID_COMMUNICATION_REQUEST", "signed room id does not match route");
    if (!(await this.repository.isMember(roomId, payload.actor_did))) {
      throw new CommunicationError("ROOM_ACCESS_DENIED", "actor DID is not a member of this room");
    }
    const room = await this.repository.getRoomForMember(roomId, payload.actor_did);
    if (!room) throw new CommunicationError("ROOM_NOT_FOUND", "room not found");
    return { room, messages: await this.repository.listMessages(roomId, payload.actor_did) };
  }

  async sendMessage(input: unknown, roomId: string) {
    const payload = await this.authenticate(input, sendMessagePayload);
    if (payload.room_id !== roomId) throw new CommunicationError("INVALID_COMMUNICATION_REQUEST", "signed room id does not match route");
    if (!(await this.repository.isMember(roomId, payload.actor_did))) {
      throw new CommunicationError("ROOM_ACCESS_DENIED", "actor DID is not a member of this room");
    }

    const { cleanedText, canonicalMessage } = buildCanonicalTechnocoreMessage(roomId, payload.nonce, payload.text);
    const messageHash = sha256(new TextEncoder().encode(canonicalMessage));
    const message = await this.repository.insertMessage({
      roomId,
      senderDid: payload.actor_did,
      nonce: payload.nonce,
      rawText: payload.text,
      cleanedText,
      canonicalMessage,
      senderSignature: normalizeEnvelope(input).signature.value,
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
        canonicalization: "technocore-canonical-message-v1",
      },
    };
  }
}
