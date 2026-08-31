import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_URL = new URL("../../db/migrations/0004_trial2_canonical_json_sha256.sql", import.meta.url);
const sql = () => readFileSync(MIGRATION_URL, "utf8");

describe("migration 0004: Trial 2 definition", () => {
  it("seeds the canonical JSON capability and trial definition", () => {
    const text = sql();
    expect(text).toContain("'data.canonical-json-sha256'");
    expect(text).toContain("'canonical-json-sha256'");
    expect(text).toContain("'canonical-json-sha256-verifier'");
    expect(text).toContain("'jcs-rfc8785-v1'");
  });

  it("keeps all four version-1 deterministic case classes in the stored definition", () => {
    const text = sql();
    for (const name of ["NESTED_OBJECT", "UNICODE_KEYS", "ARRAY_MIX", "NUMERIC_EDGE"]) {
      expect(text).toContain(name);
    }
  });

  it("records the migration id transactionally", () => {
    const text = sql();
    expect(text).toContain("BEGIN;");
    expect(text).toContain("VALUES ('0004_trial2_canonical_json_sha256');");
    expect(text).toContain("COMMIT;");
  });
});
