import type { Pool, PoolClient } from "pg";

export interface DirectMessageRecord {
  id: string;
  senderDid: string;
  recipientDid: string;
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

export class PgDirectMailboxRepository {
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

  async insertDirectMessage(input: {
    senderDid: string;
    recipientDid: string;
    nonce: string;
    rawText: string;
    cleanedText: string;
    canonicalMessage: string;
    senderSignature: string;
    messageHash: string;
    sentAt: string;
  }): Promise<DirectMessageRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const senderId = await ensureAgent(client, input.senderDid);
      const recipientId = await ensureAgent(client, input.recipientDid);
      const result = await client.query<{
        id: string; nonce: string; raw_text: string; cleaned_text: string;
        canonical_message: string; sender_signature: string; message_hash: string;
        sent_at: Date | string; stored_at: Date | string;
      }>(
        `INSERT INTO agent_direct_messages (
           sender_agent_id, recipient_agent_id, nonce, raw_text, cleaned_text,
           canonical_message, sender_signature, message_hash, sent_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, nonce, raw_text, cleaned_text, canonical_message,
                   sender_signature, message_hash, sent_at, stored_at`,
        [senderId, recipientId, input.nonce, input.rawText, input.cleanedText,
         input.canonicalMessage, input.senderSignature, input.messageHash, input.sentAt],
      );
      await client.query("COMMIT");
      const row = result.rows[0];
      if (!row) throw new Error("direct message insert did not return row");
      return {
        id: row.id,
        senderDid: input.senderDid,
        recipientDid: input.recipientDid,
        nonce: row.nonce,
        rawText: row.raw_text,
        cleanedText: row.cleaned_text,
        canonicalMessage: row.canonical_message,
        senderSignature: row.sender_signature,
        messageHash: row.message_hash,
        sentAt: iso(row.sent_at),
        storedAt: iso(row.stored_at),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async listFor(column: "sender_agent_id" | "recipient_agent_id", did: string, limit = 100): Promise<DirectMessageRecord[]> {
    const result = await this.pool.query<{
      id: string; sender_did: string; recipient_did: string; nonce: string;
      raw_text: string; cleaned_text: string; canonical_message: string;
      sender_signature: string; message_hash: string; sent_at: Date | string; stored_at: Date | string;
    }>(
      `SELECT m.id, sender.did AS sender_did, recipient.did AS recipient_did,
              m.nonce, m.raw_text, m.cleaned_text, m.canonical_message,
              m.sender_signature, m.message_hash, m.sent_at, m.stored_at
       FROM agent_direct_messages m
       JOIN agents sender ON sender.id = m.sender_agent_id
       JOIN agents recipient ON recipient.id = m.recipient_agent_id
       JOIN agents actor ON actor.id = m.${column}
       WHERE actor.did = $1
       ORDER BY m.sent_at DESC, m.id DESC
       LIMIT $2`,
      [did, Math.max(1, Math.min(limit, 200))],
    );
    return result.rows.map((row) => ({
      id: row.id,
      senderDid: row.sender_did,
      recipientDid: row.recipient_did,
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

  async listInbox(did: string, limit = 100): Promise<DirectMessageRecord[]> {
    return this.listFor("recipient_agent_id", did, limit);
  }

  async listSent(did: string, limit = 100): Promise<DirectMessageRecord[]> {
    return this.listFor("sender_agent_id", did, limit);
  }
}
