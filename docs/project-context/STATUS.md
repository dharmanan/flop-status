# Project Status

Last updated: 2026-08-31

## Current phase

Trial 1 protocol acceptance, identity ownership/connectivity acceptance, Trial 2 acceptance and Trial 3 acceptance are complete.

Accepted core path:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

Accepted identity model:

Create or restore Ed25519 `did:key` → user owns portable seed → optional encrypted recovery → nonextractable active browser key → same capability protocol.

Product v1 is not complete. The active milestone is Trial 4: Signed Receipt Verification.

## Completed

* Product, architecture, threat model, receipt, PostgreSQL, API and Trial 1 acceptance contracts defined.
* Persistent AI workflow rules added through root `AGENTS.md`.
* User-provided references are explicitly binding until an approved deviation; Overheard is the identity ownership/portability reference.
* RFC 8785 JCS, strict base64url/base58btc, SHA-256 and Ed25519 `did:key` support implemented.
* Trial 1 Ed25519 Signature Verification is implemented and passed deployed acceptance.
* Trial 2 Canonical JSON + SHA256 is implemented and passed deployed acceptance through the shared challenge/submission/receipt engine.
* Trial 3 Technocore Canonical Message Construction is implemented and passed deployed acceptance through the same engine.
* Trial 3 follows the inspected Technocore reference exactly: `room|nonce|cleaned text`; the DID remains FLOP challenge binding and is not falsely inserted into the Technocore canonical signing string.
* Trial 3 verification is network-independent from Technocore and verifies canonical construction deterministically.
* Trial 3 deployed acceptance verified both PASS receipt issuance and a deterministic mismatch producing FAIL without a receipt.
* Browser-owned identity flow exposes Trials 1, 2 and 3 as separate capability actions for the same DID; deployed browser evidence reached `3 of 3 verified`.
* PostgreSQL persistence implemented for agents, capabilities, trial definitions, challenges, submissions, verification runs, server public signing keys, receipts and capability records.
* Race-safe challenge issuance and one-time challenge consumption implemented.
* DID-signed submission acceptance and deterministic PASS/FAIL/UNKNOWN semantics verified against Railway PostgreSQL.
* Atomic PASS finalization, receipt generation, receipt signature verification and public verification implemented.
* Railway is backend only; Vercel hosts the browser product surface.
* Chrome desktop, Safari desktop and Mobile Safari Trial 1 browser matrix passed.
* Clean-browser public receipt verification passed.
* Technocore independence passed while Technocore was deliberately unavailable.
* Browser-created identity exposes the portable 32-byte Ed25519 seed directly to the user before continuation.
* Seed Reveal, Copy and Download work and continuation is gated on saving it.
* Seed or downloaded identity text restores the exact same DID in a clean browser.
* Active browser signing keys are nonextractable WebCrypto `CryptoKey` objects persisted in IndexedDB.
* Optional encrypted backup/restore uses AES-GCM with PBKDF2-SHA256 and passed clean-browser deployed restore acceptance.
* Consumer onboarding has two primary paths: create a new identity or use an identity already owned.
* Manual canonical-payload signing controls are absent from normal consumer onboarding.
* External agent/signer support passed deployed public Railway API acceptance without FLOP browser custody.
* Wrong external signer rejection, correct signer acceptance, deterministic PASS and public receipt validation were verified in GitHub Actions run `33432048802`.
* Browser network-boundary regression tests lock API bodies to public challenge fields or signed submission envelopes; seed/private key/passphrase material is not serialized into API request bodies.
* Vercel CSP/security tests lock strict self-hosted script policy and bounded outbound API connectivity.
* Identity ownership/connectivity acceptance result: `docs/acceptance/identity-ownership-results-2026-08-31.md` — PASS.
* Trial 2 acceptance result: `docs/acceptance/trial2-results-2026-08-31.md` — PASS.
* Trial 3 acceptance result: `docs/acceptance/trial3-results-2026-08-31.md` — PASS.
* FLOP v1 capability target is ten deterministic trials defined in `docs/capability-program-v1.md`.
* Public certificate target is a high-information shareable capability credential with `N OF 10 VERIFIED`, proof links and per-trial signed receipts.
* Official FLOP testnet seam reserves an identity-bound 10-of-10 certificate NFT without inventing chain/token details before an official specification exists.
* Railway backend deployment: `https://flop-status-production.up.railway.app`.
* Vercel frontend deployment: `https://flop-status.vercel.app`.

## In progress

Trial 4: Signed Receipt Verification.

Required behavior:

* issue a deterministic evidence-verification challenge containing a FLOP-style signed receipt and a bounded public-key set
* include valid and tampered/binding-mismatch variants without exposing the hidden expected verdict directly
* require the agent to determine validity, identify the applicable signing key when possible and return a strict reason code
* verify the receipt signature over canonical receipt fields and enforce `server_key_id` binding
* reuse the accepted DID-signed submission, deterministic verification, server-signed receipt and capability-record engine
* preserve PASS/FAIL/UNKNOWN semantics and one-time challenge rules
* do not require any external network service for verification

## Next

* Trial 5 Structured Data Transformation
* Trial 6 Tool Selection and Function Calling
* Trial 7 Multi-step Workflow Execution
* Trial 8 Retrieval and Grounded Evidence
* Trial 9 Constraint and Policy Compliance
* Trial 10 Failure Recovery and Idempotency
* CLAIM/UNTESTED product flow
* real IDENTIFY → CLAIM → TRIALS → RECORD information architecture
* public capability certificate/profile and proof-link experience
* premium product UI after the protocol surfaces are stable

## Known problems

* The current Vercel UI is still an acceptance/product-structure shell, not the final premium interface.
* Trials 4 through 10 are defined at program level but not yet accepted.
* `lib/trials/` is used for trial-specific constants and schemas although it is not yet listed in the architecture directory contract.
* Deployed acceptance runs create bounded test evidence records in production PostgreSQL.

## Blocked

None currently known.

## Important current state

Identity ownership/connectivity and Trials 1 through 3 are complete. Product v1 is not complete.

Do not mark Product v1 complete until all ten deterministic trials, public proof profile/certificate and current product contract are met.

Future work must preserve accepted identity and Trial 1–3 invariants unless a versioned architecture/product decision explicitly changes them.
