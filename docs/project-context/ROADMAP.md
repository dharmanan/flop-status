# Roadmap

## Now

Close the product identity ownership/connectivity milestone before implementing additional trials.

Required outcome:

* Create new Ed25519 `did:key` in browser.
* Give the user direct ownership of the portable 32-byte seed at creation time with Reveal, Copy and Download.
* Require the user to save the seed before continuing.
* Restore the exact same DID from seed or the downloaded identity text file in a clean browser.
* Keep active browser signing keys nonextractable in IndexedDB.
* Keep encrypted FLOP backup/restore as an optional additional recovery path.
* Support externally controlled Ed25519 `did:key` through the same challenge/submission API without FLOP custody.
* Keep manual canonical-payload signing out of normal consumer onboarding.
* Ensure private signing/recovery material never reaches Railway, Vercel server code or PostgreSQL.

Reference: `docs/references/overheard.md`.

Acceptance: `docs/acceptance/identity-ownership-acceptance.md`.

## Next

After identity ownership/connectivity passes deployed acceptance:

* implement the remaining FLOP v1 deterministic capability trials defined in `docs/capability-program-v1.md`
* preserve the existing challenge → signed submission → deterministic verification → receipt engine for every trial
* implement CLAIM/UNTESTED product flow
* build the real IDENTIFY → CLAIM → TRIALS → RECORD product information architecture
* build the high-information public capability certificate/profile
* add proof links, per-trial receipt verification, downloadable certificate image, copy image and X sharing
* refine premium Vercel product UI and user-facing copy

## FLOP v1 completion target

Product v1 is not complete until:

* create/restore identity ownership works as specified
* seed portability works in a clean browser
* optional encrypted backup/restore works
* external signer/Agent API path works without browser custody
* all ten deterministic v1 capability trials complete through the same evidence engine
* public profile shows `N OF 10 VERIFIED`
* all ten current trials produce the distinct `FLOP VERIFIED AGENT · 10 OF 10` state
* certificate/profile has a public proof URL and independently verifiable receipts

The ten v1 trial definitions and certificate requirements live in `docs/capability-program-v1.md`.

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
