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
* signed receipts and certificate state
* optional LLM configuration only when the user explicitly enables Agentic capabilities

Creating an idle agent must not create a dedicated Railway service, worker or persistent process.

Idle agents are metadata only.

## User lifecycle

The product lifecycle is:

**CREATE → ACQUIRE → PRACTICE → VERIFY → CERTIFY → USE → PROVE**

### CREATE

The user creates or restores a FLOP identity and agent profile.

The accepted noncustodial identity model remains unchanged:

* the user owns the portable Ed25519 seed
* the active browser key is nonextractable where supported
* private identity material is never stored by Railway, Vercel server code or PostgreSQL

### ACQUIRE

The user selects a capability and chooses `Get capability` or equivalent.

Normal users do not receive a patch, repository, ZIP file or source-code installation task.

FLOP attaches the selected versioned capability module to the agent profile.

Capability implementation code is stored once in the FLOP capability registry. An agent stores only references and state.

### PRACTICE

The user may run bounded practice tasks inside FLOP.

Practice is not certification and does not create public proof.

### VERIFY

FLOP issues a unique challenge.

The result must be produced by the FLOP agent runtime using the capability version attached to that agent.

The browser must not compute the hidden answer itself and then represent that result as proof that the agent possesses the capability.

The verification trust path remains:

DID → unique challenge → DID-signed result → deterministic verifier → server-signed receipt → capability record.

### CERTIFY

Every certificate-eligible PASS creates one individual capability certificate for that DID and capability version.

Certification does not wait for 7/7 or 10/10.

Cumulative rank is calculated separately from the set of valid individual capability certificates. See `docs/certification-model-v1.md`.

### USE

Verified FLOP capabilities are usable only through explicit user-initiated actions inside FLOP in v1.

There is no permanently running agent process and no autonomous background loop in v1.

FLOP v1 does not expose FLOP-managed agents to arbitrary third-party application calls.

### PROVE

The public proof surface may be viewed outside FLOP and independently verified.

It may expose:

* public DID
* individual capability certificates
* cumulative rank
* program and verifier versions
* receipts
* proof URL

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

Core capabilities require no LLM.

They are acquired, practiced, executed and verified inside FLOP using bounded deterministic implementations.

A user must be able to obtain all seven Core capability certificates without entering an LLM API key or accepting LLM usage cost.

Core execution should have strict limits on payload size, CPU time, storage and network access. Core modules should not require uncontrolled external network services.

## Three optional Agentic capabilities

Capabilities 8–10 require an LLM and are optional.

They must never be silently enabled.

Before the first Agentic task, FLOP must clearly disclose:

* that an LLM is required
* that usage may create cost
* which provider/runtime path will be used
* that the user must explicitly approve enabling it

The user may stop at seven Core certificates without any product penalty.

LLM output may perform the task, but PASS/FAIL verification must remain deterministic. FLOP v1 does not use an LLM judge.

## Current Trial 1–4 acceptance caveat

The existing browser auto-solvers for Trials 1–4 proved the challenge, submission, deterministic verifier, receipt, persistence and public-proof engine.

They are protocol acceptance harnesses.

They are not sufficient by themselves for final capability certification because the current browser calculates those trial answers directly instead of running an acquired capability through the FLOP agent runtime.

Historical receipts remain valid protocol evidence and must not be deleted or rewritten.

Before extending certificate-eligible product work, FLOP must implement at least one complete:

**ACQUIRE → PRACTICE → VERIFY → CERTIFY → USE → PROVE**

slice through the FLOP-contained runtime.

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
