import { generateKeyPairSync, sign } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { encodeBase58btc } from "../../lib/crypto/base58.js";
import { encodeBase64Url } from "../../lib/crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../../lib/crypto/canonical-json.js";
import { CommunicationService } from "../../lib/runtime/communication-service.js";

function agent() {
  const pair = generateKeyPairSync("ed25519");
  const jwk = pair.publicKey.export({ format: "jwk" }) as { x: string };
  const raw = Buffer.from(jwk.x, "base64url");
  const prefixed = new Uint8Array(34);
  prefixed.set([0xed, 0x01], 0);
  prefixed.set(raw, 2);
  const did = `did:key:z${encodeBase58btc(prefixed)}`;
  return {
    did,
    sign(payload: unknown) {
      return encodeBase64Url(new Uint8Array(sign(null, Buffer.from(canonicalizeJsonToBytes(payload)), pair.privateKey)));
    },
  };
}

function envelope(a: ReturnType<typeof agent>, payload: Record<string, unknown>) {
  return {
    payload,
    signature: { algorithm: "Ed25519", encoding: "base64url", value: a.sign(payload) },
  };
}

class FakeCommunicationRepository {
  consumed = new Set<string>();
  members = new Set<string>();
  lastMessage: any = null;
  room = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Core room",
    createdByDid: "",
    creationNonce: "",
    createdAt: new Date().toISOString(),
    members: [] as Array<{ did: string; role: "OWNER" | "MEMBER"; joinedAt: string }>,
  };

  async consumeActionNonce(did: string, nonce: string) {
    const key = `${did}:${nonce}`;
    if (this.consumed.has(key)) return false;
    this.consumed.add(key);
    return true;
  }
  async createRoom(input: any) {
    this.room = {
      id: this.room.id,
      title: input.title,
      createdByDid: input.creatorDid,
      creationNonce: input.creationNonce,
      createdAt: input.createdAt,
      members: [input.creatorDid, ...input.memberDids].map((did: string, index: number) => ({ did, role: index === 0 ? "OWNER" as const : "MEMBER" as const, joinedAt: input.createdAt })),
    };
    this.room.members.forEach((member) => this.members.add(`${this.room.id}:${member.did}`));
    return this.room;
  }
  async listRoomsForDid(did: string) {
    return this.room.members.some((member) => member.did === did) ? [this.room] : [];
  }
  async isMember(roomId: string, did: string) { return this.members.has(`${roomId}:${did}`); }
  async getRoomForMember(roomId: string, did: string) { return await this.isMember(roomId, did) ? this.room : null; }
  async insertMessage(input: any) {
    this.lastMessage = { id: "22222222-2222-4222-8222-222222222222", ...input, storedAt: input.sentAt };
    return this.lastMessage;
  }
  async listMessages(roomId: string, did: string) {
    return await this.isMember(roomId, did) && this.lastMessage ? [this.lastMessage] : [];
  }
}

describe("CommunicationService", () => {
  let repository: FakeCommunicationRepository;
  let service: CommunicationService;
  let owner: ReturnType<typeof agent>;
  let member: ReturnType<typeof agent>;

  beforeEach(() => {
    repository = new FakeCommunicationRepository();
    service = new CommunicationService(repository as any);
    owner = agent();
    member = agent();
  });

  it("creates a room only after a valid DID signature", async () => {
    const payload = {
      version: "1", action: "CREATE_ROOM", actor_did: owner.did,
      nonce: crypto.randomUUID(), issued_at: new Date().toISOString(),
      title: "Research room", member_dids: [member.did],
    };
    const result = await service.createRoom(envelope(owner, payload));
    expect(result.room.title).toBe("Research room");
    expect(result.room.members.map((item) => item.did)).toEqual([owner.did, member.did]);
  });

  it("rejects a signature made by another DID", async () => {
    const payload = {
      version: "1", action: "LIST_ROOMS", actor_did: owner.did,
      nonce: crypto.randomUUID(), issued_at: new Date().toISOString(),
    };
    await expect(service.listRooms(envelope(member, payload))).rejects.toMatchObject({
      code: "INVALID_COMMUNICATION_SIGNATURE",
    });
  });

  it("rejects replay of the same signed action nonce", async () => {
    const payload = {
      version: "1", action: "LIST_ROOMS", actor_did: owner.did,
      nonce: crypto.randomUUID(), issued_at: new Date().toISOString(),
    };
    const signed = envelope(owner, payload);
    await service.listRooms(signed);
    await expect(service.listRooms(signed)).rejects.toMatchObject({ code: "COMMUNICATION_REPLAY" });
  });

  it("rejects expired signed actions", async () => {
    const payload = {
      version: "1", action: "LIST_ROOMS", actor_did: owner.did,
      nonce: crypto.randomUUID(), issued_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    };
    await expect(service.listRooms(envelope(owner, payload))).rejects.toMatchObject({
      code: "COMMUNICATION_ACTION_EXPIRED",
    });
  });

  it("derives the Technocore canonical message on the server and stores a deterministic hash", async () => {
    const created = {
      version: "1", action: "CREATE_ROOM", actor_did: owner.did,
      nonce: crypto.randomUUID(), issued_at: new Date().toISOString(),
      title: "Canonical room", member_dids: [member.did],
    };
    const room = (await service.createRoom(envelope(owner, created))).room;
    const nonce = crypto.randomUUID();
    const sentAt = new Date().toISOString();
    const payload = {
      version: "1", action: "SEND_MESSAGE", actor_did: owner.did,
      nonce, issued_at: sentAt, room_id: room.id, text: "  hello\n\tagent   network  ",
    };
    const result = await service.sendMessage(envelope(owner, payload), room.id);
    expect(result.message.cleanedText).toBe("hello agent network");
    expect(result.message.canonicalMessage).toBe(`${room.id}|${nonce}|hello agent network`);
    expect(result.message.messageHash).toMatch(/^sha256:/);
    expect(result.verification).toEqual({
      sender_did: "VERIFIED",
      signature: "VALID",
      message_integrity: "VALID",
      replay_check: "PASS",
      canonicalization: "technocore-canonical-message-v1",
    });
  });

  it("blocks a non-member from reading or sending into a room", async () => {
    const outsider = agent();
    const created = {
      version: "1", action: "CREATE_ROOM", actor_did: owner.did,
      nonce: crypto.randomUUID(), issued_at: new Date().toISOString(),
      title: "Private room", member_dids: [member.did],
    };
    const room = (await service.createRoom(envelope(owner, created))).room;
    const readPayload = {
      version: "1", action: "LIST_MESSAGES", actor_did: outsider.did,
      nonce: crypto.randomUUID(), issued_at: new Date().toISOString(), room_id: room.id,
    };
    await expect(service.listMessages(envelope(outsider, readPayload), room.id)).rejects.toMatchObject({ code: "ROOM_ACCESS_DENIED" });

    const sendPayload = {
      version: "1", action: "SEND_MESSAGE", actor_did: outsider.did,
      nonce: crypto.randomUUID(), issued_at: new Date().toISOString(), room_id: room.id, text: "not allowed",
    };
    await expect(service.sendMessage(envelope(outsider, sendPayload), room.id)).rejects.toMatchObject({ code: "ROOM_ACCESS_DENIED" });
  });
});
