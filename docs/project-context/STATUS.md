# Project Status

Last updated: 2026-08-30

## Current phase

Pre implementation contract and Trial 1 preparation.

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

## In progress

* Preparing the repository for the first Trial 1 implementation slice.

## Known problems

No application implementation exists yet.

No runtime or acceptance test has passed yet.

## Blocked

None currently known.

## Important current state

The repository is intentionally documentation first.

The first implementation target is only Trial 1:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

Do not broaden implementation until this path passes `docs/acceptance/trial1-acceptance.md`.
