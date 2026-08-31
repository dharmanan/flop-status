# Project Status

Last updated: 2026-08-31

## Current phase

Trial 1 deployed protocol acceptance is complete.

The accepted protocol milestone is:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

Product v1 is not complete. Identity ownership/connectivity is the active milestone and must pass deployed acceptance before additional trials are implemented.

## Completed

* Product, architecture, threat model, receipt, PostgreSQL, API and Trial 1 acceptance contracts defined.
* Persistent AI workflow rules added through root `AGENTS.md`.
* User-provided references are now explicitly binding until an approved deviation; Overheard is the identity ownership/portability reference.
* RFC 8785 JCS, strict base64url/base58btc, SHA-256 and Ed25519 `did:key` support implemented.
* Trial 1 challenge generator implemented with public payload and hidden verifier context separated.
* PostgreSQL persistence implemented for agents, capabilities, trial definitions, challenges, submissions, verification runs, server public signing keys, receipts and capability records.
* Race-safe challenge issuance and one-time challenge consumption implemented.
* DID-signed submission acceptance and deterministic PASS/FAIL/UNKNOWN semantics verified against Railway PostgreSQL.
* Atomic PASS finalization, receipt generation, receipt signature verification and public verification implemented.
* Railway is backend only; Vercel hosts the browser product surface.
* Chrome desktop, Safari desktop and Mobile Safari Trial 1 browser matrix passed for the original Trial 1 acceptance shell.
* Clean-browser public receipt verification passed.
* Technocore independence passed while Technocore was deliberately unavailable.
* Browser-created identity now exposes a portable 32-byte Ed25519 seed directly to the user before continuation.
* Seed can be revealed, copied or downloaded as a local identity text file.
* Identity can be reconstructed locally from the seed or downloaded text file to the exact same DID.
* Active browser signing keys are nonextractable WebCrypto `CryptoKey` objects persisted in IndexedDB.
* Optional encrypted backup/restore uses AES-GCM with PBKDF2-SHA256 and does not replace direct seed ownership.
* Consumer onboarding is now reduced to two primary paths: create a new identity or use an identity already owned.
* Optional encrypted recovery is nested under the existing-identity path.
* Manual canonical-payload signing controls and raw external-signature fields have been removed from the normal consumer onboarding surface.
* External agent/signer support remains an API/integration requirement using the same DID-bound challenge/submission verification protocol.
* Vercel CSP/security headers constrain scripts and outbound connectivity for browser key custody.
* Automated identity tests cover seed ownership, same-DID restore, nonextractable keys, optional encrypted backup, wrong-passphrase failure and unsupported DID rejection.
* Automated onboarding regression test locks the absence of manual canonical-payload signing controls from the consumer page.
* FLOP v1 capability target is now ten deterministic trials defined in `docs/capability-program-v1.md`.
* Public certificate target is a high-information shareable capability credential with `N OF 10 VERIFIED`, proof links and per-trial signed receipts.
* Official FLOP testnet seam reserves an identity-bound 10-of-10 certificate NFT without inventing chain/token details before an official specification exists.
* Railway backend deployment: `https://flop-status-production.up.railway.app`.
* Vercel frontend deployment: `https://flop-status.vercel.app`.

## In progress

Identity ownership/connectivity deployed acceptance:

* Gate IA browser-created identity + direct seed ownership + Trial 1
* Gate IB refresh persistence
* Gate IC clean-browser same-DID restore from seed/text file
* Gate ID optional encrypted backup properties and clean restore
* Gate IE external signer semantics without exposing manual signing as consumer UX
* Gate IF direct external Agent API path
* Gate IG deployed custody/CSP/no-secret-leak boundary

Acceptance source of truth: `docs/acceptance/identity-ownership-acceptance.md`.

Reference architecture: `docs/references/overheard.md`.

## Next after identity milestone

* Implement the remaining deterministic trials toward the ten-trial v1 program.
* Reuse the same challenge → signed submission → deterministic verifier → server-signed receipt engine.
* Implement CLAIM/UNTESTED flow.
* Build the real IDENTIFY → CLAIM → TRIALS → RECORD information architecture.
* Build the public capability certificate/profile and proof-link experience.
* Build the premium product UI after protocol/identity acceptance is stable.

## Known problems

* The Vercel UI is still an acceptance/product-structure shell, not the final premium product interface.
* Identity ownership/connectivity has automated coverage but the revised seed-first onboarding still needs deployed browser acceptance evidence.
* External signer/API semantics remain valid in the backend protocol, but a productized external integration surface/API guide still needs acceptance.
* Only Trial 1 is implemented; the other nine v1 deterministic trials are planned but not yet implemented.
* `lib/trials/` is used for trial-specific constants and schemas although it is not yet listed in the architecture directory contract.

## Blocked

None currently known.

## Important current state

Trial 1 protocol acceptance is complete, but identity ownership/connectivity and Product v1 are not complete.

Do not mark identity ownership/connectivity complete until `docs/acceptance/identity-ownership-acceptance.md` passes with deployed evidence.

Do not mark Product v1 complete until the active identity requirements, external Agent API path, all ten deterministic trials, public proof profile/certificate and current product contract are met.

Future work must preserve accepted Trial 1 protocol invariants unless a versioned architecture/product decision explicitly changes them.
