# Project Status

Last updated: 2026-08-31

## Current phase

Trial 1 deployed protocol acceptance is complete.

The accepted protocol milestone is:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

Product MVP is not complete. The next required work is to close the identity ownership/connectivity gap defined by `docs/product-contract.md`, `docs/project-context/DECISIONS.md`, `docs/project-context/ROADMAP.md` and `docs/references/overheard.md`.

## Completed

* Product, architecture, threat model, receipt, PostgreSQL, API and Trial 1 acceptance contracts defined.
* Persistent AI workflow rules added through root `AGENTS.md`.
* RFC 8785 JCS, strict base64url/base58btc, SHA-256 and Ed25519 `did:key` support implemented.
* Trial 1 challenge generator implemented with public payload and hidden verifier context separated.
* VALID_SIGNATURE and INVALID_SIGNATURE cases implemented without malformed-input shortcuts.
* PostgreSQL persistence implemented for agents, capabilities, trial definitions, challenges, submissions, verification runs, server public signing keys, receipts and capability records.
* Race-safe challenge issuance implemented with transaction advisory locking and a partial unique index.
* Real `pg` adapter retains one checked-out PostgreSQL connection across each transaction.
* Foundation, submission and receipt migrations verified against real Railway PostgreSQL.
* Real Railway PostgreSQL concurrent challenge issuance and one-ISSUED invariant verified.
* DID-signed submission acceptance, canonical payload/result hashes, one submission per challenge and sequential replay protection verified against real Railway PostgreSQL.
* Deterministic PASS verified against real Railway PostgreSQL.
* Atomic PASS finalization, verification-run persistence, exactly one receipt and capability-record derivation verified against real Railway PostgreSQL.
* Receipt signature validation and tamper detection verified; server private attestation key is not persisted in PostgreSQL.
* Public receipt, verification, server-key and agent-evidence JSON APIs implemented on Railway.
* Persistent Ed25519 attestation signer configured through Railway service secrets. Only derived public key metadata is persisted and published.
* Real deployed HTTP write path implemented and verified on Railway: challenge creation, durable challenge recovery, signed submission POST, deterministic PASS, receipt generation and public receipt verification.
* Deterministic FAIL and UNKNOWN semantics verified on Railway.
* Signed-field tamper rejection, DID binding, expired challenge replacement, sequential replay and concurrent submission race acceptance passed on Railway.
* Railway is backend only. Product HTML/CSS/browser JavaScript is not served by Railway.
* Vercel acceptance frontend demonstrates browser Ed25519 identity creation, nonextractable WebCrypto private key custody in IndexedDB, Trial 1 browser submission, durable evidence recovery and browser receipt verification.
* Chrome desktop, Safari desktop and Mobile Safari on iPhone Trial 1 browser matrix passed.
* Clean-browser public receipt verification passed.
* Technocore independence passed while Technocore was deliberately unreachable.
* Clean empty PostgreSQL rebuild passed without manual patching and the temporary acceptance database was verified deleted.
* Full deployed Trial 1 acceptance results are recorded in `docs/acceptance/trial1-results-2026-08-31.md`.
* Railway backend deployment: `https://flop-status-production.up.railway.app`.
* Vercel acceptance frontend deployment: `https://flop-status.vercel.app`.

## In progress

Identity ownership/connectivity milestone, before Trial 2 or final product UI:

* first-class Create DID flow
* first-class Connect existing DID flow with cryptographic proof of control
* encrypted exportable backup and restore for browser-created identities
* nonextractable active signing key in IndexedDB
* external agent/signer path through the same challenge/submission protocol
* explicit proof that FLOP never becomes custodian of user private signing/recovery material

Reference architecture: `docs/references/overheard.md`.

## Next after identity milestone

* Trial 2: Technocore Canonical Message Construction
* Trial 3: Canonical JSON + SHA256
* CLAIM/UNTESTED flow
* real IDENTIFY → CLAIM → TRIALS → RECORD information architecture
* premium Vercel product UI and user-facing copy

## Known problems

* The Vercel UI is an acceptance shell, not the final product UI or final user-facing copy.
* Current Vercel identity shell can create a browser DID and persist an active nonextractable key, but does not yet implement encrypted portable backup/restore or first-class existing-DID connection. Therefore it does not yet satisfy the full product identity contract.
* `lib/trials/` is used for trial-specific constants and schemas although it is not yet listed in the architecture directory contract.
* Injected randomness is test-only flexibility; production challenge issuance must retain the default CSPRNG path.

## Blocked

None currently known.

## Important current state

Trial 1 protocol acceptance is complete, but Product MVP is not complete.

Do not call the Product MVP complete until the active product contract is met, including create/connect DID, encrypted backup/restore, external signer/API support and all three initial deterministic trials.

Future work must preserve the accepted Trial 1 protocol invariants unless a versioned architecture/product decision explicitly changes them.
