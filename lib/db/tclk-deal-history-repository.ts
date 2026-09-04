import type { Pool } from "pg";

export interface ArchivedTclkFrame {
  venue: string;
  room: string;
  seq: number;
  offerId: string;
  frameType: string;
  fromDid: string;
  line: string;
  frame: Record<string, unknown>;
  transportSig: string;
  transportNonce: string;
  /** Technocore's own room-conversation epoch. NULL when not established — never a guess. */
  roomGeneration: number | null;
  /** SHA-256 physical-record identity, set only when roomGeneration is NULL. See computeTransportRecordFingerprint. */
  transportRecordFingerprint: string | null;
  /**
   * The Technocore venue's own timestamp for this record, in epoch
   * milliseconds. NULL when the frame was archived before this column
   * existed, or when its `ts` could not be parsed — historical reconstruction
   * must treat those frames as unusable rather than substitute any other time.
   */
  venueTimestampMs: number | null;
}

export interface ArchivedFrameIdentityRow {
  id: number;
  venue: string;
  room: string;
  seq: number;
  fromDid: string;
  line: string;
  transportSig: string;
  transportNonce: string;
}

export interface ArchivedTclkDeal {
  venue: string;
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

/**
 * A frame's identity at insert time: either a real, Technocore-reported room
 * generation (then transportRecordFingerprint is not needed and must be
 * null), or an unknown generation, in which case a fingerprint is the only
 * safe physical identity and is required — this pairing is enforced by the
 * type itself so an invalid combination cannot be constructed.
 */
export type FrameIdentityInput =
  | { roomGeneration: number; transportRecordFingerprint: null }
  | { roomGeneration: null; transportRecordFingerprint: string };

export type StoreFrameOutcome =
  | { outcome: "inserted" }
  | { outcome: "duplicate" }
  | { outcome: "conflict"; existing: { fromDid: string; line: string; transportSig: string; transportNonce: string } };

export type GetByOfferIdResult =
  | { status: "found"; deal: ArchivedTclkDeal; frames: ArchivedTclkFrame[] }
  | { status: "not_found" }
  | { status: "ambiguous"; venues: string[] };

type DealRow = {
  venue: string;
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
};

type FrameRow = {
  venue: string;
  room: string;
  seq: string | number;
  offer_id: string;
  frame_type: string;
  from_did: string;
  line: string;
  frame: Record<string, unknown>;
  transport_sig: string;
  transport_nonce: string;
  room_generation: string | number | null;
  transport_record_fingerprint: string | null;
  venue_timestamp_ms: string | number | null;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function numeric(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function mapFrame(row: FrameRow): ArchivedTclkFrame {
  return {
    venue: row.venue,
    room: row.room,
    seq: Number(row.seq),
    offerId: row.offer_id,
    frameType: row.frame_type,
    fromDid: row.from_did,
    line: row.line,
    frame: row.frame,
    transportSig: row.transport_sig,
    transportNonce: row.transport_nonce,
    roomGeneration: numeric(row.room_generation),
    transportRecordFingerprint: row.transport_record_fingerprint,
    venueTimestampMs: numeric(row.venue_timestamp_ms),
  };
}

function mapDeal(row: DealRow): ArchivedTclkDeal {
  return {
    venue: row.venue,
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
  };
}

const DEAL_COLUMNS = `venue, offer_id, contract_id, payer_did, payee_did, amount, asset,
  job_id, job_context, status, offer_expires_ms, claim_by_ms,
  refund_after_ms, created_at, updated_at`;

const FRAME_COLUMNS = `venue, room, seq, offer_id, frame_type, from_did, line, frame,
  transport_sig, transport_nonce, room_generation, transport_record_fingerprint, venue_timestamp_ms`;

export class PgTclkDealHistoryRepository {
  constructor(private readonly pool: Pool) {}

  async createOffer(input: {
    venue: string;
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
         venue, offer_id, payer_did, amount, asset, job_id, job_context, status,
         offer_expires_ms, claim_by_ms, refund_after_ms
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'proposed',$8,$9,$10)
       ON CONFLICT (venue, offer_id) DO UPDATE SET
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
        input.venue,
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

  /**
   * Seq numbers already archived for a room at a KNOWN generation. Only
   * meaningful there: without a real generation, seq is not proven stable
   * (a room reap can restart it), so unknown-generation ingestion must not
   * fast-skip by seq at all — it relies on storeFrame's own fingerprint
   * dedup instead (see TclkDealHistoryService.ingestRoom).
   */
  async archivedSeqs(venue: string, room: string, roomGeneration: number, seqs: number[]): Promise<Set<number>> {
    if (!seqs.length) return new Set();
    const result = await this.pool.query<{ seq: string | number }>(
      `SELECT seq FROM tclk_deal_frames WHERE venue = $1 AND room = $2 AND room_generation = $3 AND seq = ANY($4::bigint[])`,
      [venue, room, roomGeneration, seqs],
    );
    return new Set(result.rows.map((row) => Number(row.seq)));
  }

  /**
   * Archived frames still missing an authoritative venue timestamp, for the
   * backfill script. Returns each row's surrogate id so the write-back can
   * target it exactly — never by room+seq (not stable without a generation)
   * or transport_sig (not a safe update key either, see storeFrame).
   */
  async framesMissingVenueTimestamp(limit = 5000): Promise<ArchivedFrameIdentityRow[]> {
    const result = await this.pool.query<{
      id: string | number;
      venue: string;
      room: string;
      seq: string | number;
      from_did: string;
      line: string;
      transport_sig: string;
      transport_nonce: string;
    }>(
      `SELECT id, venue, room, seq, from_did, line, transport_sig, transport_nonce
       FROM tclk_deal_frames
       WHERE venue_timestamp_ms IS NULL
       ORDER BY id
       LIMIT $1`,
      [Math.max(1, Math.min(limit, 20_000))],
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      venue: row.venue,
      room: row.room,
      seq: Number(row.seq),
      fromDid: row.from_did,
      line: row.line,
      transportSig: row.transport_sig,
      transportNonce: row.transport_nonce,
    }));
  }

  /**
   * Only ever sets a timestamp that is currently NULL, targeted by the row's
   * own surrogate id. This is what makes a backfill run safe to repeat: a
   * row already backfilled (by this run or a previous one) is untouched.
   */
  async setVenueTimestampIfMissing(id: number, venueTimestampMs: number): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE tclk_deal_frames SET venue_timestamp_ms = $1 WHERE id = $2 AND venue_timestamp_ms IS NULL`,
      [venueTimestampMs, id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async offerExists(venue: string, offerId: string): Promise<boolean> {
    const result = await this.pool.query(`SELECT 1 FROM tclk_deals WHERE venue = $1 AND offer_id = $2 LIMIT 1`, [venue, offerId]);
    return result.rowCount === 1;
  }

  async offerIdForContract(venue: string, contract: string): Promise<string | null> {
    const result = await this.pool.query<{ offer_id: string }>(
      `SELECT offer_id FROM tclk_deals WHERE venue = $1 AND (contract_id = $2 OR offer_id = $2) LIMIT 1`,
      [venue, contract],
    );
    return result.rows[0]?.offer_id ?? null;
  }

  /**
   * A legacy row's identity is not established beyond room+seq. Consulted
   * only when ingesting an unknown-generation record, to decide whether it
   * might be the very same physical record as an already-archived legacy
   * row (see TclkDealHistoryService's ambiguous-legacy-record handling)
   * rather than a genuinely distinct later append that happens to reuse the
   * same room+seq.
   */
  async findLegacyFrameAt(venue: string, room: string, seq: number): Promise<{
    fromDid: string;
    line: string;
    transportSig: string;
    transportNonce: string;
    venueTimestampMs: number | null;
  } | null> {
    const result = await this.pool.query<{
      from_did: string;
      line: string;
      transport_sig: string;
      transport_nonce: string;
      venue_timestamp_ms: string | number | null;
    }>(
      `SELECT from_did, line, transport_sig, transport_nonce, venue_timestamp_ms
       FROM tclk_deal_frames
       WHERE venue = $1 AND room = $2 AND seq = $3
         AND room_generation IS NULL AND transport_record_fingerprint IS NULL
       LIMIT 1`,
      [venue, room, seq],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      fromDid: row.from_did,
      line: row.line,
      transportSig: row.transport_sig,
      transportNonce: row.transport_nonce,
      venueTimestampMs: numeric(row.venue_timestamp_ms),
    };
  }

  /**
   * Inserts one archived frame under the conflict target matching its
   * identity kind (known generation: venue+room+generation+seq; unknown:
   * venue+fingerprint). If the insert conflicts, fetches the row it
   * conflicted against and compares signed evidence: identical evidence is
   * a safe duplicate (idempotent re-ingestion, a no-op); different evidence
   * at the same key is a genuine identity conflict, reported to the caller
   * and never silently overwritten or dropped.
   */
  async storeFrame(
    frame: {
      venue: string;
      room: string;
      seq: number;
      offerId: string;
      frameType: string;
      fromDid: string;
      line: string;
      frame: Record<string, unknown>;
      transportSig: string;
      transportNonce: string;
      venueTimestampMs: number | null;
    } & FrameIdentityInput,
  ): Promise<StoreFrameOutcome> {
    const knownGeneration = frame.roomGeneration !== null;
    const conflictClause = knownGeneration
      ? `(venue, room, room_generation, seq) WHERE room_generation IS NOT NULL`
      : `(venue, transport_record_fingerprint) WHERE room_generation IS NULL AND transport_record_fingerprint IS NOT NULL`;

    const insertResult = await this.pool.query<{ id: string | number }>(
      `INSERT INTO tclk_deal_frames (${FRAME_COLUMNS})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)
       ON CONFLICT ${conflictClause} DO NOTHING
       RETURNING id`,
      [
        frame.venue,
        frame.room,
        frame.seq,
        frame.offerId,
        frame.frameType,
        frame.fromDid,
        frame.line,
        JSON.stringify(frame.frame),
        frame.transportSig,
        frame.transportNonce,
        frame.roomGeneration,
        frame.transportRecordFingerprint,
        frame.venueTimestampMs,
      ],
    );
    if (insertResult.rows.length > 0) return { outcome: "inserted" };

    const existingQuery = knownGeneration
      ? this.pool.query<{ from_did: string; line: string; transport_sig: string; transport_nonce: string }>(
          `SELECT from_did, line, transport_sig, transport_nonce FROM tclk_deal_frames
           WHERE venue = $1 AND room = $2 AND room_generation = $3 AND seq = $4`,
          [frame.venue, frame.room, frame.roomGeneration, frame.seq],
        )
      : this.pool.query<{ from_did: string; line: string; transport_sig: string; transport_nonce: string }>(
          `SELECT from_did, line, transport_sig, transport_nonce FROM tclk_deal_frames
           WHERE venue = $1 AND transport_record_fingerprint = $2 AND room_generation IS NULL`,
          [frame.venue, frame.transportRecordFingerprint],
        );
    const existing = (await existingQuery).rows[0];
    if (
      existing
      && existing.from_did === frame.fromDid
      && existing.line === frame.line
      && existing.transport_sig === frame.transportSig
      && existing.transport_nonce === frame.transportNonce
    ) {
      return { outcome: "duplicate" };
    }
    // existing should always be present here — the insert just conflicted
    // against it. If it is somehow absent (this schema never deletes rows),
    // fail closed as a conflict rather than assume success.
    return {
      outcome: "conflict",
      existing: existing
        ? { fromDid: existing.from_did, line: existing.line, transportSig: existing.transport_sig, transportNonce: existing.transport_nonce }
        : { fromDid: "", line: "", transportSig: "", transportNonce: "" },
    };
  }

  /**
   * Every archived frame for one offer in one venue, unordered by time — the
   * caller is responsible for checking that every frame it needs has a
   * venueTimestampMs and for sorting by it (see replayArchivedFrames).
   */
  async framesForOffer(venue: string, offerId: string): Promise<ArchivedTclkFrame[]> {
    const result = await this.pool.query<FrameRow>(
      `SELECT ${FRAME_COLUMNS}
       FROM tclk_deal_frames
       WHERE venue = $1 AND offer_id = $2`,
      [venue, offerId],
    );
    return result.rows.map(mapFrame);
  }

  async updateState(input: {
    venue: string;
    offerId: string;
    contractId?: string | null;
    payeeDid?: string | null;
    status: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE tclk_deals SET
         contract_id = COALESCE($3, contract_id),
         payee_did = COALESCE($4, payee_did),
         status = $5,
         updated_at = now()
       WHERE venue = $1 AND offer_id = $2`,
      [input.venue, input.offerId, input.contractId ?? null, input.payeeDid ?? null, input.status],
    );
  }

  /** Scoped to the current operational venue only — a deal on a venue that isn't operational won't receive new frames, so there is nothing new for it to reconcile. */
  async listOfferIdsForReconcile(venue: string, limit = 50): Promise<string[]> {
    const bounded = Math.max(1, Math.min(limit, 100));
    const result = await this.pool.query<{ offer_id: string }>(
      `SELECT d.offer_id
       FROM tclk_deals d
       WHERE d.venue = $1
         AND (
           (d.status = 'proposed' AND EXISTS (
             SELECT 1 FROM tclk_deal_frames f
             WHERE f.venue = d.venue AND f.offer_id = d.offer_id AND f.frame_type <> 'offer'
           ))
           OR (d.status = 'accepted' AND EXISTS (
             SELECT 1 FROM tclk_deal_frames f
             WHERE f.venue = d.venue AND f.offer_id = d.offer_id AND f.frame_type IN ('lock','reveal','refund','cancel')
           ))
           OR (d.status = 'locked' AND EXISTS (
             SELECT 1 FROM tclk_deal_frames f
             WHERE f.venue = d.venue AND f.offer_id = d.offer_id AND f.frame_type IN ('reveal','refund')
           ))
         )
       ORDER BY d.updated_at DESC
       LIMIT $2`,
      [venue, bounded],
    );
    return result.rows.map((row) => row.offer_id);
  }

  /** Scoped to the current operational venue only — see listOfferIdsForReconcile. */
  async listContractsForSync(venue: string, limit = 100): Promise<string[]> {
    const result = await this.pool.query<{ contract_id: string }>(
      `SELECT contract_id
       FROM tclk_deals
       WHERE venue = $1 AND contract_id IS NOT NULL
       ORDER BY updated_at DESC
       LIMIT $2`,
      [venue, Math.max(1, Math.min(limit, 200))],
    );
    return result.rows.map((row) => row.contract_id);
  }

  /**
   * Deliberately venue-unscoped: a payer or payee's own deal history must
   * remain readable across every venue they ever used, including one that
   * is no longer the current operational venue.
   */
  async listByDid(did: string, limit = 100): Promise<ArchivedTclkDeal[]> {
    const result = await this.pool.query<DealRow>(
      `SELECT ${DEAL_COLUMNS}
       FROM tclk_deals
       WHERE payer_did = $1 OR payee_did = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [did, Math.max(1, Math.min(limit, 200))],
    );
    return result.rows.map(mapDeal);
  }

  /**
   * venue given: exact lookup, found/not_found only (a specified venue pins
   * the row exactly, so this never returns ambiguous).
   * venue omitted: 0 matches -> not_found; exactly 1 -> found (backward
   * compatible with any pre-existing deep link); 2+ -> ambiguous, listing
   * every matching venue rather than silently picking one.
   */
  async getByOfferId(offerId: string, venue?: string): Promise<GetByOfferIdResult> {
    if (venue) {
      const dealResult = await this.pool.query<DealRow>(
        `SELECT ${DEAL_COLUMNS} FROM tclk_deals WHERE venue = $1 AND offer_id = $2`,
        [venue, offerId],
      );
      const dealRow = dealResult.rows[0];
      if (!dealRow) return { status: "not_found" };
      const frames = await this.getByOfferIdFrames(venue, offerId);
      return { status: "found", deal: mapDeal(dealRow), frames };
    }

    const dealResult = await this.pool.query<DealRow>(`SELECT ${DEAL_COLUMNS} FROM tclk_deals WHERE offer_id = $1`, [offerId]);
    if (dealResult.rows.length === 0) return { status: "not_found" };
    if (dealResult.rows.length > 1) {
      return { status: "ambiguous", venues: dealResult.rows.map((row) => row.venue) };
    }
    const dealRow = dealResult.rows[0] as DealRow;
    const frames = await this.getByOfferIdFrames(dealRow.venue, offerId);
    return { status: "found", deal: mapDeal(dealRow), frames };
  }

  private async getByOfferIdFrames(venue: string, offerId: string): Promise<ArchivedTclkFrame[]> {
    const frameResult = await this.pool.query<FrameRow>(
      `SELECT ${FRAME_COLUMNS}
       FROM tclk_deal_frames
       WHERE venue = $1 AND offer_id = $2
       ORDER BY CASE WHEN room = 'tclk-offers' THEN 0 ELSE 1 END, seq ASC`,
      [venue, offerId],
    );
    return frameResult.rows.map(mapFrame);
  }
}
