import { openContract, applyFrame, tryDecodeFrame, type OfferFrame } from "@flop-labs/tclk";
import type { ArchivedTclkFrame } from "../db/tclk-deal-history-repository.js";

export interface HistoricalStep {
  index: number;
  type: string;
  ok: boolean;
  reason?: string;
}

export interface HistoricalReplayResult {
  status: string;
  contractId: string | null;
  payeeDid: string | null;
  steps: HistoricalStep[];
}

export type HistoricalReplayOutcome =
  | { complete: true; result: HistoricalReplayResult }
  | { complete: false; reason: string };

/**
 * Reconstructs one deal's TCLK state entirely locally, using the released
 * @flop-labs/tclk@0.1.0 state machine and each archived frame's own venue
 * timestamp — never the wall clock at reconstruction time, and never "offer
 * room first, deal room second". Every frame considered must carry an
 * authoritative venueTimestampMs; if even one is missing, this fails closed
 * (`complete: false`) instead of guessing an order, dropping a frame, or
 * substituting ingestion time — either could misrepresent what actually
 * happened. The caller (TclkDealHistoryService.reconcileOffer) must not
 * persist a status change when this returns `complete: false`.
 */
export function replayArchivedFrames(frames: ArchivedTclkFrame[]): HistoricalReplayOutcome {
  if (!frames.length) return { complete: false, reason: "no archived frames for this offer" };

  const missing = frames.filter((frame) => frame.venueTimestampMs === null);
  if (missing.length > 0) {
    return {
      complete: false,
      reason: `${missing.length} of ${frames.length} archived frame(s) lack an authoritative venue timestamp`,
    };
  }

  const ordered = [...frames].sort((a, b) => (a.venueTimestampMs as number) - (b.venueTimestampMs as number));
  const offerRecord = ordered.find((frame) => frame.frameType === "offer");
  if (!offerRecord) return { complete: false, reason: "no offer frame among archived records" };

  const decodedOffer = tryDecodeFrame(offerRecord.line);
  if (!decodedOffer || decodedOffer.type !== "offer") {
    return { complete: false, reason: "the archived offer frame did not decode as a valid tclk/1 offer" };
  }

  let state;
  try {
    state = openContract(decodedOffer as OfferFrame);
  } catch (error) {
    return { complete: false, reason: `openContract rejected the archived offer: ${error instanceof Error ? error.message : String(error)}` };
  }

  const steps: HistoricalStep[] = [{ index: 0, type: "offer", ok: true }];
  let index = 1;
  for (const record of ordered) {
    if (record === offerRecord) continue;
    const decoded = tryDecodeFrame(record.line);
    if (!decoded) {
      steps.push({ index, type: record.frameType, ok: false, reason: "did not decode as a valid tclk/1 frame" });
      index += 1;
      continue;
    }
    // Each frame is evaluated at its own recorded moment, in the order those
    // moments actually happened — this is the whole fix. A rejected frame
    // leaves `state` exactly as applyFrame received it (documented, fail-closed
    // guard behavior), so reassigning unconditionally is safe either way.
    const step = applyFrame(state, decoded, record.venueTimestampMs as number);
    state = step.state;
    steps.push({ index, type: decoded.type, ok: step.ok, reason: step.reason });
    index += 1;
  }

  return {
    complete: true,
    result: {
      status: state.status,
      contractId: state.contract ?? null,
      payeeDid: state.payeeDid ?? null,
      steps,
    },
  };
}
