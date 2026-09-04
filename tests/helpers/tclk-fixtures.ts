import { encodeFrame, type TclkFrame } from "@flop-labs/tclk";
import type { ArchivedTclkFrame } from "../../lib/db/tclk-deal-history-repository.js";

export const DEFAULT_TEST_VENUE = "https://selfhost.example.invalid";

/** Wraps a real, encodable @flop-labs/tclk frame as an archived-history fixture. */
export function archivedFrame(input: {
  room: string;
  seq: number;
  offerId: string;
  tclkFrame: TclkFrame;
  venueTimestampMs: number | null;
  venue?: string;
  /** Defaults to a known generation (1) — pass null for an unknown-generation fixture. */
  roomGeneration?: number | null;
  transportRecordFingerprint?: string | null;
}): ArchivedTclkFrame {
  const roomGeneration = input.roomGeneration === undefined ? 1 : input.roomGeneration;
  return {
    venue: input.venue ?? DEFAULT_TEST_VENUE,
    room: input.room,
    seq: input.seq,
    offerId: input.offerId,
    frameType: input.tclkFrame.type,
    fromDid: input.tclkFrame.from,
    line: encodeFrame(input.tclkFrame),
    frame: input.tclkFrame as unknown as Record<string, unknown>,
    transportSig: "fixture-signature-not-checked-by-replay",
    transportNonce: "0",
    roomGeneration,
    transportRecordFingerprint: input.transportRecordFingerprint ?? (roomGeneration === null ? "0".repeat(64) : null),
    venueTimestampMs: input.venueTimestampMs,
  };
}

export function dealRoomFor(contractId: string): string {
  return `mb-p-tclk-${contractId.slice(2, 18)}`;
}
