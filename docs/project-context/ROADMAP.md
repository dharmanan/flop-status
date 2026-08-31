# Roadmap

## Now

Implement Trial 2: Canonical JSON + SHA256.

Required outcome:

* reuse the accepted Identity → Challenge → Signed Submission → Deterministic Verification → Receipt → Capability Record engine
* issue a versioned deterministic challenge containing structured JSON with nested objects, arrays, Unicode and numeric edge cases
* require the agent to return RFC 8785 JCS canonical output and SHA256 digest
* verify canonical bytes and digest deterministically
* preserve PASS/FAIL/UNKNOWN semantics
* preserve one-time challenge and DID-binding rules
* create the normal server-signed receipt and capability evidence on PASS
* expose Trial 2 evidence through the existing public agent/receipt APIs
* do not create a parallel verification or receipt architecture

Acceptance for Trial 2 must be defined before declaring it complete.

## Next

Implement the remaining FLOP v1 deterministic capability trials from `docs/capability-program-v1.md` in order:

1. Trial 3: Technocore Canonical Message Construction
2. Trial 4: Signed Receipt Verification
3. Trial 5: Structured Data Transformation
4. Trial 6: Tool Selection and Function Calling
5. Trial 7: Multi-step Workflow Execution
6. Trial 8: Retrieval and Grounded Evidence
7. Trial 9: Constraint and Policy Compliance
8. Trial 10: Failure Recovery and Idempotency

After the trial engine supports the broader program:

* implement CLAIM/UNTESTED product flow
* build the real IDENTIFY → CLAIM → TRIALS → RECORD product information architecture
* build the high-information public capability certificate/profile
* add proof links, per-trial receipt verification, downloadable certificate image, copy image and X sharing
* refine premium Vercel product UI and user-facing copy

## FLOP v1 completion target

Product v1 is not complete until:

* accepted identity ownership and seed portability remain intact
* external signer/Agent API path remains usable without browser custody
* all ten deterministic v1 capability trials complete through the same evidence engine
* public profile shows `N OF 10 VERIFIED`
* all ten current trials produce the distinct `FLOP VERIFIED AGENT · 10 OF 10` state
* certificate/profile has a public proof URL and independently verifiable receipts

The ten v1 trial definitions and certificate requirements live in `docs/capability-program-v1.md`.

## Completed milestone

Identity ownership/connectivity passed acceptance on 2026-08-31.

Accepted identity model:

* create a new Ed25519 `did:key`
* direct user ownership of portable 32-byte seed
* seed Reveal, Copy and Download before continuation
* same-DID clean-browser restore from seed/text file
* optional encrypted backup/restore
* nonextractable active browser key in IndexedDB
* no browser secret material sent to FLOP backend
* externally controlled Ed25519 `did:key` supported through the same public challenge/submission API
* manual canonical-payload signing excluded from normal consumer onboarding

Evidence: `docs/acceptance/identity-ownership-results-2026-08-31.md`.

## Later

* optional Technocore evidence publication
* peer verified evidence class
* Deal Room seam
* official FLOP testnet integration when specification exists
* identity-bound FLOP Capability Certificate NFT for eligible completed profiles when official testnet primitives are available
* FLOP-denominated trial/mint/re-certification flows only when official token interfaces are known

## Not planned for current v1 core

* messaging product
* inbox
* passport product
* subjective reputation score
* speculative wallet or faucet implementation before official testnet specification
* airdrop prediction
* LLM judge
* generic orchestrator
* generic autonomous agent runtime
* arbitrary user code execution
