import { decodeBase64Url } from "../crypto/base64url.js";
import { verifyEd25519DidKeySignature } from "../identity/verify-signature.js";
import type { PgTclkDealHistoryRepository } from "../db/tclk-deal-history-repository.js";
import type { TclkMcpClientLike } from "./tclk-mcp-client.js";

const encoder = new TextEncoder();
const ROOM_RE = /^(?:tclk-offers|mb-p-tclk-[0-9a-f]{16})$/;
const CONTRACT_RE = /^0x[0-9a-f]{64}$/;

export interface RawTclkMessage {
  seq: number;
  from: string;
  sig: string;
  nonce: number | string;
  text: string;
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
type ReplayResult = {
  status: string;
  contract?: string | null;
  offerId: string;
  parties?: { payer?: string | null; payee?: string | null };
};

export class TclkDealHistoryService {
  constructor(
    private readonly repository: PgTclkDealHistoryRepository,
    private readonly mcp: TclkMcpClientLike,
  ) {}

  async ingestRoom(room: string, messages: RawTclkMessage[]): Promise<number> {
    if (!ROOM_RE.test(room)) return 0;
    let archived = 0;
    const ordered = [...messages]
      .filter((message) => Number.isSafeInteger(message.seq) && message.seq >= 0)
      .sort((a, b) => a.seq - b.seq);
    for (const message of ordered) {
      try {
        const stored = await this.ingestMessage(room, message);
        if (stored) archived += 1;
      } catch {
        // Raw Technocore rooms are untrusted input. Bad or unrelated lines are ignored
        // rather than poisoning the durable history or breaking room reads.
      }
    }
    return archived;
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
    });

    const lines = await this.repository.transcriptLines(offerId);
    if (!lines.length) return true;
    const replay = await this.mcp.call<ReplayResult>("tclk_apply_transcript", { lines, nowMs: Date.now() });
    if (replay.offerId !== offerId) return true;
    await this.repository.updateState({
      offerId,
      contractId: typeof replay.contract === "string" ? replay.contract : null,
      payeeDid: typeof replay.parties?.payee === "string" ? replay.parties.payee : null,
      status: replay.status,
    });
    return true;
  }

  async listByDid(did: string) {
    if (!did.startsWith("did:key:")) return [];
    return this.repository.listByDid(did);
  }

  async getByOfferId(offerId: string) {
    if (!CONTRACT_RE.test(offerId)) return null;
    return this.repository.getByOfferId(offerId);
  }
}
