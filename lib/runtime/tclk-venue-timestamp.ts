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
