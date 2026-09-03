import { decodeBase64Url } from "../crypto/base64url.js";
import { verifyEd25519DidKeySignature } from "../identity/verify-signature.js";
import type { PgTclkDealHistoryRepository } from "../db/tclk-deal-history-repository.js";
import type { TclkMcpClientLike } from "./tclk-mcp-client.js";
import { parseVenueTimestampMs } from "./tclk-venue-timestamp.js";
import { replayArchivedFrames } from "./tclk-historical-replay.js";

const encoder = new TextEncoder();
const ROOM_RE = /^(?:tclk-offers|mb-p-tclk-[0-9a-f]{16})$/;
const CONTRACT_RE = /^0x[0-9a-f]{64}$/;
const MAX_UNARCHIVABLE_RECORDS = 4_096;

export interface RawTclkMessage {
  seq: number;
  from: string;
  sig: string;
  nonce: number | string;
  text: string;
  /** Technocore's own venue timestamp for this record, e.g. an ISO-8601 string. */
  ts?: unknown;
}

type TclkFrame = Record<string, unknown> & {
  type: string;
  from: string;
  id?: string;
  ref?: string;
  contract?: string;
  amount?: string;
  asset?: string;
  expiresMs?: number;
  claimByMs?: number;
  refundAfterMs?: number;
  job?: { id?: string; context?: string };
};

type DecodeResult = { ok: boolean; frame?: TclkFrame; error?: string };

export class TclkDealHistoryService {
  // Technocore's public rendezvous can contain an accept whose offer rotated
  // away before FLOP ever observed it. There is no safe transcript to archive
  // in that case. Remember the signed record for this process so every board
  // refresh does not decode it again or turn ordinary foreign traffic into an
  // application error log.
  private readonly unarchivableRecordKeys = new Set<string>();

  constructor(
    private readonly repository: PgTclkDealHistoryRepository,
    private readonly mcp: TclkMcpClientLike,
  ) {}

  private recordKey(room: string, message: RawTclkMessage): string {
    return `${room}\u0000${message.seq}\u0000${message.sig}`;
  }

  private rememberUnarchivable(key: string): void {
    if (this.unarchivableRecordKeys.size >= MAX_UNARCHIVABLE_RECORDS) {
      const oldest = this.unarchivableRecordKeys.values().next().value;
      if (oldest) this.unarchivableRecordKeys.delete(oldest);
    }
    this.unarchivableRecordKeys.add(key);
  }

  async ingestRoom(room: string, messages: RawTclkMessage[]): Promise<number> {
    if (!ROOM_RE.test(room)) return 0;
    let archived = 0;
    const ordered = [...messages]
      .filter((message) => Number.isSafeInteger(message.seq) && message.seq >= 0)
      .sort((a, b) => a.seq - b.seq);
    // Technocore only serves a short window of each room, so a sync that takes
    // seconds can miss records that rotate out mid-pass. Skipping records that
    // are already archived keeps a repeat sync down to a single query instead of
    // one MCP decode per message.
    const alreadyArchived = await this.repository.archivedSeqs(room, ordered.map((message) => message.seq));
    for (const message of ordered) {
      if (alreadyArchived.has(message.seq) || this.unarchivableRecordKeys.has(this.recordKey(room, message))) continue;
      try {
        const stored = await this.ingestMessage(room, message);
        if (stored) archived += 1;
      } catch (error) {
        // Raw Technocore rooms are untrusted input, so a bad or unrelated line must
        // not break a room read. It is still reported: a silent drop here is how a
        // completed deal can disappear from durable history with no trace.
        this.report(`ingest failed for ${room}#${message.seq}`, error);
      }
    }
    return archived;
  }

  private report(message: string, error?: unknown): void {
    const detail = error instanceof Error ? error.message : error === undefined ? "" : String(error);
    console.warn(`[tclk-history] ${message}${detail ? `: ${detail}` : ""}`);
  }

  async ingestMessage(room: string, message: RawTclkMessage): Promise<boolean> {
    if (!ROOM_RE.test(room)) return false;
    if (!Number.isSafeInteger(message.seq) || message.seq < 0) return false;
    if (typeof message.from !== "string" || typeof message.sig !== "string" || typeof message.text !== "string") return false;

    let signature: Uint8Array;
    try { signature = decodeBase64Url(message.sig); } catch { return false; }
    if (signature.length !== 64) return false;
    const canonical = encoder.encode(`${room}|${message.nonce}|${message.text}`);
    if (!verifyEd25519DidKeySignature(message.from, canonical, signature)) return false;

    const decoded = await this.mcp.call<DecodeResult>("tclk_decode", { line: message.text });
    const frame = decoded.ok ? decoded.frame : undefined;
    if (!frame || typeof frame.type !== "string" || frame.from !== message.from) return false;

    let offerId: string | null = null;
    if (frame.type === "offer") {
      if (typeof frame.id !== "string" || !CONTRACT_RE.test(frame.id)) return false;
      if (typeof frame.amount !== "string" || typeof frame.asset !== "string") return false;
      offerId = frame.id;
      await this.repository.createOffer({
        offerId,
        payerDid: frame.from,
        amount: frame.amount,
        asset: frame.asset,
        jobId: typeof frame.job?.id === "string" ? frame.job.id : null,
        jobContext: typeof frame.job?.context === "string" ? frame.job.context : null,
        offerExpiresMs: Number.isSafeInteger(frame.expiresMs) ? frame.expiresMs : null,
        claimByMs: Number.isSafeInteger(frame.claimByMs) ? frame.claimByMs : null,
        refundAfterMs: Number.isSafeInteger(frame.refundAfterMs) ? frame.refundAfterMs : null,
      });
    } else if (frame.type === "accept") {
      if (typeof frame.ref !== "string") return false;
      offerId = frame.ref;
    } else {
      const contract = typeof frame.contract === "string" ? frame.contract : null;
      if (!contract) return false;
      offerId = await this.repository.offerIdForContract(contract);
    }
    if (!offerId) return false;

    // Every frame is stored against its offer row. If the offer itself was never
    // archived — it rotated out of Technocore's window before a sync ran — then
    // this frame cannot be attached to anything, and the whole deal silently
    // disappears from history. Report it instead of letting a foreign key error
    // vanish into a catch block.
    if (frame.type !== "offer" && !(await this.repository.offerExists(offerId))) {
      this.rememberUnarchivable(this.recordKey(room, message));
      return false;
    }

    await this.repository.storeFrame({
      room,
      seq: message.seq,
      offerId,
      frameType: frame.type,
      fromDid: message.from,
      line: message.text,
      frame,
      transportSig: message.sig,
      transportNonce: String(message.nonce),
      venueTimestampMs: parseVenueTimestampMs(message.ts),
    });

    await this.reconcileOffer(offerId);
    return true;
  }

  /**
   * Historical reconciliation for the durable archive. This is deliberately not
   * the live MCP's tclk_apply_transcript({lines, nowMs: Date.now()}) — that folds
   * everything against today's clock and "offer room first, deal room second",
   * so an old accept can be re-rejected as expired and a much later cross-room
   * frame can be folded before an earlier one. Reconstructing from durable
   * history instead uses the released @flop-labs/tclk@0.1.0 state machine
   * locally, evaluating each archived frame at its own venue timestamp in true
   * chronological order. If any required frame lacks that timestamp, this fails
   * closed and leaves the currently stored status untouched (see
   * replayArchivedFrames). The live MCP call is unchanged everywhere else —
   * this only affects how the durable archive reconciles itself.
   */
  private async reconcileOffer(offerId: string): Promise<boolean> {
    const frames = await this.repository.framesForOffer(offerId);
    const outcome = replayArchivedFrames(frames);
    if (!outcome.complete) {
      this.report(`historical reconstruction incomplete for ${offerId}: ${outcome.reason}`);
      return false;
    }
    await this.repository.updateState({
      offerId,
      contractId: outcome.result.contractId,
      payeeDid: outcome.result.payeeDid,
      status: outcome.result.status,
    });
    return true;
  }

  async reconcileArchivedDeals(limit = 50): Promise<number> {
    const offerIds = await this.repository.listOfferIdsForReconcile(limit);
    let reconciled = 0;
    for (const offerId of offerIds) {
      try {
        if (await this.reconcileOffer(offerId)) reconciled += 1;
      } catch (error) {
        // Archived frames stay authoritative evidence even if the upstream state
        // machine is temporarily unavailable. A later read can reconcile again.
        this.report(`reconcile failed for ${offerId}`, error);
      }
    }
    return reconciled;
  }

  async listDealRoomsForSync(limit = 100): Promise<string[]> {
    const contracts = await this.repository.listContractsForSync(limit);
    return contracts.map((contract) => `mb-p-tclk-${contract.slice(2, 18)}`);
  }

  async listByDid(did: string) {
    if (!did.startsWith("did:key:")) return [];
    await this.reconcileArchivedDeals();
    return this.repository.listByDid(did);
  }

  /**
   * Returns the archived deal, its frames, and the SAME replayArchivedFrames()
   * result reconcileOffer() uses internally — so a caller (the browser's
   * archived-deal recovery, in particular) can adopt the durable,
   * venue-timestamp-aware historical state instead of independently folding
   * the transcript against the current wall clock. `deal` and `frames` are
   * unchanged for backward compatibility; `historicalReplay` is additive.
   */
  async getByOfferId(offerId: string) {
    if (!CONTRACT_RE.test(offerId)) return null;
    try { await this.reconcileOffer(offerId); } catch {}
    const entry = await this.repository.getByOfferId(offerId);
    if (!entry) return null;
    return { ...entry, historicalReplay: replayArchivedFrames(entry.frames) };
  }
}
