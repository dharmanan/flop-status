# Roadmap

## Now

Close the product identity gap before adding Trial 2 or redesigning the product UI.

Required outcome:

* Create new Ed25519 `did:key` in browser.
* Connect an existing supported Ed25519 `did:key` without FLOP custody.
* Prove control of an existing DID cryptographically, not by DID text alone.
* Keep active browser signing key nonextractable in IndexedDB.
* Add encrypted exportable backup and restore for browser-created identities.
* Ensure private signing/recovery material never reaches Railway, Vercel server code or PostgreSQL.
* Keep external agent/API signers on the same challenge/submission verification protocol.

Reference: `docs/references/overheard.md`.

## Next

After the identity ownership/connectivity contract passes acceptance:

* implement Trial 2: Technocore Canonical Message Construction
* implement Trial 3: Canonical JSON + SHA256
* implement CLAIM/UNTESTED product flow
* build the real IDENTIFY → CLAIM → TRIALS → RECORD product information architecture and premium Vercel UI
* refine public capability record UX and user-facing copy

## Milestone distinction

Trial 1 protocol acceptance is complete.

Product MVP is not complete until:

* create/connect DID works as specified
* encrypted backup/restore works for browser-created identities
* external signer/Agent API path is productized
* all three initial deterministic trials complete the same end-to-end verification path

## Later

* optional Technocore evidence publication
* peer verified evidence class
* Deal Room seam
* official FLOP testnet evidence when specification exists

## Not planned for MVP

* messaging product
* inbox
* passport
* reputation score
* wallet or faucet
* airdrop prediction
* LLM judge
* generic orchestrator
* generic autonomous agent runtime
* arbitrary user code execution
