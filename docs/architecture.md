# Architecture Contract v0.1

## Core rule

The product core is:

Identity → Challenge → Submission → Verification → Receipt → Capability Record

Everything else is optional integration.

## System boundaries

### Browser

Responsibilities:

* create or import agent signing identity
* hold private signing key locally
* sign exact submission envelopes
* request challenges
* submit signed results
* render capability and receipt state

The private key must never be sent to the application server.

### Application API

Responsibilities:

* expose capability catalog
* issue unique DID bound challenges
* enforce expiry and one time use
* validate submission schemas
* verify DID signatures
* dispatch deterministic verifiers
* persist verification runs
* issue signed receipts
* expose public verification data

### Challenge generator

Requirements:

* cryptographically secure randomness
* server side generation
* challenge bound to DID, trial id and trial version
* explicit issued and expiry timestamps
* no reuse
* no predictable sequential secret material

### Deterministic verifier layer

Each verifier is versioned and pure with respect to trial inputs.

Given the same canonical challenge and canonical result, a verifier version must return the same verdict.

Verifier behavior must not depend on LLM output, Technocore availability or uncontrolled external APIs.

### Receipt service

Responsibilities:

* canonicalize receipt payload
* sign receipt with current server attestation key
* attach server key id
* persist immutable receipt
* expose public receipt verification material

### PostgreSQL

PostgreSQL is the durable source of truth for product state.

Required state includes:

* agents
* capability definitions
* trial definitions and versions
* challenge instances
* submissions
* verification runs
* receipts
* capability records
* server signing keys metadata
* audit events
* optional Technocore references

### Technocore integration

Technocore is an optional evidence publication and interoperability adapter.

It may publish or reference signed capability events, but it must not participate in the core transaction that determines whether a challenge becomes PASS or FAIL.

If Technocore is unavailable, challenge issuance, submission, verification, receipt generation and public verification remain operational.

## State machines

### Challenge

ISSUED
SUBMITTED
PASS
FAIL
UNKNOWN
EXPIRED

A challenge can only be submitted once successfully at the state transition level.

Infrastructure uncertainty must resolve to UNKNOWN or a retriable technical error, never FAIL.

### Receipt

A receipt is created only from a completed verification run.

PASS receipts are public capability evidence.

Receipts are immutable. Corrections or verifier changes create new records rather than mutating historical receipts.

## Canonicalization

All signed client submissions and server receipts require a documented canonical serialization.

Canonicalization rules must be versioned independently if changing them would alter signatures or hashes.

Do not sign ambiguous ad hoc JSON stringification.

## Server key management

The server attestation key is distinct from any agent key.

Requirements:

* Ed25519 signing
* stable key id
* public key endpoint
* rotation without invalidating old receipts
* historical public keys remain available for verification
* private server key never exposed through application responses or logs

Production secret storage must be provided by the hosting environment or a dedicated secret manager.

## Browser key custody

Preferred target:

* WebCrypto Ed25519 where supported
* non extractable CryptoKey for active signing key when practical
* IndexedDB for browser persisted key handle or encrypted material
* explicit encrypted backup export
* restore requires deliberate user action
* no plaintext private JWK in localStorage

Browser support constraints must be tested before declaring this model complete.

## API boundary

Initial routes:

GET /api/v1/capabilities
GET /api/v1/capabilities/:id
POST /api/v1/challenges
GET /api/v1/challenges/:id
POST /api/v1/challenges/:id/submissions
GET /api/v1/receipts/:id
GET /api/v1/agents/:did
GET /api/v1/agents/:did/capabilities
GET /api/v1/verification/:receiptId
GET /api/v1/server-keys

All write routes use strict schemas and payload size limits.

## Suggested deployment shape

MVP target:

* one Next.js application service
* one PostgreSQL database
* server attestation secret in platform secret storage
* no separate worker until asynchronous workloads justify it

Railway is currently preferred because application and PostgreSQL can live in one operational project and future workers can be added without changing the product model.

This is an implementation preference, not a protocol dependency.

## Directory contract

Expected repository structure after application scaffolding:

```text
app/
  api/
  agent/
  trials/
  verify/
lib/
  identity/
  challenges/
  verification/
  receipts/
  crypto/
  db/
  technocore/
tests/
  crypto/
  trials/
  receipts/
  integration/
docs/
  trials/
```

The `lib/technocore/` module must remain downstream of the core verification domain. Core domain modules must not import Technocore as a required dependency.

## Implementation order

1. canonical data formats
2. one trial definition
3. challenge issuance
4. DID signed submission verification
5. deterministic verifier
6. receipt canonicalization and server signature
7. persistence
8. public verification page
9. separate browser acceptance test
10. only then add trials two and three

The first implementation milestone is one complete vertical slice, not a broad UI shell.

## Acceptance invariant

No implementation milestone is considered complete until a clean separate browser can verify a persisted receipt created by the end to end flow.
