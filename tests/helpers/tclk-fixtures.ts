import { encodeFrame, type TclkFrame } from "@flop-labs/tclk";
import type { ArchivedTclkFrame } from "../../lib/db/tclk-deal-history-repository.js";

/** Wraps a real, encodable @flop-labs/tclk frame as an archived-history fixture. */
export function archivedFrame(input: {
  room: string;
  seq: number;
  offerId: string;
  tclkFrame: TclkFrame;
  venueTimestampMs: number | null;
}): ArchivedTclkFrame {
  return {
    room: input.room,
    seq: input.seq,
    offerId: input.offerId,
    frameType: input.tclkFrame.type,
    fromDid: input.tclkFrame.from,
    line: encodeFrame(input.tclkFrame),
    frame: input.tclkFrame as unknown as Record<string, unknown>,
    transportSig: "fixture-signature-not-checked-by-replay",
    transportNonce: "0",
    venueTimestampMs: input.venueTimestampMs,
  };
}

export function dealRoomFor(contractId: string): string {
  return `mb-p-tclk-${contractId.slice(2, 18)}`;
}
