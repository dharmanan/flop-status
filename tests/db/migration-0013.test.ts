import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runner = readFileSync(new URL("../../lib/db/migration-runner.ts", import.meta.url), "utf8");
const MIGRATION_URL = new URL("../../db/migrations/0013_capability7_production_certification.sql", import.meta.url);
const sql = () => readFileSync(MIGRATION_URL, "utf8");

describe("migration 0013: production Capability 7 certification", () => {
  it("seeds the canonical capability row before foreign-key dependent metadata", () => {
    const text = sql();
    const capabilityInsert = text.indexOf("INSERT INTO capabilities");
    const moduleInsert = text.indexOf("INSERT INTO capability_modules");
    const trialInsert = text.indexOf("INSERT INTO trial_definitions");
    expect(capabilityInsert).toBeGreaterThanOrEqual(0);
    expect(capabilityInsert).toBeLessThan(moduleInsert);
    expect(capabilityInsert).toBeLessThan(trialInsert);
    expect(text).toContain("'runtime.failure-recovery-idempotency'");
    expect(text).toContain("'Failure Recovery & Idempotency'");
  });

  it("seeds the browser deterministic Capability 7 module", () => {
    const text = sql();
    expect(text).toContain("INSERT INTO capability_modules");
    expect(text).toContain("failure-recovery-idempotency-browser");
    expect(text).toContain("runtime.failure-recovery-idempotency");
    expect(text).toContain("BROWSER_DETERMINISTIC");
    expect(text).toContain('"certificate_eligible":true');
    expect(text).toContain('"llm_required":false');
  });

  it("registers only the production certification trial, never a historical trial", () => {
    const text = sql();
    expect(text).toContain("INSERT INTO trial_definitions");
    expect(text).toContain("failure-recovery-idempotency-certification");
    expect(text).toContain("failure-recovery-idempotency-verifier");
    expect(text).toContain("runtime.failure-recovery-idempotency");
    expect(text).not.toContain("'failure-recovery-idempotency',");
  });

  it("declares the deterministic case class vocabulary in trial metadata", () => {
    const text = sql();
    for (const caseClass of ["SUCCESS_FIRST_ATTEMPT", "RECOVER_THEN_SUCCEED", "DUPLICATE_AFTER_SUCCESS", "RETRY_LIMIT_EXCEEDED", "PERMANENT_FAILURE"]) expect(text).toContain(caseClass);
  });

  it("records its program sequence number as durable metadata, matching the 0008-0012 convention", () => {
    expect(sql()).toContain('"sequence":7');
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
    expect(text).toContain("ON CONFLICT (id) DO NOTHING");
    expect(text).toContain("ON CONFLICT (module_id, module_version) DO NOTHING");
    expect(text).toContain("ON CONFLICT (trial_id, trial_version) DO NOTHING");
  });

  it("registers its own migration id and is wired into the runner", () => {
    expect(sql()).toContain("0013_capability7_production_certification");
    expect(runner).toContain("0013_capability7_production_certification");
  });
});
