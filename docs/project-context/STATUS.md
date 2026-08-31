# Project Status

Last updated: 2026-08-31

## Current phase

Trial 1 deployed Railway acceptance. The successful write/read core, deterministic PASS, deterministic FAIL and UNKNOWN semantics are verified. Full Trial 1 acceptance is not complete yet.

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
* Public receipt, verification and server-key APIs implemented.
* Public `/verify/:receiptId` page implemented with browser WebCrypto Ed25519 verification material and strict CSP.
* Deployed Railway public verification smoke test passed with valid receipt signature and no private-key leak.
* Persistent Ed25519 attestation signer configured through Railway service secrets. Only derived public key metadata is persisted and published.
* Real deployed HTTP write path implemented and verified on Railway: challenge creation, durable challenge recovery, signed submission POST, deterministic PASS, receipt generation and public receipt verification.
* Real Railway write-path test confirmed the persistent Railway signer was used and the private key did not leak into public responses.
* Deterministic FAIL acceptance verified on Railway: valid DID-signed but incorrect result produced a persisted FAIL verification run and challenge FAIL, with no receipt and no capability increment.
* UNKNOWN acceptance verified on Railway with a controlled finalization fault: UNKNOWN persisted separately, was never labeled FAIL, created no receipt/capability increment and retained the accepted submission.
* Current CI passes tests, TypeScript typecheck, build and high-severity npm audit.
* Public deployment: `https://flop-status-production.up.railway.app`.

## In progress

* Close remaining deployed acceptance gates for signed-field tamper rejection, DID binding, expired challenge replacement and concurrent submission race.
* Implement browser agent key custody with nonextractable WebCrypto key material and IndexedDB persistence.
* Run refresh persistence and separate clean-browser acceptance.
* Verify Technocore independence explicitly in the deployed acceptance environment.
* Run a clean-database rebuild acceptance against an empty PostgreSQL database.

## Known problems

* Browser agent key custody is still unimplemented; current agent test identities use Node `node:crypto`.
* `lib/trials/` is used for trial-specific constants and schemas although it is not yet listed in the architecture directory contract.
* Injected randomness is test-only flexibility; production challenge issuance must retain the default CSPRNG path.
* Full Trial 1 acceptance has not passed yet.

## Blocked

None currently known.

## Important current state

The implementation target remains only Trial 1:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

The deployed server-side core and public read/write surfaces are working, including PASS, FAIL and UNKNOWN semantics. Do not declare Trial 1 complete until every required gate in `docs/acceptance/trial1-acceptance.md` has passed in the deployed acceptance environment.
