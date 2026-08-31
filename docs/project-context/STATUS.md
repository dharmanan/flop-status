# Project Status

Last updated: 2026-08-31

## Current phase

Trial 1 implementation, deployed Railway core and public verification checkpoints complete. Full Trial 1 acceptance is not complete yet.

## Completed

* Product contract defined for FLOP Capability Lab.
* Architecture contract defined.
* Threat model defined.
* Receipt specification defined.
* PostgreSQL schema defined.
* API contract v1 defined.
* Trial 1 vertical slice implementation specification defined.
* Trial 1 acceptance contract defined.
* Three deterministic trial specifications documented.
* Persistent AI workflow rules added through root `AGENTS.md`.
* Trial 1 foundational crypto and data contract layer implemented.
* RFC 8785 JCS wrapper, strict base64url/base58btc helpers and project SHA-256 representation implemented.
* Ed25519 `did:key` parsing and exact-byte signature verification implemented.
* Strict Trial 1 challenge, result and signed submission schemas implemented.
* Trial 1 challenge generator implemented with separate public payload and hidden verifier context.
* VALID_SIGNATURE and INVALID_SIGNATURE cases implemented without malformed-input shortcuts.
* Challenge id, nonce, ten minute TTL and RFC 8785 challenge hash generation implemented.
* Trial 1 PostgreSQL foundation migration implemented for agents, capabilities, trial definitions and challenge instances.
* Race safe issuance repository/service implemented with advisory transaction locking and expire before replace behavior.
* Partial unique index added as defense in depth so PostgreSQL cannot store two ISSUED challenges for the same agent and trial.
* Real `pg` adapter implemented with one checked-out connection retained across each transaction.
* Railway runtime and migration-on-startup implemented.
* Railway PostgreSQL connection through `DATABASE_URL` verified.
* Foundation, submission and receipt migrations verified against real Railway PostgreSQL.
* Real Railway PostgreSQL concurrent issuance verification passed: exactly one concurrent issuance succeeds and one is rejected.
* Real Railway PostgreSQL one-ISSUED-challenge invariant verification passed.
* Public issuance result hidden-context leak verification passed against the real Railway-backed path.
* DID-signed submission acceptance verified against real Railway PostgreSQL.
* One-submission-per-challenge and sequential replay protection verified against real Railway PostgreSQL.
* Deterministic Trial 1 verifier PASS path verified against real Railway PostgreSQL.
* Atomic PASS finalization verified against real Railway PostgreSQL.
* Verification run persistence, exactly one PASS receipt and capability record update verified against real Railway PostgreSQL.
* Server-signed receipt signature and tamper rejection verified against real Railway PostgreSQL.
* Server private attestation key is not persisted in PostgreSQL.
* Public receipt API, public verification API and public server-key API implemented.
* Public `/verify/:receiptId` page implemented with browser-side WebCrypto Ed25519 verification material and strict CSP.
* Deployed Railway public verification smoke test passed: receipt API, verification API, server keys API, verification page and CSP all passed; receipt signature status was VALID; no private key leak was observed.
* Latest GitHub CI for the public verification checkpoint passed tests, TypeScript typecheck, build and high-severity npm audit.
* Railway `flop-status` service is online and starts successfully on the Railway-assigned port.

## In progress

* Implement the actual Trial 1 HTTP write path: challenge creation, durable challenge-state recovery and signed submission POST.
* Configure a persistent server attestation private key only through Railway secret configuration before production submission finalization is exposed.
* Complete the remaining acceptance gates: deterministic FAIL, UNKNOWN semantics, browser key custody, separate clean-browser verification, Technocore independence and clean-database rebuild.

## Known problems

* The current agent crypto implementation used by server tests is Node `node:crypto`; browser agent key custody is still unimplemented.
* `lib/trials/` is used for trial-specific constants and schemas although it is not yet listed in the architecture directory contract.
* Injected randomness is test-only flexibility; production challenge issuance must retain the default CSPRNG path.
* The deployed public verification path is verified, but the end-user HTTP write flow is not exposed yet.
* A persistent production attestation signer has not yet been wired from Railway secret configuration.
* Full Trial 1 acceptance path has not passed yet.

## Blocked

* Production signed-submission finalization should not be exposed until the Railway attestation signer secret is configured.

## Important current state

The first implementation target remains only Trial 1:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

The internal/server-side core and deployed public verification read path are working, but the real external write path and remaining acceptance gates still need to pass `docs/acceptance/trial1-acceptance.md` before Trial 1 can be called complete.
