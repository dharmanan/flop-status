import { CANONICALIZATION_ID } from "../../crypto/canonical-json.js";

export const CAPABILITY_ID = "data.structured-transformation" as const;
/**
 * There is no historical development-acceptance trial for Capability 5 — it
 * was introduced directly under the production certification model. This id
 * is reserved (distinct from the production trial, never seeded in a
 * migration, never issuable) purely to keep the registry shape identical to
 * Capabilities 1-4, which distinguish historical from production evidence.
 */
export const TRIAL_ID = "structured-data-transformation" as const;
export const PRODUCTION_TRIAL_ID = "structured-data-transformation-certification" as const;
export const TRIAL_VERSION = "1" as const;
export const VERIFIER_ID = "structured-data-transformation-verifier" as const;
export const VERIFIER_VERSION = "1" as const;
export const CHALLENGE_VERSION = "1" as const;
export const SUBMISSION_VERSION = "1" as const;
export const CAPABILITY_VERSION = "1" as const;
export const PROGRAM_VERSION = "1" as const;
export const MODULE_ID = "structured-data-transformation-browser" as const;
export const MODULE_VERSION = "1" as const;
export const CERTIFICATE_NAME = "Structured Data Transformation Certificate" as const;

export { CANONICALIZATION_ID };
