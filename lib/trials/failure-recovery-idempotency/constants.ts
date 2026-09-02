import { CANONICALIZATION_ID } from "../../crypto/canonical-json.js";

export const CAPABILITY_ID = "runtime.failure-recovery-idempotency" as const;
/**
 * There is no historical development-acceptance trial for Capability 7 — it
 * was introduced directly under the production certification model, same as
 * Capabilities 5 and 6. This id is reserved (distinct from the production
 * trial, never seeded in a migration, never issuable) purely to keep the
 * registry shape identical to Capabilities 1-6.
 */
export const TRIAL_ID = "failure-recovery-idempotency" as const;
export const PRODUCTION_TRIAL_ID = "failure-recovery-idempotency-certification" as const;
export const TRIAL_VERSION = "1" as const;
export const VERIFIER_ID = "failure-recovery-idempotency-verifier" as const;
export const VERIFIER_VERSION = "1" as const;
export const CHALLENGE_VERSION = "1" as const;
export const SUBMISSION_VERSION = "1" as const;
export const CAPABILITY_VERSION = "1" as const;
export const PROGRAM_VERSION = "1" as const;
export const MODULE_ID = "failure-recovery-idempotency-browser" as const;
export const MODULE_VERSION = "1" as const;
export const CERTIFICATE_NAME = "Failure Recovery & Idempotency Certificate" as const;

export { CANONICALIZATION_ID };
