import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_URL = new URL("../../db/migrations/0002_trial1_submissions.sql", import.meta.url);

function readMigration(): string {
  return readFileSync(MIGRATION_URL, "utf8");
}

describe("migration 0002: Trial 1 submissions", () => {
  it("enforces exactly one accepted submission per challenge", () => {
    const sql = readMigration();
    expect(sql).toMatch(/challenge_id\s+uuid\s+NOT NULL\s+UNIQUE\s+REFERENCES\s+challenge_instances\(id\)/i);
  });

  it("requires accepted submissions to have a valid agent signature", () => {
    const sql = readMigration();
    expect(sql).toMatch(/CHECK\s*\(agent_signature_valid\s*=\s*true\)/i);
  });

  it("stores canonical payload and result hashes alongside the immutable envelope", () => {
    const sql = readMigration();
    expect(sql).toContain("payload_hash text NOT NULL");
    expect(sql).toContain("result_hash text NOT NULL");
    expect(sql).toContain("signature_value text NOT NULL");
  });
});
