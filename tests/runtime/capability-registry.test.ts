import { describe, expect, it } from "vitest";
import {
  findProductionCapability,
  findProductionCapabilityByTrialId,
  isProductionTrialId,
  PRODUCTION_CAPABILITIES,
} from "../../lib/runtime/capability-registry.js";

describe("production capability registry", () => {
  it("defines Capabilities 1-7 in order and starts no work on Capability 8+", () => {
    expect(PRODUCTION_CAPABILITIES.map((capability) => capability.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("chains prerequisites so each capability requires the previous certificate", () => {
    expect(PRODUCTION_CAPABILITIES[0]?.prerequisiteCapabilityId).toBeNull();
    for (let index = 1; index < PRODUCTION_CAPABILITIES.length; index += 1) {
      expect(PRODUCTION_CAPABILITIES[index]?.prerequisiteCapabilityId).toBe(
        PRODUCTION_CAPABILITIES[index - 1]?.capabilityId,
      );
    }
  });

  it("keeps capability ids, module ids and certificate names unique", () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(PRODUCTION_CAPABILITIES.map((item) => item.capabilityId))).toBe(true);
    expect(unique(PRODUCTION_CAPABILITIES.map((item) => item.moduleId))).toBe(true);
    expect(unique(PRODUCTION_CAPABILITIES.map((item) => item.certificateName))).toBe(true);
    expect(unique(PRODUCTION_CAPABILITIES.map((item) => item.productionTrialId))).toBe(true);
  });

  it("names the documented certificates", () => {
    expect(PRODUCTION_CAPABILITIES.map((item) => item.certificateName)).toEqual([
      "Ed25519 Signature Verification Certificate",
      "Canonical JSON + SHA256 Certificate",
      "Technocore Canonical Message Certificate",
      "Signed Receipt Verification Certificate",
      "Structured Data Transformation Certificate",
      "Constraint & Policy Compliance Certificate",
      "Failure Recovery & Idempotency Certificate",
    ]);
  });

  it("treats historical trial ids as non-production", () => {
    for (const capability of PRODUCTION_CAPABILITIES) {
      expect(isProductionTrialId(capability.historicalTrialId)).toBe(false);
      expect(isProductionTrialId(capability.productionTrialId)).toBe(true);
      expect(findProductionCapabilityByTrialId(capability.historicalTrialId)).toBeNull();
      expect(findProductionCapabilityByTrialId(capability.productionTrialId)?.ordinal).toBe(capability.ordinal);
    }
  });

  it("looks capabilities up by id", () => {
    expect(findProductionCapability("data.canonical-json-sha256")?.ordinal).toBe(2);
    expect(findProductionCapability("data.structured-transformation")?.ordinal).toBe(5);
    expect(findProductionCapability("policy.constraint-compliance")?.ordinal).toBe(6);
    expect(findProductionCapability("runtime.failure-recovery-idempotency")?.ordinal).toBe(7);
    expect(findProductionCapability("capability.does-not-exist")).toBeNull();
  });
});
