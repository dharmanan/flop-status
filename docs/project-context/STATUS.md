# Project Status

Last updated: 2026-08-30

## Current phase

Trial 1 implementation, checkpoint 1 complete.

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
* Trial 1 foundational crypto and data contract layer implemented on `feat/trial1-core`.
* RFC 8785 JCS wrapper, strict base64url/base58btc helpers and project SHA-256 representation implemented.
* Ed25519 `did:key` parsing and exact-byte signature verification implemented.
* Strict Trial 1 challenge, result and signed submission schemas implemented.
* 54 focused unit tests passed across 8 test files.
* TypeScript typecheck passed.
* TypeScript build passed.
* Checkpoint commit: `bf202873e9733637fa6d31030293106d3a2c330b`.

## In progress

* Preparing the next narrow Trial 1 slice.

## Known problems

* The current crypto implementation uses Node `node:crypto` and is server-runtime code. Browser key custody remains unimplemented and is a later concern.
* `lib/trials/` is now used for trial-specific constants and schemas although it is not yet listed in the architecture directory contract.
* Full Trial 1 runtime and acceptance path has not passed yet.

## Blocked

None currently known.

## Important current state

The first implementation target remains only Trial 1:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

Do not broaden implementation until this path passes `docs/acceptance/trial1-acceptance.md`.
