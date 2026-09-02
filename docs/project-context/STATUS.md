# Project Status

Last updated: 2026-09-02

## Current phase

The shared FLOP verification infrastructure is proven, and **all seven deterministic Core capabilities (C1–C7)** are implemented in the production capability registry, not just Capabilities 1–4.

Accepted infrastructure path:

Identity → Challenge → DID-signed Submission → Deterministic Verification → Server-signed Receipt → Public Verification.

Accepted identity model:

Create or restore Ed25519 `did:key` → user owns portable seed → optional encrypted recovery → nonextractable active browser key → same verification protocol → human-readable display name and globally unique handle, signed by the same DID, layered on top.

Beyond the capability core, three network/product primitives are also implemented:

* **Direct Mailbox** — DID-signed, replay-protected direct agent-to-agent messages, independent of rooms.
* **Agent Network Rooms** — FLOP-application rooms with signed membership and messages, independently re-verified in the browser on read.
* **TCLK Deals v1** — an alpha integration of FLOP Labs' Technocore Lock Protocol (`tclk/1`): hash-lock only, PaperRail only, no real funds, browser-owned signing key, hash-lock secret kept in browser IndexedDB only.

Product v1 is not complete: **Capabilities 8–10 (optional, LLM-backed Agentic capabilities) are not started** — no trial, verifier, or registry entry exists for them.

## Product rules now in force

* Every production capability PASS issues its own individual capability certificate.
* Certification starts at Capability 1. FLOP does not wait for 7/7 or 10/10.
* Every user proceeds capability by capability, one at a time, and the order is enforced in the backend rather than by hiding UI.
* There is no bulk certification or credit from internal development acceptance runs.
* FLOP v1 contains seven deterministic Core capabilities and three optional LLM-backed Agentic capabilities (the latter not yet implemented).
* Capabilities 8–10 require explicit user opt-in to LLM usage and may create usage cost, when they are built.
* Cumulative rank is separate from individual certificates and is derived from the active certificate count.
* Rank thresholds: 3–4 Rookie, 5–6 Regular, 7 Core Verified, 8–9 Advanced, 10 Agentic Verified.
* Messaging (Direct Mailbox, Agent Network rooms) and TCLK Deal activity never increase certificate count or rank.
* FLOP-managed capability execution is contained inside FLOP in v1.
* Public proof and certificates may be viewed externally, but FLOP v1 does not expose a public arbitrary agent invocation endpoint.
* Idle agents are metadata, not permanently running services.

## Completed infrastructure

* Product, architecture, threat model, receipt, PostgreSQL and API foundations defined (`docs/product-contract.md`, `docs/architecture.md`, `docs/threat-model.md`, `docs/receipt-spec.md`).
* Persistent AI workflow rules added through root `AGENTS.md`.
* Overheard remains the explicit identity ownership/portability reference.
* RFC 8785 JCS, strict base64url/base58btc, SHA-256 and Ed25519 `did:key` support implemented.
* PostgreSQL persistence implemented for agents, capabilities, trial definitions, challenges, submissions, verification runs, server public signing keys, receipts, capability records, agent profiles, FLOP rooms/memberships/messages, direct mailbox messages and replay-protection nonces.
* Race-safe challenge issuance and one-time challenge consumption implemented.
* DID-signed submission acceptance and deterministic PASS/FAIL/UNKNOWN semantics verified.
* Atomic PASS finalization, server-signed receipt generation and public receipt verification implemented; a repeat PASS for an already-certified agent/capability/version resolves to the existing certificate id rather than a phantom one.
* Railway is backend only; Vercel hosts the browser product surface.
* Browser-created identity exposes the portable 32-byte Ed25519 seed before continuation.
* Seed Reveal, Copy and Download work and continuation is gated on saving it.
* Seed/text-file restore reproduces the same DID and reconnects to the same signed agent profile (display name + handle) if one already exists server-side.
* Active browser signing keys are nonextractable WebCrypto `CryptoKey` objects persisted in IndexedDB.
* Optional encrypted backup/restore uses AES-GCM with PBKDF2-SHA256.
* Browser network-boundary tests prevent seed/private key/passphrase serialization into API requests (agent.js and capability modules; TCLK/Mailbox/Agent Network browser modules covered separately).
* Vercel CSP/security tests enforce strict self-hosted script policy and bounded outbound API connectivity.

## Production capability program

A single bounded registry (`lib/runtime/capability-registry.ts`) defines the production entry for each capability: ordinal, capability id/version, module id/version, production trial id, historical trial id, certificate name and prerequisite capability.

Implemented, with deterministic verifiers and covered by regression tests:

| # | Capability | Production trial id | Certificate |
| - | ---------- | ------------------- | ----------- |
| 1 | Ed25519 Signature Verification | `ed25519-signature-verification-certification` | Ed25519 Signature Verification Certificate |
| 2 | Canonical JSON + SHA256 | `canonical-json-sha256-certification` | Canonical JSON + SHA256 Certificate |
| 3 | Technocore Canonical Message | `technocore-canonical-message-certification` | Technocore Canonical Message Certificate |
| 4 | Signed Receipt Verification | `signed-receipt-verification-certification` | Signed Receipt Verification Certificate |
| 5 | Structured Data Transformation | `structured-data-transformation-certification` | Structured Data Transformation Certificate |
| 6 | Constraint & Policy Compliance | `constraint-policy-compliance-certification` | Constraint & Policy Compliance Certificate |
| 7 | Failure Recovery & Idempotency | `failure-recovery-idempotency-certification` | Failure Recovery & Idempotency Certificate |

For each of the seven, the following is implemented and locked by tests:

* acquisition is blocked in `CapabilityProductService` until the previous capability holds an ACTIVE certificate
* production certification challenge issuance is blocked unless the capability is installed for that DID
* practice, certification and normal FLOP use call one shared browser capability module, with no certification-specific solver and no hidden expected answer in the browser
* a correct result produces PASS, an immutable server-signed receipt and exactly one individual certificate
* a wrong deterministic result produces FAIL with no receipt and no certificate
* a historical trial PASS still produces a receipt but never a certificate

Verified against in-memory/mocked repositories, generated challenges and the real browser capability modules (`tests/browser/capability-modules.test.ts` executes the real browser executor against the real server verifier for every capability). This audit did not independently re-run a live deployed browser acceptance pass against production PostgreSQL/Railway for Capabilities 5–7; treat that as separate from "implemented and test-covered."

## TCLK Deals v1

Implemented as an alpha, hash-lock + PaperRail-only convention layer over the official FLOP Labs `tclk/1` protocol (see `docs/tclk-deals.md` for the full contract). Server-side proxy/adapter (`lib/runtime/tclk-router.ts`, `tclk-mcp-client.ts`, `tclk-paper-rail.ts`) has real executable test coverage; the browser-side transport re-verification (`web/tclk-deals.js`, factored into `web/tclk-transport.js`) is covered by direct unit tests for the `frame.from` trust boundary. No real value, no x402/flop-htlc/EVM/NEAR/BTC/PTLC/adaptor-signature/arbitration paths exist in this repo.

Known residual risk: the public `tclk-offers` rendezvous has no rate-limiting or reputation gate beyond the payload-size cap, so it can be flooded with valid but low-value signed offers. Tracked in `docs/threat-model.md`; not solved in this change set.

## Direct Mailbox / Agent Network Rooms

Both implemented: signed send/create/list actions, replay-protected nonces, and (for rooms) client-side re-verification of every stored message's signature before display. `lib/runtime/direct-mailbox-router.ts` now has its own executable HTTP route test (`tests/runtime/direct-mailbox-router.test.ts`), matching the coverage `communication-router.test.ts` already had for rooms.

## Verification flow UX

Capabilities 1–7 share one `VERIFICATION RUN` / `DOĞRULAMA AKIŞI` surface (`web/verification-ceremony.js` + `web/verification-flow.js`).

Its seven steps advance only when the corresponding operation actually completes: challenge response received, installed module resolved, result available, DID signature produced, submission response received, verdict known, certificate id returned. There is no timer-driven progress. UNKNOWN has its own visual state and is never rendered as FAIL. The ceremony's ambient core animation pauses itself when its shell is not on screen (capability switch, Mailbox/Agent Network/Deals, Settings, …) instead of running a permanent background render loop, and resumes on the next real lifecycle event.

## Next

* Capabilities 8–10 (Goal Planning & Tool Use / Grounded Research & Synthesis / Autonomous Multi Step Execution), all optional and LLM-gated behind explicit user opt-in. Not started.
* Extend real (non-string-match) browser test execution to `app-shell-navigation.js`, `agent-profile-ui.js`, `communication-nav.js`, `tclk-deals.js` and `mailbox-nav.js` (jsdom/happy-dom environment) — the single highest-leverage remaining test-coverage gap.
* A dedicated technical-debt pass to consolidate the duplicated `canonicalize()`/`node()`/`api()`/`identity()` helpers across `web/*.js` (not attempted in this change set — kept intentionally separate from the security/lifecycle fixes it was audited alongside).

Each future PASS produces its own separate certificate.

## Known problems

* This audit's fixes were verified with `safe-npm test`/`typecheck`/`build`/`audit`, not with a live deployed browser acceptance run — no deployment or database migration was performed as part of this change.
* Public agent profile browser UI (`agent-profile-ui.js`) and the TCLK/Mailbox/Agent Network browser modules are still only covered by source-inspection-plus-small-extracted-pure-helper tests, not full DOM execution — see `docs/project-context/DECISIONS.md` for the extraction approach taken instead of adding a jsdom dependency in this pass.
* `lib/trials/` remains trial-centric; the production boundary is expressed through the capability registry rather than a separate module tree.

## Blocked

None currently known.

## Important current state

C1–C7 are implemented, deterministic, and test-covered. Do not start on Capabilities 8–10 without an explicit product decision to enable LLM-backed Agentic capabilities and their cost/consent model.
