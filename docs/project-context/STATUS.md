# Project Status

Last updated: 2026-09-01

## Current phase

The shared FLOP verification infrastructure is proven through internal development acceptance runs for identity plus Trials 1–4.

Accepted infrastructure path:

Identity → Challenge → DID-signed Submission → Deterministic Verification → Server-signed Receipt → Public Verification.

Accepted identity model:

Create or restore Ed25519 `did:key` → user owns portable seed → optional encrypted recovery → nonextractable active browser key → same verification protocol.

Product v1 is not complete.

The active milestone is now **Production Capability 1: Ed25519 Signature Verification** through the full user capability and certificate flow:

**ACQUIRE → PRACTICE → VERIFY → CERTIFY → USE → PROVE**

## Product rules now in force

* Every production capability PASS issues its own individual capability certificate.
* Certification starts at Capability 1. FLOP does not wait for 7/7 or 10/10.
* Every user proceeds capability by capability, one at a time.
* There is no bulk certification or credit from internal development acceptance runs.
* FLOP v1 contains seven deterministic Core capabilities and three optional LLM-backed Agentic capabilities.
* Capabilities 8–10 require explicit user opt-in to LLM usage and may create usage cost.
* Cumulative rank is separate from individual certificates.
* Initial rank thresholds: 3–4 Rookie, 5–6 Regular, 7 Core Verified, 8–9 Advanced, 10 Agentic Verified.
* FLOP-managed capability execution is contained inside FLOP in v1.
* Public proof and certificates may be viewed externally, but FLOP v1 does not expose a public arbitrary agent invocation endpoint.
* Idle agents are metadata, not permanently running services.

## Completed infrastructure

* Product, architecture, threat model, receipt, PostgreSQL and API foundations defined.
* Persistent AI workflow rules added through root `AGENTS.md`.
* Overheard remains the explicit identity ownership/portability reference.
* RFC 8785 JCS, strict base64url/base58btc, SHA-256 and Ed25519 `did:key` support implemented.
* PostgreSQL persistence implemented for agents, capabilities, trial definitions, challenges, submissions, verification runs, server public signing keys, receipts and capability records.
* Race-safe challenge issuance and one-time challenge consumption implemented.
* DID-signed submission acceptance and deterministic PASS/FAIL/UNKNOWN semantics verified.
* Atomic PASS finalization, server-signed receipt generation and public receipt verification implemented.
* Railway is backend only; Vercel hosts the browser product surface.
* Browser-created identity exposes the portable 32-byte Ed25519 seed before continuation.
* Seed Reveal, Copy and Download work and continuation is gated on saving it.
* Seed/text-file restore reproduces the same DID.
* Active browser signing keys are nonextractable WebCrypto `CryptoKey` objects persisted in IndexedDB.
* Optional encrypted backup/restore uses AES-GCM with PBKDF2-SHA256.
* Browser network-boundary tests prevent seed/private key/passphrase serialization into API requests.
* Vercel CSP/security tests enforce strict self-hosted script policy and bounded outbound API connectivity.

## Internal development acceptance completed

The following are accepted as infrastructure/protocol evidence:

* Identity ownership/connectivity acceptance
* Trial 1 Ed25519 Signature Verification development acceptance
* Trial 2 Canonical JSON + SHA256 development acceptance
* Trial 3 Technocore Canonical Message Construction development acceptance
* Trial 4 Signed Receipt Verification development acceptance

The current browser reached 4/4 during these development acceptance runs.

Important: those 4/4 results are **not production user capability certificates** because the browser acceptance harness calculated the trial answers directly.

Their signed receipts remain immutable historical protocol evidence. They are not deleted or rewritten and they do not count toward production certificate totals or rank.

## In progress

Production Capability 1: Ed25519 Signature Verification.

Required behavior:

* user explicitly acquires the capability inside FLOP
* FLOP stores the installed capability/version reference for that agent profile
* practice can run without issuing certification
* production verification creates a fresh challenge
* the installed FLOP capability runtime produces the result
* the page does not use a test-specific hidden answer shortcut
* the same capability implementation is usable in ordinary FLOP use and in verification
* browser-owned DID signs the verification submission
* existing deterministic verifier handles the result
* PASS creates an immutable server-signed receipt
* PASS creates Certificate 1 with its own public proof surface
* no LLM is involved

## Next

After Production Capability 1 acceptance, implement the same flow sequentially for:

* Capability 2 Canonical JSON + SHA256
* Capability 3 Technocore Canonical Message Construction
* Capability 4 Signed Receipt Verification
* Capability 5 Structured Data Transformation
* Capability 6 Constraint and Policy Compliance
* Capability 7 Failure Recovery and Idempotency
* Capability 8 Goal Planning & Tool Use, optional LLM
* Capability 9 Grounded Research & Synthesis, optional LLM
* Capability 10 Autonomous Multi Step Execution, optional LLM

Each PASS produces its own separate certificate.

## Known problems

* The current Vercel UI is an acceptance/product-structure shell, not the final production certificate journey.
* The current 4-trial browser buttons represent the old acceptance harness and must be replaced by the production Capability 1-first flow.
* The production capability registry/installation state and certificate object/profile surfaces are not implemented yet.
* `lib/trials/` remains trial-centric and will need a capability-runtime boundary without creating parallel evidence architecture.
* Deployed acceptance runs created bounded historical evidence records in production PostgreSQL.

## Blocked

None currently known.

## Important current state

Do not continue by adding a fifth browser auto-solver.

Do not count the existing development 4/4 as user certificates.

The next completion gate is one real Production Capability 1 flow from acquisition through individual certificate proof.
