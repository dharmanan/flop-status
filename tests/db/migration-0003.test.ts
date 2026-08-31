import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const URL = new URL("../../db/migrations/0003_trial1_receipts.sql", import.meta.url);
const sql = () => readFileSync(URL, "utf8");

describe("migration 0003: receipt persistence", () => {
  it("stores server public metadata but has no private key column", () => {
    const text = sql().toLowerCase();
    expect(text).toContain("create table server_signing_keys");
    expect(text).toContain("public_key text not null");
    expect(text).not.toMatch(/private_key\s/);
  });

  it("allows exactly one receipt per challenge and one receipt per verification run", () => {
    const text = sql();
    expect(text).toMatch(/challenge_id uuid NOT NULL UNIQUE REFERENCES challenge_instances\(id\)/);
    expect(text).toMatch(/verification_run_id uuid NOT NULL UNIQUE REFERENCES verification_runs\(id\)/);
  });

  it("constrains stored public receipt evidence to PASS deterministic verification", () => {
    const text = sql();
    expect(text).toContain("CHECK (verdict = 'PASS')");
    expect(text).toContain("CHECK (evidence_type = 'DETERMINISTICALLY_VERIFIED')");
  });
});
