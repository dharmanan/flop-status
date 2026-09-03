import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../db/migrations/0019_tclk_deal_frame_venue_timestamp.sql", import.meta.url), "utf8");
const runner = readFileSync(new URL("../../lib/db/migration-runner.ts", import.meta.url), "utf8");

describe("migration 0019: TCLK deal frame venue timestamp", () => {
  it("adds a nullable venue timestamp column to tclk_deal_frames", () => {
    expect(sql).toContain("ALTER TABLE tclk_deal_frames");
    expect(sql).toContain("venue_timestamp_ms bigint");
    expect(sql).not.toMatch(/venue_timestamp_ms bigint\s+not null/i);
  });

  it("is append-only and wired into the migration runner", () => {
    expect(sql).not.toMatch(/\bDROP\b|\bDELETE\b/i);
    expect(sql).toContain("0019_tclk_deal_frame_venue_timestamp");
    expect(runner).toContain("0019_tclk_deal_frame_venue_timestamp");
  });
});
