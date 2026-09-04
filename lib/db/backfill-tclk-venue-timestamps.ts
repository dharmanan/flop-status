import { createPgPool } from "./pg-adapter.js";
import { PgTclkDealHistoryRepository } from "./tclk-deal-history-repository.js";
import { parseExportLines, matchesArchivedFrame } from "./tclk-venue-timestamp-backfill.js";
import { parseVenueTimestampMs } from "../runtime/tclk-venue-timestamp.js";
import { resolveTechnocoreUrl } from "../runtime/tclk-env.js";

interface Report {
  examined: number;
  backfilled: number;
  stillMissing: number;
  mismatches: number;
  exportFetchFailed: string[];
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const technocoreUrl = resolveTechnocoreUrl();

  const pool = createPgPool(connectionString);
  const repository = new PgTclkDealHistoryRepository(pool);
  const report: Report = { examined: 0, backfilled: 0, stillMissing: 0, mismatches: 0, exportFetchFailed: [] };

  try {
    const rows = await repository.framesMissingVenueTimestamp();
    report.examined = rows.length;

    const byRoom = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byRoom.get(row.room) ?? [];
      list.push(row);
      byRoom.set(row.room, list);
    }

    for (const [room, roomRows] of byRoom) {
      let exported;
      try {
        const response = await fetch(`${technocoreUrl}/r/${room}/export`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        exported = parseExportLines(await response.text());
      } catch (error) {
        report.exportFetchFailed.push(room);
        report.stillMissing += roomRows.length;
        process.stderr.write(`[backfill] export fetch failed for room ${room}: ${error instanceof Error ? error.message : String(error)}\n`);
        continue;
      }

      const bySeq = new Map(exported.map((record) => [record.seq, record]));
      for (const row of roomRows) {
        const candidate = bySeq.get(row.seq);
        if (!candidate) {
          report.stillMissing += 1;
          continue;
        }
        if (!matchesArchivedFrame(row, candidate)) {
          report.mismatches += 1;
          continue;
        }
        const venueTimestampMs = parseVenueTimestampMs(candidate.ts);
        if (venueTimestampMs === null) {
          report.stillMissing += 1;
          continue;
        }
        const updated = await repository.setVenueTimestampIfMissing(room, row.seq, venueTimestampMs);
        if (updated) report.backfilled += 1;
      }
    }

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`tclk venue-timestamp backfill failed: ${message}\n`);
  process.exitCode = 1;
});
