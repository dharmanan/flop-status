# Project Status

Last updated: 2026-08-30

## Current phase

Trial 1 implementation, checkpoint 2 complete.

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
* Trial 1 challenge generator implemented with separate public payload and hidden verifier context.
* VALID_SIGNATURE and INVALID_SIGNATURE cases implemented without malformed-input shortcuts.
* Challenge id, nonce, ten minute TTL and RFC 8785 challenge hash generation implemented.
* Challenge generator uses injectable clock/randomness for stable tests while production defaults remain Node CSPRNG backed.
* Challenge generator security check passed: no shell execution, filesystem access, network access, secret logging or hidden-context leakage; dependency audit reported 0 vulnerabilities.
* 68 focused unit tests passed across 9 test files after checkpoint 2.
* TypeScript typecheck passed.
* TypeScript build passed.
* Checkpoint 1 commit: `bf202873e9733637fa6d31030293106d3a2c330b`.
* Checkpoint 2 commit: `ba88fd862263b0e90a9e6f29cea23c9637f0a537`.

## In progress

* Preparing persistence and race safe challenge issuance for Trial 1.

## Known problems

* The current crypto implementation uses Node `node:crypto` and is server-runtime code. Browser key custody remains unimplemented and is a later concern.
* `lib/trials/` is now used for trial-specific constants and schemas although it is not yet listed in the architecture directory contract.
* Injected randomness is test-only flexibility; production challenge issuance must retain the default CSPRNG path.
* Full Trial 1 runtime and acceptance path has not passed yet.

## Blocked

None currently known.

## Important current state

The first implementation target remains only Trial 1:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

Do not broaden implementation until this path passes `docs/acceptance/trial1-acceptance.md`.
