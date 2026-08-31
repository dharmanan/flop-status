import type { Pool } from "pg";

export interface StoredReceiptEvidence {
  unsignedPayload: unknown;
  serverSignature: string;
}

export interface StoredServerKey {
  key_id: string;
  algorithm: string;
  public_key: string;
  encoding: string;
  status: string;
  valid_from: string;
  valid_until: string | null;
}

export interface PublicVerificationRepository {
  findReceiptById(receiptId: string): Promise<StoredReceiptEvidence | null>;
  findServerKeyById(keyId: string): Promise<StoredServerKey | null>;
  listServerKeys(): Promise<StoredServerKey[]>;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export class PgPublicVerificationRepository implements PublicVerificationRepository {
  constructor(private readonly pool: Pool) {}

  async findReceiptById(receiptId: string): Promise<StoredReceiptEvidence | null> {
    const result = await this.pool.query<{
      unsigned_payload: unknown;
      server_signature: string;
    }>(
      `SELECT unsigned_payload, server_signature
       FROM receipts
       WHERE id = $1`,
      [receiptId],
    );
    const row = result.rows[0];
    return row
      ? { unsignedPayload: row.unsigned_payload, serverSignature: row.server_signature }
      : null;
  }

  async findServerKeyById(keyId: string): Promise<StoredServerKey | null> {
    const result = await this.pool.query<{
      key_id: string;
      algorithm: string;
      public_key: string;
      public_key_encoding: string;
      status: string;
      valid_from: Date | string;
      valid_until: Date | string | null;
    }>(
      `SELECT key_id, algorithm, public_key, public_key_encoding,
         status, valid_from, valid_until
       FROM server_signing_keys
       WHERE key_id = $1`,
      [keyId],
    );
    const row = result.rows[0];
    return row
      ? {
          key_id: row.key_id,
          algorithm: row.algorithm,
          public_key: row.public_key,
          encoding: row.public_key_encoding,
          status: row.status,
          valid_from: iso(row.valid_from),
          valid_until: row.valid_until === null ? null : iso(row.valid_until),
        }
      : null;
  }

  async listServerKeys(): Promise<StoredServerKey[]> {
    const result = await this.pool.query<{
      key_id: string;
      algorithm: string;
      public_key: string;
      public_key_encoding: string;
      status: string;
      valid_from: Date | string;
      valid_until: Date | string | null;
    }>(
      `SELECT key_id, algorithm, public_key, public_key_encoding,
         status, valid_from, valid_until
       FROM server_signing_keys
       ORDER BY valid_from ASC, key_id ASC`,
    );
    return result.rows.map((row) => ({
      key_id: row.key_id,
      algorithm: row.algorithm,
      public_key: row.public_key,
      encoding: row.public_key_encoding,
      status: row.status,
      valid_from: iso(row.valid_from),
      valid_until: row.valid_until === null ? null : iso(row.valid_until),
    }));
  }
}
