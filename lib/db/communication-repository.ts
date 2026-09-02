import type { Pool, PoolClient } from "pg";

export interface AgentRoomRecord {
  id: string;
  title: string;
  createdByDid: string;
  creationNonce: string;
  createdAt: string;
  members: Array<{ did: string; role: "OWNER" | "MEMBER"; joinedAt: string }>;
}

export interface AgentMessageRecord {
  id: string;
  roomId: string;
  senderDid: string;
  nonce: string;
  rawText: string;
  cleanedText: string;
  canonicalMessage: string;
  senderSignature: string;
  messageHash: string;
  sentAt: string;
  storedAt: string;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function ensureAgent(client: PoolClient, did: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO agents (did, did_method, key_type)
     VALUES ($1, 'key', 'Ed25519')
     ON CONFLICT (did) DO UPDATE SET last_seen_at = now()
     RETURNING id`,
    [did],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("agent upsert did not return id");
  return id;
}

export class PgCommunicationRepository {
  constructor(private readonly pool: Pool) {}

  async consumeActionNonce(did: string, nonce: string, action: string, consumedAt: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const agentId = await ensureAgent(client, did);
      const inserted = await client.query(
        `INSERT INTO agent_action_nonces (agent_id, nonce, action, consumed_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (agent_id, nonce) DO NOTHING
         RETURNING nonce`,
        [agentId, nonce, action, consumedAt],
      );
      await client.query("COMMIT");
      return inserted.rowCount === 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createRoom(input: {
    creatorDid: string;
    title: string;
    memberDids: string[];
    creationNonce: string;
    createdAt: string;
  }): Promise<AgentRoomRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const creatorId = await ensureAgent(client, input.creatorDid);
      const roomResult = await client.query<{ id: string; created_at: Date | string }>(
        `INSERT INTO agent_rooms (title, created_by_agent_id, creation_nonce, created_at)
         VALUES ($1,$2,$3,$4)
         RETURNING id, created_at`,
        [input.title, creatorId, input.creationNonce, input.createdAt],
      );
      const roomId = roomResult.rows[0]?.id;
      if (!roomId) throw new Error("room insert did not return id");

      const uniqueMembers = [...new Set([input.creatorDid, ...input.memberDids])];
      for (const did of uniqueMembers) {
        const agentId = did === input.creatorDid ? creatorId : await ensureAgent(client, did);
        await client.query(
          `INSERT INTO agent_room_members (room_id, agent_id, role)
           VALUES ($1,$2,$3)
           ON CONFLICT (room_id, agent_id) DO NOTHING`,
          [roomId, agentId, did === input.creatorDid ? "OWNER" : "MEMBER"],
        );
      }
      await client.query("COMMIT");
      const room = await this.getRoomForMember(roomId, input.creatorDid);
      if (!room) throw new Error("created room could not be reloaded");
      return room;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listRoomsForDid(did: string): Promise<AgentRoomRecord[]> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT r.id
       FROM agent_rooms r
       JOIN agent_room_members rm ON rm.room_id = r.id
       JOIN agents a ON a.id = rm.agent_id
       WHERE a.did = $1
       ORDER BY r.created_at DESC`,
      [did],
    );
    const rooms: AgentRoomRecord[] = [];
    for (const row of result.rows) {
      const room = await this.getRoomForMember(row.id, did);
      if (room) rooms.push(room);
    }
    return rooms;
  }

  async isMember(roomId: string, did: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1
       FROM agent_room_members rm
       JOIN agents a ON a.id = rm.agent_id
       WHERE rm.room_id = $1 AND a.did = $2`,
      [roomId, did],
    );
    return result.rowCount === 1;
  }

  async getRoomForMember(roomId: string, did: string): Promise<AgentRoomRecord | null> {
    if (!(await this.isMember(roomId, did))) return null;
    const room = await this.pool.query<{
      id: string;
      title: string;
      created_by_did: string;
      creation_nonce: string;
      created_at: Date | string;
    }>(
      `SELECT r.id, r.title, creator.did AS created_by_did, r.creation_nonce, r.created_at
       FROM agent_rooms r
       JOIN agents creator ON creator.id = r.created_by_agent_id
       WHERE r.id = $1`,
      [roomId],
    );
    const row = room.rows[0];
    if (!row) return null;
    const members = await this.pool.query<{
      did: string;
      role: "OWNER" | "MEMBER";
      joined_at: Date | string;
    }>(
      `SELECT a.did, rm.role, rm.joined_at
       FROM agent_room_members rm
       JOIN agents a ON a.id = rm.agent_id
       WHERE rm.room_id = $1
       ORDER BY rm.joined_at ASC, a.did ASC`,
      [roomId],
    );
    return {
      id: row.id,
      title: row.title,
      createdByDid: row.created_by_did,
      creationNonce: row.creation_nonce,
      createdAt: iso(row.created_at),
      members: members.rows.map((item) => ({ did: item.did, role: item.role, joinedAt: iso(item.joined_at) })),
    };
  }

  async insertMessage(input: {
    roomId: string;
    senderDid: string;
    nonce: string;
    rawText: string;
    cleanedText: string;
    canonicalMessage: string;
    senderSignature: string;
    messageHash: string;
    sentAt: string;
  }): Promise<AgentMessageRecord> {
    const result = await this.pool.query<{
      id: string;
      room_id: string;
      sender_did: string;
      nonce: string;
      raw_text: string;
      cleaned_text: string;
      canonical_message: string;
      sender_signature: string;
      message_hash: string;
      sent_at: Date | string;
      stored_at: Date | string;
    }>(
      `INSERT INTO agent_messages (
         room_id, sender_agent_id, nonce, raw_text, cleaned_text,
         canonical_message, sender_signature, message_hash, sent_at
       )
       SELECT $1, a.id, $3, $4, $5, $6, $7, $8, $9
       FROM agents a WHERE a.did = $2
       RETURNING id, room_id, $2::text AS sender_did, nonce, raw_text,
                 cleaned_text, canonical_message, sender_signature, message_hash,
                 sent_at, stored_at`,
      [input.roomId, input.senderDid, input.nonce, input.rawText, input.cleanedText,
       input.canonicalMessage, input.senderSignature, input.messageHash, input.sentAt],
    );
    const row = result.rows[0];
    if (!row) throw new Error("message insert did not return row");
    return {
      id: row.id,
      roomId: row.room_id,
      senderDid: row.sender_did,
      nonce: row.nonce,
      rawText: row.raw_text,
      cleanedText: row.cleaned_text,
      canonicalMessage: row.canonical_message,
      senderSignature: row.sender_signature,
      messageHash: row.message_hash,
      sentAt: iso(row.sent_at),
      storedAt: iso(row.stored_at),
    };
  }

  async listMessages(roomId: string, did: string, limit = 100): Promise<AgentMessageRecord[]> {
    if (!(await this.isMember(roomId, did))) return [];
    const result = await this.pool.query<{
      id: string;
      room_id: string;
      sender_did: string;
      nonce: string;
      raw_text: string;
      cleaned_text: string;
      canonical_message: string;
      sender_signature: string;
      message_hash: string;
      sent_at: Date | string;
      stored_at: Date | string;
    }>(
      `SELECT m.id, m.room_id, a.did AS sender_did, m.nonce, m.raw_text,
              m.cleaned_text, m.canonical_message, m.sender_signature,
              m.message_hash, m.sent_at, m.stored_at
       FROM agent_messages m
       JOIN agents a ON a.id = m.sender_agent_id
       WHERE m.room_id = $1
       ORDER BY m.sent_at DESC, m.id DESC
       LIMIT $2`,
      [roomId, Math.max(1, Math.min(limit, 200))],
    );
    return result.rows.reverse().map((row) => ({
      id: row.id,
      roomId: row.room_id,
      senderDid: row.sender_did,
      nonce: row.nonce,
      rawText: row.raw_text,
      cleanedText: row.cleaned_text,
      canonicalMessage: row.canonical_message,
      senderSignature: row.sender_signature,
      messageHash: row.message_hash,
      sentAt: iso(row.sent_at),
      storedAt: iso(row.stored_at),
    }));
  }
}
