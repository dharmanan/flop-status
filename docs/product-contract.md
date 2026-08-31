# Product Contract v0.2

## Problem

Agents can publish capability claims, activity and reputation signals, but those are not proof that a specific capability was demonstrated.

FLOP answers one question:

What can this agent demonstrably do inside FLOP?

## Target user

Primary: people creating and using FLOP agents, including non-technical users.

Secondary: builders and evaluators who need independently verifiable capability evidence.

## User promise

Create your agent. Give it capabilities. Verify each one. Keep the proof.

## Product boundary

FLOP-managed capabilities are acquired and used inside FLOP.

Identity, receipts, certificates and public proof are externally viewable and independently verifiable.

FLOP v1 does not expose a general public endpoint that lets arbitrary third-party applications execute FLOP-managed agents.

## Identity

A FLOP agent uses a supported Ed25519 `did:key`.

The user may create a new identity or restore/connect one already owned.

For FLOP-created browser identities:

* the user owns the portable seed
* active private signing material stays client side
* FLOP servers never receive or store the private key or seed

## Capability journey

Every production capability follows:

**ACQUIRE → PRACTICE → VERIFY → CERTIFY → USE → PROVE**

Every user begins the production certificate journey at Capability 1 and proceeds one capability at a time.

There is no bulk certification or migration credit from internal development acceptance runs.

## ACQUIRE

The user selects a capability and enables it for the FLOP agent.

Normal users are not expected to understand GitHub, patches, repositories or code installation.

FLOP attaches a reference to the versioned capability implementation.

Capability implementation code is stored once; it is not copied into the database for every agent.

## PRACTICE

Practice lets the user run the capability against bounded examples.

Practice does not issue a certificate and does not affect rank.

## VERIFY

FLOP creates a fresh challenge.

The installed capability implementation produces the result.

The same implementation used by the normal FLOP use action must be used during verification. A separate page-specific answer shortcut is not allowed for production certification.

The browser-owned DID signs the exact submission.

PASS/FAIL/UNKNOWN is determined by versioned deterministic verification.

## CERTIFY

Every successful production capability verification immediately issues one separate capability certificate.

Certification begins with Capability 1.

Examples:

* Capability 1 PASS → Certificate 1
* Capability 2 PASS → Certificate 2
* Capability 3 PASS → Certificate 3 plus Rookie cumulative rank

An individual certificate is never replaced by cumulative rank.

## USE

A capability that has been acquired can be used from explicit FLOP product actions.

Core deterministic capabilities run inside the FLOP product environment without requiring an LLM.

FLOP v1 does not run one permanent service per agent and does not expose public arbitrary third-party invocation.

## PROVE

Every production certificate has a public proof surface.

Public proof includes the agent DID, capability identity/version, verifier version, signed PASS receipt, timestamp and FLOP attestation state.

The proof page works without login.

## v1 capability program

FLOP v1 has ten certificate-eligible capabilities.

### Core 1–7

No LLM required.

1. Ed25519 Signature Verification
2. Canonical JSON + SHA256
3. Technocore Canonical Message Construction
4. Signed Receipt Verification
5. Structured Data Transformation
6. Constraint and Policy Compliance
7. Failure Recovery and Idempotency

### Optional Agentic 8–10

LLM required and explicit user opt-in required.

8. Goal Planning & Tool Use
9. Grounded Research & Synthesis
10. Autonomous Multi Step Execution

LLM use may create cost. FLOP must disclose this before the user enables an Agentic capability.

The LLM may perform the task, but FLOP does not use an LLM judge for certification. Verdicts remain deterministic.

## Cumulative rank

Rank is derived from valid individual production certificates.

Initial thresholds:

* 0: Unranked
* 1–2: individually certified, no named rank
* 3–4: Rookie
* 5–6: Regular
* 7: Core Verified
* 8–9: Advanced
* 10: Agentic Verified

Rank names may be refined later without changing individual certificate evidence.

## Challenge lifecycle

ISSUED → SUBMITTED → PASS | FAIL | UNKNOWN

ISSUED may also become EXPIRED.

Every certification challenge is server generated, DID bound, unique, short lived and single use.

Initial default TTL remains 10 minutes unless a versioned capability contract specifies otherwise.

## Verification semantics

Certificate-eligible deterministic verification requires all applicable checks:

* capability is installed for the agent
* challenge belongs to the same DID
* challenge is not expired
* challenge has not been consumed
* submission signature is valid
* result matches the required schema
* production capability/trial/program versions are certificate eligible
* deterministic verifier returns PASS

## PASS semantics

PASS means the signed production result satisfied the deterministic criteria for the exact challenge and verifier version.

PASS creates a signed receipt.

A certificate is created only when the PASS belongs to the production certificate-eligible flow.

## FAIL and UNKNOWN

FAIL is produced only when a cryptographically and structurally valid result is deterministically wrong.

Infrastructure errors, database errors, network uncertainty and unavailable optional services do not become FAIL.

UNKNOWN is never equivalent to FAIL.

## Historical development acceptance evidence

Trial 1–4 browser auto-solver runs performed before the production capability runtime are internal development acceptance evidence.

Their signed receipts remain immutable and publicly verifiable as historical protocol evidence.

They do not count as production user capability certificates and do not increase cumulative rank.

A DID used in those runs still starts the production certificate journey at Capability 1.

## Public profile

The public agent profile aggregates:

* public DID
* all individual production capability certificates
* cumulative rank
* certificate count
* capability slots and states
* proof links and receipt evidence

A user with four production certificates has four separate certificate cards and the corresponding rank state.

## Cost model

Creating or keeping an idle agent must not create a permanently running compute workload.

Core deterministic capability execution should run with bounded cost and no LLM requirement.

Agentic capability cost occurs only after explicit user approval to use an LLM.

Arbitrary third-party applications cannot invoke FLOP-managed agents and create uncontrolled execution cost in v1.

## Testnet seam

Official FLOP testnet integration may later be initiated from inside FLOP.

No wallet, token, chain, contract, faucet or eligibility behavior is invented before an official specification exists.

Any future identity-bound certificate/rank artifact references the live proof and signed receipt evidence rather than replacing them.

## Explicit non goals

Public arbitrary third-party invocation of FLOP-managed agents

Permanent per-agent services

Messaging

Inbox

Passport

Subjective reputation score

Human identity verification

Speculative wallet or faucet

Airdrop prediction

LLM judge

Arbitrary user code execution

## v1 success criteria

A normal non-technical user can:

1. create or restore an agent identity
2. start at Capability 1
3. acquire the capability without code installation
4. practice it
5. run a fresh production verification
6. receive Certificate 1 on PASS
7. open and independently verify its public proof
8. use the same installed capability inside FLOP
9. continue one-by-one through the remaining capabilities

Product v1 is not complete until all ten capability paths, individual certificates, cumulative rank and public proof profile meet their active contracts.
