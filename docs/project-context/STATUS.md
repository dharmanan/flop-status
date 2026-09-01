# Project Status

Last updated: 2026-09-01

## Current phase

The shared FLOP verification infrastructure is proven, and the production capability journey now runs for **Capabilities 1 through 4**.

Accepted infrastructure path:

Identity → Challenge → DID-signed Submission → Deterministic Verification → Server-signed Receipt → Public Verification.

Accepted identity model:

Create or restore Ed25519 `did:key` → user owns portable seed → optional encrypted recovery → nonextractable active browser key → same verification protocol.

Product v1 is not complete. Capabilities 5–10 are not started.

## Product rules now in force

* Every production capability PASS issues its own individual capability certificate.
* Certification starts at Capability 1. FLOP does not wait for 7/7 or 10/10.
* Every user proceeds capability by capability, one at a time, and the order is enforced in the backend rather than by hiding UI.
* There is no bulk certification or credit from internal development acceptance runs.
* FLOP v1 contains seven deterministic Core capabilities and three optional LLM-backed Agentic capabilities.
* Capabilities 8–10 require explicit user opt-in to LLM usage and may create usage cost.
* Cumulative rank is separate from individual certificates and is derived from the active certificate count.
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

## Production capability program

A single bounded registry (`lib/runtime/capability-registry.ts`) defines the production entry for each capability: ordinal, capability id/version, module id/version, production trial id, historical trial id, certificate name and prerequisite capability.

Implemented and covered by regression tests:

| # | Capability | Production trial id | Certificate |
| - | ---------- | ------------------- | ----------- |
| 1 | Ed25519 Signature Verification | `ed25519-signature-verification-certification` | Ed25519 Signature Verification Certificate |
| 2 | Canonical JSON + SHA256 | `canonical-json-sha256-certification` | Canonical JSON + SHA256 Certificate |
| 3 | Technocore Canonical Message | `technocore-canonical-message-certification` | Technocore Canonical Message Certificate |
| 4 | Signed Receipt Verification | `signed-receipt-verification-certification` | Signed Receipt Verification Certificate |

For each of the four, the following is implemented and locked by tests:

* acquisition is blocked in `CapabilityProductService` until the previous capability holds an ACTIVE certificate
* production certification challenge issuance is blocked unless the capability is installed for that DID
* practice, certification and normal FLOP use call one shared browser capability module, with no certification-specific solver and no hidden expected answer in the browser
* a correct result produces PASS, an immutable server-signed receipt and exactly one individual certificate
* a wrong deterministic result produces FAIL with no receipt and no certificate
* a historical trial PASS still produces a receipt but never a certificate

Verified only against in-memory repositories, generated challenges and the real browser capability modules. Migrations 0008–0010 have not been applied to a live PostgreSQL instance in this change set, and no deployed browser acceptance run has been performed for Capabilities 2–4.

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

## Verification flow UX

Capabilities 1–4 share one `VERIFICATION RUN` / `DOĞRULAMA AKIŞI` surface (`web/verification-flow.js`).

Its seven steps advance only when the corresponding operation actually completes: challenge response received, installed module resolved, result available, DID signature produced, submission response received, verdict known, certificate id returned. There is no timer-driven progress. UNKNOWN has its own visual state and is never rendered as FAIL.

## Next

Apply the same production pattern sequentially to:

* Capability 5 Structured Data Transformation
* Capability 6 Constraint and Policy Compliance
* Capability 7 Failure Recovery and Idempotency
* Capability 8 Goal Planning & Tool Use, optional LLM
* Capability 9 Grounded Research & Synthesis, optional LLM
* Capability 10 Autonomous Multi Step Execution, optional LLM

Each PASS produces its own separate certificate.

## Known problems

* Migrations 0008–0010 are written and unit-tested but not yet applied to the live database.
* No deployed browser acceptance run exists yet for production Capabilities 2, 3 and 4.
* The public agent profile aggregating all certificates and the certificate image/share surfaces are still not implemented.
* `lib/trials/` remains trial-centric; the production boundary is expressed through the capability registry rather than a separate module tree.
* Deployed acceptance runs created bounded historical evidence records in production PostgreSQL.

## Blocked

None currently known.

## Important current state

Do not count the existing development 4/4 as user certificates.

Do not start Capability 5 or later until Capabilities 2–4 pass a deployed browser acceptance run.
