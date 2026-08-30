# AGENTS.md

## Purpose

This repository uses a lightweight persistent project context system for AI coding agents.

The repository is the source of truth. Chat history is not the source of truth.

The goal is to preserve important project knowledge while minimizing unnecessary context and token usage.

## Non negotiable workflow

Before modifying code:

1. classify the task
2. read only the smallest relevant context
3. inspect the real implementation
4. verify important assumptions against source, tests or runtime behavior
5. identify the smallest coherent change
6. make only that change
7. run relevant verification
8. never claim completion without evidence

Do not invent project history.

Do not assume documentation proves runtime behavior.

Do not silently override established product decisions.

Do not solve architecture problems by reflexively adding retries, longer timeouts or new fallback layers.

Do not broaden scope merely because adjacent work looks useful.

## Context routing

Always read:

1. `AGENTS.md`

Usually read for meaningful implementation work:

2. `docs/project-context/STATUS.md`
3. `docs/project-context/DECISIONS.md`

Read only when relevant:

* `docs/architecture.md` for system boundaries, data flow, interfaces or multi module changes
* `docs/product-contract.md` for product semantics, scope or user promise
* `docs/threat-model.md` for security sensitive work
* `docs/database-schema.md` for persistence or transaction work
* `docs/api-contract-v1.md` for API work
* `docs/receipt-spec.md` for receipt or attestation work
* `docs/implementation/trial1-vertical-slice.md` for Trial 1 implementation
* `docs/acceptance/trial1-acceptance.md` when verifying Trial 1
* `docs/project-context/ROADMAP.md` for sequencing and priority
* `docs/project-context/DESIGN-RULES.md` only for UI, visual or Figma related work
* `docs/project-context/CHANGELOG.md` only for relevant historical regression investigation

Never read files merely because they exist.

## Source of truth priority

When information conflicts, use this order:

1. verified runtime behavior and tests
2. current source code
3. active product and architecture contracts in `docs/`
4. `docs/project-context/`
5. README and secondary documentation
6. chat history

Surface meaningful conflicts before making assumptions.

## FLOP Capability Lab core invariant

The product core is:

Identity → Challenge → Submission → Verification → Receipt → Capability Record

The first implementation milestone is one complete Trial 1 vertical slice.

Do not add Trial 2, Trial 3, messaging, wallet, faucet, token logic, LLM judging, generic orchestration or broad dashboard work before Trial 1 passes its acceptance contract.

## Trust semantics

These distinctions are mandatory:

* a DID is a cryptographic key identifier, not human identity proof
* a valid DID signature proves control of the corresponding private key for the signed payload
* a capability claim is not verified evidence
* UNKNOWN is not FAIL
* infrastructure failure is not capability failure
* Technocore is not the durable product source of truth
* PostgreSQL is the durable product state
* Technocore is optional downstream evidence and interoperability

Core verification must not depend on Technocore availability.

## Trial 1 discipline

For Trial 1:

* support only Ed25519 `did:key`
* use RFC 8785 JCS for signed JSON canonicalization
* use deterministic verification only
* challenge must be server generated, unpredictable, DID bound, expiring and one time use
* submission must be DID signed
* PASS receipt must be Capability Lab server signed
* challenge consumption must be race safe
* duplicate submission must not create duplicate evidence
* a lost HTTP response must not cause resubmission of a consumed challenge
* public receipt verification must work in a clean separate browser

Do not weaken these requirements to make implementation easier.

## Change discipline

Prefer the smallest coherent vertical change.

Do not:

* rewrite unrelated code
* introduce parallel implementations
* create generic abstractions before a real second use case exists
* add speculative FLOP testnet fields without an official specification
* add arbitrary user code execution to the deterministic MVP
* add an LLM dependency to deterministic verification
* make Technocore a blocking dependency
* commit secrets or `.env` contents

## Tests and verification

Run the smallest relevant tests first, then broader verification when justified.

Do not remove or weaken tests to make a suite pass.

If verification cannot be completed, state exactly what was and was not verified.

Never say `done`, `fixed`, `working`, `final` or equivalent without verification.

Trial 1 is not complete until the acceptance contract in `docs/acceptance/trial1-acceptance.md` passes.

## Project context updates

Persistent project knowledge lives in `docs/project-context/`.

After meaningful work, update only the context files actually affected.

### STATUS.md

Current reality only. Replace stale information rather than endlessly appending.

### DECISIONS.md

Only durable decisions and reasons. Never delete superseded decisions; mark them superseded with a newer entry.

### ROADMAP.md

Current execution order only. Prefer Now, Next, Later, Not planned.

### CHANGELOG.md

Only meaningful completed project changes. Do not log trivial formatting or every commit.

### DESIGN-RULES.md

Read and update only when visual product language or UI design rules materially change.

## Context size discipline

Keep project context lean.

Do not paste logs, transcripts, large code blocks or datasets into project context.

Do not duplicate detailed contracts already present in `docs/`; summarize and link instead.

If a context file becomes noisy, compress it before adding more.

## Safety

Never expose secrets, credentials, tokens or private keys.

Never commit `.env` contents.

Do not perform destructive repository operations unless explicitly requested.

Do not access files outside this repository unless explicitly authorized.
