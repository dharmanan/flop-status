import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runner = readFileSync(new URL("../../lib/db/migration-runner.ts", import.meta.url), "utf8");
const MIGRATION_URL = new URL("../../db/migrations/0012_capability6_production_certification.sql", import.meta.url);
const sql = () => readFileSync(MIGRATION_URL, "utf8");

describe("migration 0012: production Capability 6 certification", () => {
  it("seeds the browser deterministic Capability 6 module", () => {
    const text = sql();
    expect(text).toContain("INSERT INTO capability_modules");
    expect(text).toContain("constraint-policy-compliance-browser");
    expect(text).toContain("policy.constraint-compliance");
    expect(text).toContain("BROWSER_DETERMINISTIC");
    expect(text).toContain('"certificate_eligible":true');
    expect(text).toContain('"llm_required":false');
  });

  it("registers only the production certification trial, never a historical trial", () => {
    const text = sql();
    expect(text).toContain("INSERT INTO trial_definitions");
    expect(text).toContain("constraint-policy-compliance-certification");
    expect(text).toContain("constraint-policy-compliance-verifier");
    expect(text).toContain("policy.constraint-compliance");
    // Unlike migrations 0008-0010, Capability 6 never seeds a row for its
    // reserved (never-issuable) historical trial id.
    expect(text).not.toContain("'constraint-policy-compliance',");
  });

  it("declares the deterministic case class vocabulary in trial metadata", () => {
    const text = sql();
    for (const caseClass of ["COMPLIANT", "SINGLE_VIOLATION", "MULTIPLE_VIOLATIONS", "UNSUPPORTED_RULE", "INVALID_POLICY"]) {
      expect(text).toContain(caseClass);
    }
  });

  it("records its program sequence number as durable metadata, matching the 0008-0011 convention", () => {
    expect(sql()).toContain('"sequence":6');
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
    expect(sql()).toContain("0012_capability6_production_certification");
    expect(runner).toContain("0012_capability6_production_certification");
  });
});
