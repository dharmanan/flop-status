import { CANONICALIZATION_ID } from "../../crypto/canonical-json.js";

export const CAPABILITY_ID = "cryptography.signature-verification" as const;
export const TRIAL_ID = "ed25519-signature-verification" as const;
export const PRODUCTION_TRIAL_ID = "ed25519-signature-verification-certification" as const;
export const TRIAL_VERSION = "1" as const;
export const VERIFIER_ID = "ed25519-signature-verifier" as const;
export const VERIFIER_VERSION = "1" as const;
export const CHALLENGE_VERSION = "1" as const;
export const SUBMISSION_VERSION = "1" as const;
export const CAPABILITY_VERSION = "1" as const;
export const PROGRAM_VERSION = "1" as const;
export const MODULE_ID = "ed25519-signature-verification-browser" as const;
export const MODULE_VERSION = "1" as const;
export const CERTIFICATE_NAME = "Ed25519 Signature Verification Certificate" as const;

export { CANONICALIZATION_ID };
