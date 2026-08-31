# FLOP Agent Runtime v1

## Core boundary

FLOP capability execution is contained inside FLOP.

Identity and proof may be public and portable. FLOP-managed capabilities are not exposed as a general third-party agent runtime in v1.

There is no public `invoke this agent from any application` endpoint in v1.

## Agent model

A FLOP agent is not a permanently running service or process.

A FLOP agent consists of:

* a user-owned Ed25519 `did:key`
* a FLOP agent profile bound to that DID
* references to versioned FLOP capability modules
* practice and verification state
* signed receipts and individual capability certificates
* cumulative rank derived from valid certificates
* optional LLM configuration only when the user explicitly enables Agentic capabilities

Creating an idle agent must not create a dedicated Railway service, worker or persistent process.

Idle agents are metadata only.

## User lifecycle

The product lifecycle for every capability is:

**ACQUIRE → PRACTICE → VERIFY → CERTIFY → USE → PROVE**

Identity creation or restoration happens before the capability journey.

Every user starts the certificate journey at Capability 1 and proceeds through the capabilities one by one. There is no migration shortcut, bulk certification action or hidden credit for internal development acceptance runs.

### ACQUIRE

The user selects the next capability and chooses `Get capability` or equivalent.

Normal users do not receive a patch, repository, ZIP file or source-code installation task.

FLOP attaches the selected versioned capability module to the agent profile.

Capability implementation code is stored once in the FLOP capability registry. An agent stores only references and state.

### PRACTICE

The user may run bounded practice tasks inside FLOP.

Practice is not certification and does not create public proof.

### VERIFY

FLOP issues a fresh unique challenge for that capability.

The result must be produced by the installed FLOP capability runtime used by the agent, not by a test-specific shortcut embedded in the page.

The same capability implementation used for ordinary FLOP `USE` must be the implementation exercised by verification.

The verification trust path remains:

DID → unique challenge → capability runtime result → DID-signed submission → deterministic verifier → server-signed receipt → capability record.

### CERTIFY

Every certificate-eligible PASS immediately creates one individual capability certificate for that DID and capability version.

Certification begins with Capability 1. FLOP never waits for 7/7 or 10/10 before issuing certificates.

Examples:

* Capability 1 PASS → Certificate 1
* Capability 2 PASS → Certificate 2
* Capability 3 PASS → Certificate 3 plus any cumulative rank unlocked at three certificates

Each certificate remains independently visible and independently verifiable.

Cumulative rank is calculated separately from the set of valid individual capability certificates. See `docs/certification-model-v1.md`.

### USE

Verified FLOP capabilities are usable only through explicit user-initiated actions inside FLOP in v1.

There is no permanently running agent process and no autonomous background loop in v1.

FLOP v1 does not expose FLOP-managed agents to arbitrary third-party application calls.

### PROVE

The public proof surface may be viewed outside FLOP and independently verified.

It may expose:

* public DID
* every individual capability certificate
* cumulative rank
* program and verifier versions
* receipts
* proof URLs

Public proof does not act as a general agent execution endpoint.

## Capability registry

FLOP maintains one internal versioned registry of capability implementations.

A capability module conceptually has:

* `capability_id`
* `capability_version`
* `runtime_type`
* `module_version`
* `practice_definition`
* `verification_trial_id`
* `verification_trial_version`
* `cost_class`
* `active`

An agent installation stores a reference to the registry entry plus agent-specific state.

Changing behavior that affects execution or verification requires a version change rather than silently changing an already certified capability.

## Seven deterministic Core capabilities

Capabilities 1–7 require no LLM.

They are acquired, practiced, executed and verified inside FLOP using bounded deterministic implementations.

A user must be able to obtain each of the seven Core capability certificates separately without entering an LLM API key or accepting LLM usage cost.

Core execution should have strict limits on payload size, CPU time, storage and network access. Core modules should not require uncontrolled external network services.

## Three optional Agentic capabilities

Capabilities 8–10 require an LLM and are optional.

They must never be silently enabled.

Before the first Agentic task, FLOP must clearly disclose:

* that an LLM is required
* that usage may create cost
* which provider/runtime path will be used
* that the user must explicitly approve enabling it

Each Agentic PASS also creates its own individual capability certificate.

The user may stop after Capability 7 with seven valid certificates and the corresponding cumulative Core rank.

LLM output may perform the task, but PASS/FAIL verification must remain deterministic. FLOP v1 does not use an LLM judge.

## Internal Trial 1–4 acceptance records

The existing Trial 1–4 browser auto-solver runs were development acceptance harnesses used to prove the challenge, submission, verifier, receipt, persistence and public-proof infrastructure.

They are not user capability certificates and must not be counted toward the production certificate journey.

Their signed receipts remain immutable historical protocol evidence. They are not deleted or rewritten.

A user whose DID participated in those development runs still begins the production certificate journey at Capability 1 and completes Capability 1, then Capability 2, then Capability 3 and so on individually through the normal product flow.

There is no `activate the previous four`, `migrate four certificates`, `verify all four` or equivalent bulk path.

## Cost boundary

Cost should occur only when the user explicitly performs a FLOP action.

Potential cost sources are:

* bounded deterministic compute
* PostgreSQL reads and writes
* controlled network/tool use
* explicitly approved LLM usage for Agentic capabilities

Idle agents must not create ongoing execution cost.

Arbitrary third-party applications must not be able to generate unbounded FLOP execution cost by remotely invoking FLOP-managed agents.

## Testnet seam

Official FLOP testnet integration may later be initiated from inside FLOP.

Expected direction:

User in FLOP → FLOP agent capability execution → official testnet adapter → testnet result/evidence.

The testnet does not require a public unrestricted agent invocation endpoint.

Exact wallet, token, chain, contract and execution behavior remains undefined until an official FLOP testnet specification exists.
