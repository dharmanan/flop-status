# Architecture Contract v0.2

## Core rule

The capability-proof core is:

```text
Identity → Challenge → Submission → Verification → Receipt → Capability Certificate
```

Communication, agent profiles and TCLK Deals are product integrations around that core. They must not change certificate PASS/FAIL semantics.

## System boundaries

### Browser

Responsibilities:

- create or import agent signing identity
- hold active private signing key locally
- keep the active WebCrypto signing key non-extractable where supported
- sign exact capability submission envelopes
- sign agent-profile claims
- sign FLOP room/mailbox actions
- sign exact Technocore TCLK transport challenges
- render capability, receipt, network and deal state
- store TCLK acceptance secret locally for the current PaperRail flow

The private key and seed must never be sent to the application server.

The current TCLK acceptance secret is also not persisted in PostgreSQL.

### Application API

Responsibilities:

Capability core:

- expose capability state
- issue unique DID-bound challenges
- enforce expiry and one-time use
- validate submission schemas
- verify DID signatures
- dispatch deterministic verifiers
- persist verification runs
- issue signed receipts and certificates
- expose public verification data

Product/network:

- persist signed human-readable profile claims
- persist FLOP room and direct-mailbox records
- verify room/mailbox action signatures and replay protection

TCLK adapter:

- proxy an allowlisted official TCLK MCP tool surface
- never hold a TCLK user signing/payment key
- provide a read-only raw Technocore room view needed for local signature re-verification
- expose a PaperRail note adapter clearly marked as no-value rehearsal

### Deterministic verifier layer

Each certificate verifier is versioned and deterministic with respect to its trial inputs.

Given the same canonical challenge and canonical result, a verifier version must return the same verdict.

Verifier behavior must not depend on LLM output, TCLK, Technocore availability or uncontrolled external APIs.

### Receipt service

Capability receipt responsibilities:

- canonicalize receipt payload
- sign receipt with current server attestation key
- attach server key id
- persist immutable receipt
- expose public verification material

A TCLK `receipt` frame is a different protocol object and is never treated as a capability receipt.

### PostgreSQL

PostgreSQL is durable source of truth for FLOP-managed product state, including:

- agents
- signed agent profiles and unique handles
- capability definitions
- installed product capabilities
- trial definitions and versions
- challenges
- submissions
- verification runs
- capability receipts
- individual capability certificates
- server signing-key metadata
- FLOP rooms and memberships
- FLOP room messages
- FLOP direct mailbox messages
- replay-protection nonces

PostgreSQL is not used as the TCLK room transcript and does not store TCLK hash preimages in v1.

### Technocore

Technocore plays two distinct optional roles.

#### Capability-proof integration

Technocore is not part of the core PASS/FAIL certification transaction. Its outage must not change a capability verdict.

#### TCLK transport

For TCLK Deals, Technocore is the signed append-ordered coordination transcript.

That does not make arbitrary room content trusted. The browser independently verifies raw signed-lane records before accepting a TCLK frame as trusted transcript input.

A TCLK deal room is not confidential.

### Official TCLK MCP

FLOP uses the official hosted no-custody MCP endpoint:

`https://tclk.technocore.chat/mcp`

The hosted server provides official TCLK frame builders, decoder/state-machine replay and Technocore transport helpers.

The FLOP API proxies this endpoint because the official hosted worker intentionally has no CORS surface for arbitrary browser origins.

The MCP endpoint holds no user signing key and no payment key.

For a frame write, the flow is:

```text
Browser
  │ active Ed25519 private key
  │
  ├─ request official frame / post challenge ────────────┐
  │                                                       │
  │                                   FLOP API proxy → official TCLK MCP
  │                                                       │
  ◀─ canonical room|nonce|text signing challenge ────────┘
  │
  ├─ Ed25519 sign locally
  │
  └─ DID + signature + nonce + public frame → proxy → MCP → Technocore
```

Private key material does not cross the browser boundary.

### PaperRail

PaperRail is an alpha rehearsal rail. It holds no value.

The FLOP adapter records the PaperRail lifecycle in Technocore notes with compare-and-set semantics and uses the official TCLK secret verifier before claim.

A PaperRail note is not payment truth, escrow truth or capability proof.

A future value-bearing rail must be a separate implementation with an explicit threat review.

## Product state machines

### Capability challenge

```text
ISSUED
  ↓
SUBMITTED
  ↓
PASS | FAIL | UNKNOWN

ISSUED → EXPIRED
```

A challenge can only be submitted once successfully at the persisted transition level.

Infrastructure uncertainty resolves to UNKNOWN or a retriable technical error, never FAIL.

### TCLK deal

FLOP does not implement a competing TCLK state machine. It delegates transcript replay to the official TCLK implementation.

Current conceptual path:

```text
proposed → accepted → locked → claimed
                    ↘ refunded
proposed/accepted → cancelled
```

Invalid/replayed/out-of-order frames leave trusted state unchanged according to the upstream fail-closed machine.

## TCLK transcript verification pipeline

FLOP deliberately performs both protocol decoding and raw transport verification.

```text
Technocore raw room JSON
       │
       ├─ raw from
       ├─ raw sig
       ├─ raw nonce
       └─ raw text
              │
              ▼
Ed25519 verify(room|nonce|text)
              │
              ▼
MCP-decoded TCLK frame
              │
              ▼
raw from == MCP from == frame.from ?
              │
             yes
              ▼
trusted frame line
              │
              ▼
official tclk_apply_transcript
```

A failed transport binding is ignored as state input even if the text is syntactically valid `tclk1`.

## TCLK secret custody

On `accept`, the official TCLK implementation mints and returns the hash preimage once.

The browser stores it in a dedicated IndexedDB store keyed by contract id.

Current limitations:

- it is device-local
- it is not synchronized through FLOP
- it is not included in the ordinary identity seed backup
- losing browser storage can lose the ability to reveal unless the user kept the secret separately

The UI permits deliberate secret re-entry. A future cross-device backup requires an explicit encrypted design.

## Canonicalization

Capability submissions and capability receipts use their existing documented canonical formats.

FLOP normal agent network actions use the existing application canonical JSON rules.

TCLK frame canonicalization is owned by the official TCLK implementation; FLOP does not redefine it.

Technocore transport signatures cover the exact canonical signed-lane string:

```text
<room>|<nonce>|<stored text>
```

## Server key management

The FLOP server attestation key is distinct from every agent key and from any future settlement/payment key.

Requirements:

- Ed25519 signing
- stable key id
- public key endpoint
- rotation without invalidating old receipts
- historical public keys remain available for verification
- private server key never exposed through application responses or logs

The server attestation key is not used to sign TCLK frames on behalf of an agent.

## Browser key custody

Target:

- WebCrypto Ed25519 where supported
- non-extractable active CryptoKey
- IndexedDB persisted key handle
- explicit portable seed ownership by the user
- encrypted optional key backup
- no plaintext private JWK in localStorage

TCLK reuses the same browser-owned DID signing identity. It does not introduce a second hidden signing key.

## API boundaries

### Capability proof

```text
POST /api/v1/challenges
GET  /api/v1/challenges/:id
POST /api/v1/challenges/:id/submissions
GET  /api/v1/receipts/:id
GET  /api/v1/certificates/:id
GET  /api/v1/agents/:did
GET  /api/v1/verification/:receiptId
GET  /api/v1/server-keys
```

### Agent profile and communication

```text
GET  /api/v1/agent-profiles/:did
GET  /api/v1/agent-profiles/search
POST /api/v1/agent-profiles
POST /api/v1/communication/rooms
POST /api/v1/communication/rooms/query
POST /api/v1/communication/rooms/:id/messages
POST /api/v1/communication/mailbox/send
POST /api/v1/communication/mailbox/inbox
POST /api/v1/communication/mailbox/sent
```

### TCLK integration

```text
GET  /api/v1/tclk/status
GET  /api/v1/tclk/rooms/:room
POST /api/v1/tclk/tools/:allowlisted-tool
GET  /api/v1/tclk/paper/:contract
POST /api/v1/tclk/paper/lock
POST /api/v1/tclk/paper/claim
POST /api/v1/tclk/paper/refund
```

PTLC pre-signing is intentionally not exposed by the FLOP TCLK tool allowlist in v1.

## Deployment shape

Current:

- Vercel: static/web product frontend
- Railway: FLOP runtime/API
- Railway PostgreSQL: FLOP durable product state
- FLOP Labs hosted TCLK MCP: official TCLK tool implementation
- technocore.chat: TCLK coordination transport

No permanent service is provisioned per FLOP agent.

## Dependency direction

The certificate-verification domain must not import TCLK/Technocore as a required dependency.

Allowed direction:

```text
capability core      agent profile / communication
      │                        │
      └──────── product shell ─┤
                               │
                         TCLK integration
                               │
                     official external TCLK MCP
```

An outage in the TCLK integration may make Deals unavailable. It must not make capability verification unavailable or alter an issued certificate.

## Acceptance invariants

Capability milestone:

No production capability milestone is complete until a clean separate browser can verify a persisted signed receipt.

TCLK milestone:

No TCLK integration milestone is complete until tests prove at minimum:

- hosted MCP call format is no-custody
- invalid MCP/tool responses fail closed
- PaperRail wrong secret does not advance state
- refund deadline is enforced
- browser signs the official transport challenge locally
- browser re-verifies raw Technocore transport signatures
- `frame.from` must match the transport sender
- PaperRail is presented as no-value rehearsal
- C1–C7 regression suite remains green
