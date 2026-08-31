# Project Status

Last updated: 2026-08-31

## Current phase

Trial 1 deployed acceptance is complete.

The accepted milestone is:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

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
* Gate M refresh persistence passed in Chrome desktop.
* Gate N separate clean browser passed in a fresh Chrome Incognito context with no agent private key/local state.
* Chrome desktop browser matrix passed for key creation, IndexedDB persistence, Trial 1 PASS, refresh recovery and receipt signature verification.
* Safari desktop browser matrix passed for key creation, nonextractable key custody, IndexedDB persistence, Trial 1 PASS, refresh recovery and receipt signature verification.
* Mobile Safari on iPhone browser matrix passed for key creation, nonextractable key custody, IndexedDB persistence, Trial 1 PASS, refresh recovery and receipt signature verification.
* No browser-specific custody fallback was required in the tested milestone matrix.
* Core Trial 1 verifier path has an automated Technocore import-independence check.
* Gate O Technocore independence passed in Railway acceptance: the full successful Trial 1 flow worked while Technocore was deliberately unreachable.
* Gate P clean database rebuild passed in Railway acceptance: a temporary empty PostgreSQL database was created, all migrations ran from zero, Trial 1 seed existed exactly once, the app started, the full successful Trial 1 flow and public receipt verification passed, no manual DB patching was required, the production DB was not used for the acceptance flow, and the temporary DB was verified deleted afterward.
* Current CI passes tests, TypeScript typecheck, build and high-severity npm audit.
* Full deployed acceptance results are recorded in `docs/acceptance/trial1-results-2026-08-31.md`.
* Railway backend deployment: `https://flop-status-production.up.railway.app`.
* Vercel frontend deployment: `https://flop-status.vercel.app`.

## In progress

* Product UI, information architecture, branding and user-facing copy for the Vercel frontend.
* Planning the next milestone must not change Trial 1 protocol semantics without an explicit versioned decision.

## Known problems

* The Vercel UI is an acceptance shell, not the final product UI or final user-facing copy.
* `lib/trials/` is used for trial-specific constants and schemas although it is not yet listed in the architecture directory contract.
* Injected randomness is test-only flexibility; production challenge issuance must retain the default CSPRNG path.

## Blocked

None currently known.

## Important current state

Trial 1 is complete for the deployed milestone defined by `docs/acceptance/trial1-acceptance.md`.

All Gates A through P and the required milestone browser matrix have passed with deployed evidence.

Future work must preserve these accepted invariants unless a versioned architecture/product decision explicitly changes them.
