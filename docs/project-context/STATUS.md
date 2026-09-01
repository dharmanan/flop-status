# Project Status

Last updated: 2026-09-01

## Current phase

FLOP identity ownership, shared deterministic verification infrastructure and Production Capability 1 are accepted.

Accepted production user path:

**ACQUIRE → PRACTICE → VERIFY → CERTIFY → USE → PROVE**

The active milestone is now **Production Capability 2: Canonical JSON + SHA256**.

## Product rules in force

* Every production capability PASS issues its own individual capability certificate.
* Certification proceeds one capability at a time from Capability 1 onward.
* A later capability cannot bypass required earlier certificate prerequisites.
* Internal Trial 1–4 development acceptance receipts are historical protocol evidence only and never count as production certificates or rank.
* FLOP v1 contains seven deterministic Core capabilities and three optional LLM-backed Agentic capabilities.
* Capabilities 8–10 require explicit LLM opt-in and may create usage cost.
* Cumulative rank is separate from individual certificates.
* Initial rank thresholds: 3–4 Rookie, 5–6 Regular, 7 Core Verified, 8–9 Advanced, 10 Agentic Verified.
* FLOP-managed capability execution remains contained inside FLOP in v1.
* Public identity, receipts and certificates are portable/verifiable; arbitrary third-party agent invocation is not exposed.
* Idle agents are metadata, not permanently running services.

## Completed infrastructure

* Ed25519 `did:key` identity creation and seed restore.
* User-owned portable seed and optional encrypted recovery.
* Nonextractable active browser private key in IndexedDB.
* Seed/private key network-boundary tests.
* PostgreSQL durable state for challenge/submission/verification/receipt/capability evidence.
* One-time DID-bound challenges and deterministic PASS/FAIL/UNKNOWN semantics.
* Server-signed receipts and independent public receipt verification.
* Production capability registry, installation state and explicit capability certificate records.
* Public certificate proof route.
* Railway backend / Vercel frontend boundary.

## Internal development acceptance completed

The following remain accepted as infrastructure/protocol evidence:

* Identity ownership/connectivity
* Trial 1 Ed25519 Signature Verification
* Trial 2 Canonical JSON + SHA256
* Trial 3 Technocore Canonical Message Construction
* Trial 4 Signed Receipt Verification

The historical browser 4/4 is not production user certification. Those receipts remain immutable but do not count toward certificates or rank.

## Production Capability 1 completed

Capability: `cryptography.signature-verification`

Production trial: `ed25519-signature-verification-certification@1`

Verified behavior:

* explicit acquisition required
* practice uses the installed versioned capability module
* production challenge is fresh and DID-bound
* same module implementation is used by Practice, Verify and Use
* deterministic verifier independently checks the result
* wrong result FAILS without certificate
* PASS creates server-signed receipt and individual Certificate 1
* historical Trial 1 evidence does not count as Certificate 1
* public certificate proof and receipt verification work
* reload restores installation/certificate state
* TR/EN product explanation is user-readable with technical proof details optional

## In progress

Production Capability 2: `data.canonical-json-sha256`.

Required behavior:

* Capability 1 ACTIVE certificate is required before Capability 2 acquisition
* prerequisite is enforced server-side, not only by UI
* production trial id is distinct from historical Trial 2
* user explicitly acquires the versioned Canonical JSON + SHA256 module
* practice is optional and does not certify
* fresh challenge contains a JSON document but not the expected answer
* same module is used by Practice, Verify and Use
* module produces RFC 8785/JCS canonical JSON and SHA256 of its UTF-8 bytes
* browser-owned DID signs the submission
* backend verifier independently recomputes both values
* wrong answer FAILS with no certificate
* PASS creates the second individual certificate and signed receipt
* historical Trial 2 evidence remains excluded from production certificate totals
* no LLM is involved

Acceptance contract: `docs/acceptance/capability2-production-acceptance.md`

## Next

After Capability 2 acceptance:

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

* Capability 2 must still pass deployed Railway/browser acceptance before it is called complete.
* Capability 3–10 do not yet have production acquisition/certificate runtime slices.
* The public profile that aggregates all certificates and cumulative rank is not yet complete.
* The product visual system is still functional/structural rather than final premium presentation.

## Blocked

None currently known.

## Current completion gate

Do not start Capability 3 until Capability 2 passes:

1. sequential prerequisite enforcement
2. acquire/practice/use
3. fresh production verification
4. wrong-answer FAIL/no certificate
5. correct PASS/Certificate 2
6. public proof and independent receipt verification
7. two-certificate durable reload state
8. browser TR/EN acceptance
