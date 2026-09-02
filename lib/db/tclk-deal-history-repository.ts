import type { Pool, PoolClient } from "pg";

export interface ArchivedTclkFrame {
  room: string;
  seq: number;
  offerId: string;
  frameType: string;
  fromDid: string;
  line: string;
  frame: Record<string, unknown>;
  transportSig: string;
  transportNonce: string;
}

export interface ArchivedTclkDeal {
  offerId: string;
  contractId: string | null;
  payerDid: string;
  payeeDid: string | null;
  amount: string;
  asset: string;
  jobId: string | null;
  jobContext: string | null;
  status: string;
  offerExpiresMs: number | null;
  claimByMs: number | null;
  refundAfterMs: number | null;
  createdAt: string;
  updatedAt: string;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function numeric(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export class PgTclkDealHistoryRepository {
  constructor(private readonly pool: Pool) {}

  async createOffer(input: {
    offerId: string;
    payerDid: string;
    amount: string;
    asset: string;
    jobId?: string | null;
    jobContext?: string | null;
    offerExpiresMs?: number | null;
    claimByMs?: number | null;
    refundAfterMs?: number | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO tclk_deals (
         offer_id, payer_did, amount, asset, job_id, job_context, status,
         offer_expires_ms, claim_by_ms, refund_after_ms
       ) VALUES ($1,$2,$3,$4,$5,$6,'proposed',$7,$8,$9)
       ON CONFLICT (offer_id) DO UPDATE SET
         payer_did = EXCLUDED.payer_did,
         amount = EXCLUDED.amount,
         asset = EXCLUDED.asset,
         job_id = COALESCE(tclk_deals.job_id, EXCLUDED.job_id),
         job_context = COALESCE(tclk_deals.job_context, EXCLUDED.job_context),
         offer_expires_ms = COALESCE(tclk_deals.offer_expires_ms, EXCLUDED.offer_expires_ms),
         claim_by_ms = COALESCE(tclk_deals.claim_by_ms, EXCLUDED.claim_by_ms),
         refund_after_ms = COALESCE(tclk_deals.refund_after_ms, EXCLUDED.refund_after_ms),
         updated_at = now()`,
      [
        input.offerId,
        input.payerDid,
        input.amount,
        input.asset,
        input.jobId ?? null,
        input.jobContext ?? null,
        input.offerExpiresMs ?? null,
        input.claimByMs ?? null,
        input.refundAfterMs ?? null,
      ],
    );
  }

  async offerIdForContract(contract: string): Promise<string | null> {
    const result = await this.pool.query<{ offer_id: string }>(
      `SELECT offer_id FROM tclk_deals WHERE contract_id = $1 OR offer_id = $1 LIMIT 1`,
      [contract],
    );
    return result.rows[0]?.offer_id ?? null;
  }

  async storeFrame(frame: ArchivedTclkFrame): Promise<void> {
    await this.pool.query(
      `INSERT INTO tclk_deal_frames (
         room, seq, offer_id, frame_type, from_did, line, frame, transport_sig, transport_nonce
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
       ON CONFLICT (room, seq) DO NOTHING`,
      [
        frame.room,
        frame.seq,
        frame.offerId,
        frame.frameType,
        frame.fromDid,
        frame.line,
        JSON.stringify(frame.frame),
        frame.transportSig,
        frame.transportNonce,
      ],
    );
  }

  async transcriptLines(offerId: string): Promise<string[]> {
    const result = await this.pool.query<{ line: string }>(
      `SELECT line
       FROM tclk_deal_frames
       WHERE offer_id = $1
       ORDER BY CASE WHEN room = 'tclk-offers' THEN 0 ELSE 1 END, seq ASC`,
      [offerId],
    );
    return result.rows.map((row) => row.line);
  }

  async updateState(input: {
    offerId: string;
    contractId?: string | null;
    payeeDid?: string | null;
    status: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE tclk_deals SET
         contract_id = COALESCE($2, contract_id),
         payee_did = COALESCE($3, payee_did),
         status = $4,
         updated_at = now()
       WHERE offer_id = $1`,
      [input.offerId, input.contractId ?? null, input.payeeDid ?? null, input.status],
    );
  }

  async listByDid(did: string, limit = 100): Promise<ArchivedTclkDeal[]> {
    const result = await this.pool.query<{
      offer_id: string;
      contract_id: string | null;
      payer_did: string;
      payee_did: string | null;
      amount: string;
      asset: string;
      job_id: string | null;
      job_context: string | null;
      status: string;
      offer_expires_ms: string | number | null;
      claim_by_ms: string | number | null;
      refund_after_ms: string | number | null;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT offer_id, contract_id, payer_did, payee_did, amount, asset,
              job_id, job_context, status, offer_expires_ms, claim_by_ms,
              refund_after_ms, created_at, updated_at
       FROM tclk_deals
       WHERE payer_did = $1 OR payee_did = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [did, Math.max(1, Math.min(limit, 200))],
    );
    return result.rows.map((row) => ({
      offerId: row.offer_id,
      contractId: row.contract_id,
      payerDid: row.payer_did,
      payeeDid: row.payee_did,
      amount: row.amount,
      asset: row.asset,
      jobId: row.job_id,
      jobContext: row.job_context,
      status: row.status,
      offerExpiresMs: numeric(row.offer_expires_ms),
      claimByMs: numeric(row.claim_by_ms),
      refundAfterMs: numeric(row.refund_after_ms),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    }));
  }

  async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { return await fn(client); } finally { client.release(); }
  }
}
