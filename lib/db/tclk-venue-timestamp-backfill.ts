/**
 * Pure matching/parsing logic for recovering an archived TCLK frame's missing
 * venue_timestamp_ms from Technocore's authoritative `GET /r/<room>/export`.
 * Kept free of network and database access so the one rule that matters —
 * "only an exact match may populate a timestamp" — is directly unit-testable.
 */

export interface ExportedTclkRecord {
  seq: number;
  ts: string;
  from: string;
  text: string;
  nonce: number | string;
  sig: string;
}

export interface ArchivedFrameIdentity {
  seq: number;
  fromDid: string;
  line: string;
  transportSig: string;
  transportNonce: string;
}

/**
 * `/export` is newline-delimited JSON, one record per line. A line that is
 * blank, not JSON, or missing a required field is skipped rather than
 * thrown on — an export can be gigabytes long and one bad line must not
 * abort recovering everything else.
 */
export function parseExportLines(raw: string): ExportedTclkRecord[] {
  const records: ExportedTclkRecord[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    if (
      Number.isSafeInteger(record.seq)
      && typeof record.ts === "string"
      && typeof record.from === "string"
      && typeof record.text === "string"
      && typeof record.sig === "string"
      && (typeof record.nonce === "number" || typeof record.nonce === "string")
    ) {
      records.push(record as unknown as ExportedTclkRecord);
    }
  }
  return records;
}

/**
 * An exported record may only backfill an archived frame's venue timestamp
 * when every piece of signed identity matches exactly — seq alone is not
 * enough, since Technocore's retention could have reused that seq for a
 * different record by the time this runs. This mirrors exactly what
 * TclkDealHistoryService.ingestMessage already verified when the frame was
 * first archived, so a match here is not re-trusting a new signature — it is
 * confirming the export still describes the same already-verified record.
 */
export function matchesArchivedFrame(archived: ArchivedFrameIdentity, exported: ExportedTclkRecord): boolean {
  return (
    archived.seq === exported.seq
    && archived.fromDid === exported.from
    && archived.line === exported.text
    && archived.transportSig === exported.sig
    && archived.transportNonce === String(exported.nonce)
  );
}
