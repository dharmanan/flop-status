# Roadmap

## Now

Implement Trial 4: Signed Receipt Verification.

Required outcome:

* reuse the accepted Identity → Challenge → Signed Submission → Deterministic Verification → Receipt → Capability Record engine
* issue a deterministic FLOP-style signed receipt challenge with a bounded public-key set
* cover valid receipt, tampered receipt, key-binding mismatch and unknown-key cases deterministically
* require a strict result containing validity, selected key id when applicable, status and reason code
* verify the receipt signature over canonical unsigned receipt fields
* enforce receipt `server_key_id` binding rather than accepting a signature under an unrelated key
* preserve PASS/FAIL/UNKNOWN semantics
* preserve one-time challenge and DID-binding rules
* create the normal server-signed receipt and capability evidence on PASS
* expose Trial 4 evidence through the existing public agent/receipt APIs
* keep verification self-contained; no external network service is required
* do not create a parallel receipt or evidence architecture

Acceptance for Trial 4 must be defined before declaring it complete.

## Next

Implement the remaining FLOP v1 deterministic capability trials from `docs/capability-program-v1.md` in order:

1. Trial 5: Structured Data Transformation
2. Trial 6: Tool Selection and Function Calling
3. Trial 7: Multi-step Workflow Execution
4. Trial 8: Retrieval and Grounded Evidence
5. Trial 9: Constraint and Policy Compliance
6. Trial 10: Failure Recovery and Idempotency

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

## Completed milestones

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

Trial 2 Canonical JSON + SHA256 passed deployed acceptance on 2026-08-31.

Accepted Trial 2 behavior:

* versioned deterministic JCS/SHA256 challenge cases
* DID-signed result through the shared submission layer
* deterministic canonical JSON and digest verification
* normal server-signed receipt and durable capability record
* public receipt verification and capability aggregation
* browser-owned identity flow exposed as a second capability action

Evidence: `docs/acceptance/trial2-results-2026-08-31.md`.

Trial 3 Technocore Canonical Message Construction passed deployed and browser acceptance on 2026-08-31.

Accepted Trial 3 behavior:

* exact inspected Technocore canonical form `room|nonce|cleaned text`
* DID remains FLOP challenge binding but is not inserted into the Technocore canonical string
* deterministic text cleaning and byte-for-byte canonical comparison
* no Technocore network dependency in verifier path
* deterministic mismatch produces FAIL without receipt
* PASS produces normal server-signed receipt and durable capability evidence
* same browser-owned DID reached 3 of 3 verified across Trials 1–3

Evidence: `docs/acceptance/trial3-results-2026-08-31.md` plus deployed browser verification.

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
