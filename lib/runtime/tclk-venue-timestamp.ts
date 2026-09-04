import { createHash } from "node:crypto";

/**
 * Parses a Technocore room message's `ts` field (an ISO-8601 string, e.g.
 * "2026-09-03T15:26:42.999601Z") into epoch milliseconds. Returns null for
 * anything that is not a string or does not parse to a finite time — callers
 * must treat null as "no authoritative venue timestamp available", never
 * substitute Date.now() or any other value for it.
 */
export function parseVenueTimestampMs(ts: unknown): number | null {
  if (typeof ts !== "string" || ts.trim() === "") return null;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * A room's generation is not always known (see resolveRoomGeneration in
 * tclk-router.ts), and without it seq alone cannot stand as a raw record's
 * durable identity: Technocore's signature covers room|nonce|text but not
 * seq or its own server-assigned ts, so a signed record can be legitimately
 * re-accepted outside Technocore's narrow replay window and reappear at a
 * different seq, or the same seq can belong to a different room epoch after
 * a reap. This hashes every raw, observable field of one record — including
 * Technocore's own exact ts string, never a locally reformatted one — so
 * that two genuinely different records (different seq, different ts, or
 * both) never collide, while the same record re-read twice always produces
 * the same fingerprint.
 */
export function computeTransportRecordFingerprint(input: {
  room: string;
  seq: number;
  ts: string;
  from: string;
  sig: string;
  nonce: number | string;
  text: string;
}): string {
  const serialized = JSON.stringify([input.room, input.seq, input.ts, input.from, input.sig, String(input.nonce), input.text]);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}
