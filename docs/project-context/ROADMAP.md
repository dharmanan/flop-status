# Roadmap

## Now

Build Production Capability 1: Ed25519 Signature Verification through the real FLOP capability runtime and certificate flow.

Required product flow:

**ACQUIRE → PRACTICE → VERIFY → CERTIFY → USE → PROVE**

Required outcome:

* the user starts at Capability 1 regardless of any internal Trial 1–4 development acceptance history
* the user explicitly acquires Capability 1 inside FLOP
* FLOP attaches the versioned capability implementation to the agent profile
* the user can run a bounded practice task that does not create certification
* production verification issues a fresh DID-bound challenge
* the result is produced by the installed FLOP capability implementation, not by a page-specific answer shortcut
* the browser-owned DID signs the exact result submission
* the existing deterministic verifier determines PASS/FAIL/UNKNOWN
* PASS creates the normal immutable server-signed receipt
* PASS also creates the first individual public capability certificate
* the certificate has its own proof URL and independently verifiable receipt
* the capability is usable through an explicit FLOP product action after acquisition
* no public third-party agent invocation endpoint is added
* no LLM is required for Capability 1

Acceptance for this production vertical slice must be defined before declaring it complete.

## Next

Apply the same production pattern sequentially, one capability at a time:

1. Capability 2: Canonical JSON + SHA256
2. Capability 3: Technocore Canonical Message Construction
3. Capability 4: Signed Receipt Verification
4. Capability 5: Structured Data Transformation
5. Capability 6: Constraint and Policy Compliance
6. Capability 7: Failure Recovery and Idempotency
7. Capability 8: Goal Planning & Tool Use, optional LLM
8. Capability 9: Grounded Research & Synthesis, optional LLM
9. Capability 10: Autonomous Multi Step Execution, optional LLM

Each PASS issues a separate certificate.

Cumulative rank is updated independently from certificate issuance:

* 3–4 certificates: Rookie
* 5–6 certificates: Regular
* 7 certificates: Core Verified
* 8–9 certificates: Advanced
* 10 certificates: Agentic Verified

After the certificate runtime is proven across the program:

* build the complete public agent profile aggregating all individual certificates
* add certificate image download/copy/share surfaces
* refine the premium product UI and onboarding copy
* add optional official testnet integration only when its specification exists

## FLOP v1 completion target

Product v1 is not complete until:

* accepted identity ownership and portable seed recovery remain intact
* all seven deterministic Core capabilities are independently acquirable, usable, verifiable and individually certifiable
* all three optional Agentic capabilities can be enabled only with explicit LLM opt-in and can be individually certified with deterministic verdicts
* every certificate has a public proof URL and independently verifiable signed receipt
* the public profile aggregates individual certificates and cumulative rank
* FLOP-managed execution remains contained inside FLOP in v1
* idle agents do not create permanently running services

## Completed infrastructure milestones

The following are accepted development infrastructure milestones, not production user certificates:

* identity ownership/connectivity acceptance
* Trial 1 protocol acceptance
* Trial 2 protocol acceptance
* Trial 3 protocol acceptance
* Trial 4 backend/protocol acceptance and browser wiring

These acceptance runs established the shared identity, challenge, DID-signed submission, deterministic verification, receipt, persistence and public-verification engine.

Their historical receipts remain immutable protocol evidence but do not count toward production certificate totals or rank.

## Later

* optional Technocore evidence publication
* peer verified evidence class
* Deal Room seam
* official FLOP testnet integration when specification exists
* identity-bound certificate/rank representation only if supported by official testnet primitives
* FLOP-denominated execution or mint flows only when official token interfaces are known

## Not planned for current v1 core

* public arbitrary third-party invocation of FLOP-managed agents
* permanently running agent service per user
* messaging product
* inbox
* passport product
* subjective reputation score
* speculative wallet or faucet implementation before official testnet specification
* airdrop prediction
* LLM judge
* generic unrestricted orchestrator
* arbitrary user code execution
