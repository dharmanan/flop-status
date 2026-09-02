import { CANONICALIZATION_ID } from "../../crypto/canonical-json.js";

export const CAPABILITY_ID = "policy.constraint-compliance" as const;
/**
 * There is no historical development-acceptance trial for Capability 6 — it
 * was introduced directly under the production certification model, same as
 * Capability 5. This id is reserved (distinct from the production trial,
 * never seeded in a migration, never issuable) purely to keep the registry
 * shape identical to Capabilities 1-5.
 */
export const TRIAL_ID = "constraint-policy-compliance" as const;
export const PRODUCTION_TRIAL_ID = "constraint-policy-compliance-certification" as const;
export const TRIAL_VERSION = "1" as const;
export const VERIFIER_ID = "constraint-policy-compliance-verifier" as const;
export const VERIFIER_VERSION = "1" as const;
export const CHALLENGE_VERSION = "1" as const;
export const SUBMISSION_VERSION = "1" as const;
export const CAPABILITY_VERSION = "1" as const;
export const PROGRAM_VERSION = "1" as const;
export const MODULE_ID = "constraint-policy-compliance-browser" as const;
export const MODULE_VERSION = "1" as const;
export const CERTIFICATE_NAME = "Constraint & Policy Compliance Certificate" as const;

export { CANONICALIZATION_ID };
