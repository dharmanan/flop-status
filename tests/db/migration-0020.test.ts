import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../db/migrations/0020_tclk_venue_scoping.sql", import.meta.url), "utf8");
const runner = readFileSync(new URL("../../lib/db/migration-runner.ts", import.meta.url), "utf8");

describe("migration 0020: TCLK venue + room-generation scoping", () => {
  it("is wired into the migration runner", () => {
    expect(sql).toContain("0020_tclk_venue_scoping");
    expect(runner).toContain("0020_tclk_venue_scoping");
  });

  it("is transactional and registers itself in schema_migrations", () => {
    // A leading comment header (matching 0018/0019's own style) is expected
    // before BEGIN; this only checks the statement is present and precedes
    // the schema changes, not that it is literally the first line.
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(sql).toContain("INSERT INTO schema_migrations (id) VALUES ('0020_tclk_venue_scoping')");
  });

  it("adds venue to both tables and backfills every existing row to official Technocore, never a guess", () => {
    expect(sql).toMatch(/ALTER TABLE tclk_deals ADD COLUMN venue text/);
    expect(sql).toMatch(/ALTER TABLE tclk_deal_frames ADD COLUMN venue text/);
    expect(sql).toContain("UPDATE tclk_deals SET venue = 'https://technocore.chat'");
    expect(sql).toContain("UPDATE tclk_deal_frames SET venue = 'https://technocore.chat'");
  });

  it("adds room_generation and transport_record_fingerprint as nullable, with no backfilled value", () => {
    expect(sql).toMatch(/ADD COLUMN room_generation integer/);
    expect(sql).not.toMatch(/room_generation integer\s+not null/i);
    expect(sql).toMatch(/ADD COLUMN transport_record_fingerprint text/);
    expect(sql).not.toMatch(/UPDATE tclk_deal_frames SET[^;]*room_generation\s*=\s*\d/i);
    expect(sql).not.toMatch(/UPDATE tclk_deal_frames SET[^;]*transport_record_fingerprint\s*=/i);
  });

  it("constrains room_generation to NULL or a positive integer (0 is Technocore's 'room never existed', never a stored frame value)", () => {
    expect(sql).toMatch(/CHECK \(room_generation IS NULL OR room_generation > 0\)/);
  });

  it("constrains transport_record_fingerprint to NULL or 64 lowercase hex characters", () => {
    expect(sql).toMatch(/transport_record_fingerprint IS NULL OR transport_record_fingerprint ~ '\^\[0-9a-f\]\{64\}\$'/);
  });

  it("re-keys tclk_deals to a venue-scoped primary key and contract uniqueness", () => {
    expect(sql).toContain("ADD PRIMARY KEY (venue, offer_id)");
    expect(sql).toMatch(/ADD CONSTRAINT tclk_deals_venue_contract_id_key UNIQUE \(venue, contract_id\)/);
  });

  it("re-keys tclk_deal_frames onto a surrogate id, not a venue+room+generation+seq primary key", () => {
    expect(sql).toMatch(/ADD COLUMN id bigserial/);
    expect(sql).toMatch(/ADD PRIMARY KEY \(id\)/);
  });

  it("uses two separate partial unique indexes, never a single index or ON transport_sig", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX tclk_deal_frames_known_generation_key\s+ON tclk_deal_frames \(venue, room, room_generation, seq\)\s+WHERE room_generation IS NOT NULL/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX tclk_deal_frames_unknown_generation_key\s+ON tclk_deal_frames \(venue, transport_record_fingerprint\)\s+WHERE room_generation IS NULL AND transport_record_fingerprint IS NOT NULL/);
    expect(sql).not.toMatch(/UNIQUE[^;]*transport_sig/i);
    expect(sql).not.toMatch(/UNIQUE INDEX[^;]*\(room, seq\)/i);
  });

  it("drops the frame -> deal FK before dropping tclk_deals' old primary key (PostgreSQL dependency ordering)", () => {
    const fkDropIndex = sql.indexOf("DROP CONSTRAINT tclk_deal_frames_offer_id_fkey");
    const pkDropIndex = sql.indexOf("DROP CONSTRAINT tclk_deals_pkey");
    expect(fkDropIndex).toBeGreaterThan(-1);
    expect(pkDropIndex).toBeGreaterThan(-1);
    expect(fkDropIndex).toBeLessThan(pkDropIndex);
  });

  it("adds the new composite FK only after tclk_deals has its new primary key", () => {
    const pkAddIndex = sql.indexOf("ADD PRIMARY KEY (venue, offer_id)");
    const newFkIndex = sql.indexOf("ADD CONSTRAINT tclk_deal_frames_venue_offer_id_fkey");
    expect(pkAddIndex).toBeGreaterThan(-1);
    expect(newFkIndex).toBeGreaterThan(-1);
    expect(pkAddIndex).toBeLessThan(newFkIndex);
  });

  it("the new composite FK references (venue, offer_id) with ON DELETE CASCADE, matching the original FK's delete behavior", () => {
    expect(sql).toMatch(/FOREIGN KEY \(venue, offer_id\) REFERENCES tclk_deals\(venue, offer_id\) ON DELETE CASCADE/);
  });

  it("never uses a destructive CASCADE drop, only the FK's own ON DELETE CASCADE", () => {
    expect(sql).not.toMatch(/DROP\s+CONSTRAINT\s+\S+\s+CASCADE/i);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
  });

  it("never deletes a row", () => {
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("leaves the payer/payee history indexes untouched — deal history reads must span every venue", () => {
    expect(sql).not.toMatch(/DROP INDEX idx_tclk_deals_payer_updated/);
    expect(sql).not.toMatch(/DROP INDEX idx_tclk_deals_payee_updated/);
  });
});
