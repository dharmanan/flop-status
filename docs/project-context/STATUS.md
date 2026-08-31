# Project Status

Last updated: 2026-08-31

## Current phase

Trial 1 deployed acceptance is in its final browser-matrix stage. Server-side acceptance, Technocore independence, clean-database rebuild, Chrome desktop refresh persistence and separate clean-browser receipt verification have passed. Full Trial 1 acceptance is not complete yet because the remaining Safari browser matrix still needs explicit deployed evidence.

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
* Real Railway write-path test confirmed the persistent Railway signer was used and the private key did not leak into public responses.
* Deterministic FAIL acceptance verified on Railway: valid DID-signed but incorrect result produced a persisted FAIL verification run and challenge FAIL, with no receipt and no capability increment.
* UNKNOWN acceptance verified on Railway with a controlled finalization fault: UNKNOWN persisted separately, was never labeled FAIL, created no receipt/capability increment and retained the accepted submission.
* Signed-field tamper rejection, DID binding, expired challenge replacement and concurrent submission race acceptance passed on Railway.
* Concurrent submission race verified exactly one accepted submission and exactly one receipt.
* Railway is backend only. Product HTML/CSS/browser JavaScript is not served by Railway.
* Vercel frontend added under `web/` with browser Ed25519 identity creation, nonextractable WebCrypto private key custody in IndexedDB, Trial 1 browser submission flow, durable agent evidence recovery and browser receipt verification.
* Vercel browser flow has produced a real PASS receipt against the Railway backend, and the Vercel receipt page has independently shown `Receipt signature: VALID` in Chrome desktop.
* Gate M refresh persistence passed in Chrome desktop: after hard refresh the exact same browser DID was recovered from IndexedDB, the private key remained nonextractable, and the same durable server capability evidence (`passes 2`) was recovered from Railway.
* Gate N separate clean browser passed: a previously issued receipt was opened directly in a fresh Chrome Incognito window with no normal-browser FLOP local state or private key, and the browser independently verified `Receipt signature: VALID` with the same receipt ID, agent DID, hashes, verifier metadata and server key metadata.
* Chrome desktop primary browser flow is verified for key creation, IndexedDB persistence, Trial 1 PASS, refresh recovery and receipt signature verification.
* Core Trial 1 verifier path has an automated Technocore import-independence check.
* Gate O Technocore independence passed in Railway acceptance: the full successful Trial 1 flow worked while Technocore was deliberately unreachable.
* Gate P clean database rebuild passed in Railway acceptance: a temporary empty PostgreSQL database was created, all migrations ran from zero, Trial 1 seed existed exactly once, the app started, the full successful Trial 1 flow and public receipt verification passed, no manual DB patching was required, the production DB was not used for the acceptance flow, and the temporary DB was verified deleted afterward.
* Current CI passes tests, TypeScript typecheck, build and high-severity npm audit.
* Railway backend deployment: `https://flop-status-production.up.railway.app`.
* Vercel frontend deployment: `https://flop-status.vercel.app`.

## In progress

* Browser matrix: Chrome desktop is passed. Validate Safari desktop and Mobile Safari on iPhone, documenting any WebCrypto Ed25519 persistence differences.

## Known problems

* The Vercel UI is an acceptance shell, not the final product UI or final user-facing copy.
* `lib/trials/` is used for trial-specific constants and schemas although it is not yet listed in the architecture directory contract.
* Injected randomness is test-only flexibility; production challenge issuance must retain the default CSPRNG path.
* Full Trial 1 acceptance has not passed yet because the remaining Safari browser matrix still needs explicit deployed evidence.

## Blocked

None currently known.

## Important current state

The implementation target remains only Trial 1:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

The deployed backend and Vercel Chrome desktop browser flow are working, including PASS, FAIL, UNKNOWN, tamper rejection, DID binding, expiry, replay/race protection, refresh persistence, clean-browser receipt verification, Technocore independence and clean-database rebuild. Do not declare Trial 1 complete until the remaining required Safari browser matrix in `docs/acceptance/trial1-acceptance.md` has passed in the deployed acceptance environment.
