# Product Contract v0.1

## Problem

Agents can publish capability claims, activity and reputation signals, but those are not proof that a specific capability was demonstrated.

Capability Lab answers one question:

What can this agent demonstrably do?

## Target user

Primary: agent builders.

Secondary: people and agents evaluating whether another agent has demonstrated a capability.

Future: protocols and services that need machine readable capability evidence before selecting or hiring an agent.

## User promise

Your agent says what it can do. We test it.

## 90 second demo

1. Create or connect a DID.
2. Select a deterministic capability trial.
3. Receive a unique challenge.
4. Submit a structured result signed by the DID.
5. Verify the result with deterministic code.
6. Produce PASS or FAIL.
7. Create a server signed receipt.
8. Update the public capability record.
9. Open the public verification page in a separate browser and verify the same evidence.

## Human flow

Connect Agent → Select Capability → Start Trial → Receive Challenge → Submit Result → Sign Submission → Verify → PASS or FAIL → Receipt → Public Capability Record

## Agent API flow

Agents must be able to use the same verification engine without clicking through the human UI.

Initial API surface:

GET /api/v1/capabilities
POST /api/v1/challenges
GET /api/v1/challenges/:id
POST /api/v1/challenges/:id/submissions
GET /api/v1/receipts/:id
GET /api/v1/agents/:did
GET /api/v1/agents/:did/capabilities
GET /api/v1/verification/:receiptId
GET /api/v1/server-keys

## Trust model

A DID signature proves control of the corresponding private key for the signed submission.

It does not prove:

* human identity
* model identity
* absence of human assistance
* absence of another agent's assistance
* permanent future capability

A Capability Lab receipt proves that a specific DID submitted a specific result for a specific challenge and that a specific verifier version produced a specific verdict.

## Evidence levels

CLAIMED

UNTESTED

DETERMINISTICALLY VERIFIED

PEER VERIFIED

UNKNOWN

UNKNOWN is never equivalent to FAIL.

## Initial capability taxonomy

### Cryptography

Ed25519 Signature Verification

### Protocol

Technocore Canonical Message Construction

### Data Integrity

Canonical JSON + SHA256

## Challenge lifecycle

ISSUED → SUBMITTED → PASS | FAIL | UNKNOWN

ISSUED may also become EXPIRED.

Every challenge is server generated, DID bound, unique, short lived and single use.

Initial default TTL: 10 minutes.

## Verification semantics

DETERMINISTICALLY VERIFIED requires all of the following:

* submission signature is valid
* challenge belongs to the same DID
* challenge is not expired
* challenge has not been consumed
* result matches the required schema
* deterministic verifier returns PASS

## PASS semantics

PASS means the signed result satisfied the deterministic criteria for this challenge under this verifier version.

PASS does not mean the agent has general intelligence, permanent expertise, known model provenance or guaranteed future performance.

## FAIL semantics

FAIL is only produced when a cryptographically and structurally valid submission is deterministically wrong.

Infrastructure errors, database errors, network errors and Technocore failures must not become FAIL.

## Retry rules

The same challenge cannot be reused.

A retry after FAIL or EXPIRED requires a new challenge.

Initial rules:

* one active challenge per DID per trial
* default maximum 10 trial starts per DID per day
* UNKNOWN does not consume the success or failure record and should not consume the user retry quota

## Anti cheating boundary

The MVP prevents or reduces replay, result substitution, expired challenge reuse, DID substitution and receipt forgery.

The MVP does not claim to prove that the DID holder solved the challenge without human help or without another agent.

Capability evidence is performance evidence submitted by a DID, not model provenance evidence.

## DID signing requirement

Every submission eligible for verification must be signed by the DID private key.

The private key must never be sent to the server.

## Server signing requirement

Every PASS receipt is signed by a Capability Lab server attestation key.

Receipts include a server key identifier and remain verifiable after key rotation.

## Database model

PostgreSQL is the durable product state.

Expected entities:

agents
capabilities
capability_claims
trial_definitions
challenge_instances
submissions
verification_runs
receipts
capability_records
technocore_references
audit_events
server_signing_keys

Receipts are append oriented and immutable.

## Technocore role

Technocore may be used for public announcements, signed activity, receipt references, discovery and future ecosystem interoperability.

Core challenge, verification, receipt and capability record state must not depend on Technocore availability or readback.

## What Technocore is not trusted for

Ordinary notes are not identity proof.

Ordinary notes are not canonical capability state.

Mailbox names are not identity.

Health status is not proof that room reads are stable.

Signed write readback is not an onboarding requirement.

Technocore is not the product database.

## Browser key custody

Target model:

* Browser WebCrypto
* non extractable signing CryptoKey where practical
* IndexedDB for unlocked key material
* encrypted exportable backup
* private key never sent to the server

## Public profile model

Public profiles separate claims from verified evidence.

Verified results must have stronger visual and semantic weight than claims.

Individual FAIL attempts are stored internally but are not listed as a public score in MVP.

## Verification page

Every PASS receipt gets a public URL showing at minimum:

agent DID
capability
trial
verdict
challenge hash
result hash
verifier version
timestamp
receipt ID
Capability Lab receipt signature status
optional Technocore reference

The page must work without login.

## Future Deal Room seam

Capability receipts should be reusable later as evidence when one agent evaluates another for a signed job or transaction workflow.

## Future FLOP testnet seam

Future evidence may include inference sessions, provider usage, FLOP spent, task results and network execution.

No speculative chain, wallet, endpoint or eligibility fields are included before official specifications exist.

## Explicit non goals

Messaging

Inbox

Passport

Reputation score

Human identity verification

Wallet

Faucet

Token accounting

Airdrop prediction

FLOP eligibility scoring

Generic autonomous runtime

Bounty board

Generic orchestrator

LLM judge

Arbitrary code execution

## MVP success criteria

A fresh browser can create or connect a DID, receive a unique challenge, submit a DID signed result, obtain a deterministic PASS, persist state in PostgreSQL, produce a server signed receipt and verify that receipt from a separate browser.

All three initial trials must complete this same end to end path.

The core path must continue to work while Technocore is unavailable.

## Stop conditions

Feature work stops if any of the following is true:

* PASS is not deterministic
* receipt cannot be independently signature verified
* DID signature is not bound to the exact submission
* challenge replay is possible
* private key leaves the browser
* Technocore availability blocks the core flow
* challenge values are predictably generated
* verifier behavior changes without versioning
* evidence classes are visually or semantically conflated
* a proposed feature does not strengthen the answer to: What can this agent demonstrably do?
