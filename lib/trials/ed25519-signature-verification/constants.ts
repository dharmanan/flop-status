import { CANONICALIZATION_ID } from "../../crypto/canonical-json.js";

export const CAPABILITY_ID = "cryptography.signature-verification" as const;
export const TRIAL_ID = "ed25519-signature-verification" as const;
export const TRIAL_VERSION = "1" as const;
export const VERIFIER_ID = "ed25519-signature-verifier" as const;
export const VERIFIER_VERSION = "1" as const;
export const CHALLENGE_VERSION = "1" as const;
export const SUBMISSION_VERSION = "1" as const;

export { CANONICALIZATION_ID };
