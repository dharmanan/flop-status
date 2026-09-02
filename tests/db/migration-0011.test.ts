import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runner = readFileSync(new URL("../../lib/db/migration-runner.ts", import.meta.url), "utf8");
const MIGRATION_URL = new URL("../../db/migrations/0011_capability5_production_certification.sql", import.meta.url);
const sql = () => readFileSync(MIGRATION_URL, "utf8");

describe("migration 0011: production Capability 5 certification", () => {
  it("seeds the browser deterministic Capability 5 module", () => {
    const text = sql();
    expect(text).toContain("INSERT INTO capability_modules");
    expect(text).toContain("structured-data-transformation-browser");
    expect(text).toContain("data.structured-transformation");
    expect(text).toContain("BROWSER_DETERMINISTIC");
    expect(text).toContain('"certificate_eligible":true');
    expect(text).toContain('"llm_required":false');
  });

  it("registers only the production certification trial, never a historical trial", () => {
    const text = sql();
    expect(text).toContain("INSERT INTO trial_definitions");
    expect(text).toContain("structured-data-transformation-certification");
    expect(text).toContain("structured-data-transformation-verifier");
    expect(text).toContain("data.structured-transformation");
    // Unlike migrations 0008-0010, Capability 5 never seeds a row for its
    // reserved (never-issuable) historical trial id.
    expect(text).not.toContain("'structured-data-transformation',");
  });

  it("declares the deterministic case class vocabulary in trial metadata", () => {
    const text = sql();
    for (const caseClass of [
      "VALID",
      "SOURCE_PATH_MISSING",
      "INVALID_TYPE_COERCION",
      "UNSUPPORTED_OPERATION",
      "TARGET_PATH_CONFLICT",
    ]) {
      expect(text).toContain(caseClass);
    }
  });

  it("records its program sequence number as durable metadata, matching the 0008-0010 convention", () => {
    expect(sql()).toContain('"sequence":5');
  });

  it("is append-only: it does not alter or delete existing definitions", () => {
    const text = sql();
    expect(text).not.toMatch(/\bDELETE\b/i);
    expect(text).not.toMatch(/\bDROP\b/i);
    expect(text).not.toMatch(/\bUPDATE\s+trial_definitions\b/i);
    expect(text).not.toMatch(/\bALTER\s+TABLE\b/i);
  });

  it("uses idempotent inserts, safe to re-run", () => {
    const text = sql();
    expect(text).toContain("ON CONFLICT (module_id, module_version) DO NOTHING");
    expect(text).toContain("ON CONFLICT (trial_id, trial_version) DO NOTHING");
  });

  it("registers its own migration id and is wired into the runner", () => {
    expect(sql()).toContain("0011_capability5_production_certification");
    expect(runner).toContain("0011_capability5_production_certification");
  });
});
