import type { Pool } from "pg";
import type { AttestationSigner } from "../receipts/receipt.js";

export async function ensureActiveServerSigningKey(
  pool: Pool,
  signer: AttestationSigner,
  validFrom: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO server_signing_keys (
       key_id, algorithm, public_key, public_key_encoding, status, valid_from
     ) VALUES ($1,$2,$3,$4,'ACTIVE',$5)
     ON CONFLICT (key_id) DO NOTHING`,
    [signer.keyId, signer.algorithm, signer.publicKey, signer.publicKeyEncoding, validFrom],
  );

  const result = await pool.query<{
    algorithm: string;
    public_key: string;
    public_key_encoding: string;
    status: string;
  }>(
    `SELECT algorithm, public_key, public_key_encoding, status
     FROM server_signing_keys
     WHERE key_id = $1`,
    [signer.keyId],
  );
  const row = result.rows[0];
  if (
    !row ||
    row.algorithm !== signer.algorithm ||
    row.public_key !== signer.publicKey ||
    row.public_key_encoding !== signer.publicKeyEncoding ||
    row.status !== "ACTIVE"
  ) {
    throw new Error("configured attestation key id conflicts with stored public key metadata");
  }
}
