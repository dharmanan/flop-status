# Project Status

Last updated: 2026-08-30

## Current phase

Trial 1 implementation, Railway PostgreSQL integration checkpoint complete.

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
* Railway runtime added with a minimal `/healthz` endpoint and migration on startup.
* Railway PostgreSQL connection through `DATABASE_URL` verified.
* Migration verified against real Railway PostgreSQL; tables present: agents, capabilities, challenge_instances, schema_migrations, trial_definitions.
* Real Railway PostgreSQL concurrent issuance verification passed: exactly one concurrent issuance succeeds and one is rejected.
* Real Railway PostgreSQL one-ISSUED-challenge invariant verification passed.
* Public issuance result hidden-context leak verification passed against the real Railway-backed path.
* Latest dependency/build verification reported 82 unit/static tests passing, TypeScript typecheck passing, build passing and npm audit with 0 vulnerabilities.
* Railway `flop-status` service is online and starts successfully on the Railway-assigned port.

## In progress

* Continue Trial 1 vertical slice after issuance: signed submission, deterministic verification, server signed receipt and public verification.

## Known problems

* The current crypto implementation uses Node `node:crypto` and is server-runtime code. Browser key custody remains unimplemented and is a later concern.
* `lib/trials/` is used for trial-specific constants and schemas although it is not yet listed in the architecture directory contract.
* Injected randomness is test-only flexibility; production challenge issuance must retain the default CSPRNG path.
* Full Trial 1 acceptance path has not passed yet.

## Blocked

None currently known.

## Important current state

The first implementation target remains only Trial 1:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

Do not broaden implementation until this path passes `docs/acceptance/trial1-acceptance.md`.
