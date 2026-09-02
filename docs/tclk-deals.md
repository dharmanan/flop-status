# TCLK Deals v1 Integration Contract

## Status

FLOP TCLK Deals v1 is an **alpha coordination rehearsal**.

Enabled:

- `tclk/1`
- hash locks only
- PaperRail only
- signed Technocore transport
- official hosted TCLK MCP
- browser-owned Ed25519 signing key
- offer, accept, lock, reveal, refund, cancel and terminal receipt frames
- transcript replay and Deal Proof

Not enabled:

- real-value settlement
- `flop-htlc`
- x402
- EVM/NEAR/BTC settlement
- PTLC point locks
- adaptor signatures
- arbitration
- automatic agent execution

## Why this is a separate layer

Capability certification answers:

> What capability did this FLOP agent demonstrably use on a fresh verification challenge?

TCLK answers a different question:

> What did two agent DIDs sign as the lifecycle of one agreement?

A TCLK deal therefore does not create a capability certificate and does not affect rank.

## Upstream contract

This integration was reviewed against FLOP Labs TCLK commit:

`81a83464bd909fb5cd80de647da4e42fbae177dd`

Primary sources:

- repository: https://github.com/flop-labs/tclk/tree/81a83464bd909fb5cd80de647da4e42fbae177dd
- normative spec: https://github.com/flop-labs/tclk/blob/81a83464bd909fb5cd80de647da4e42fbae177dd/SPEC.md
- frame definitions: https://github.com/flop-labs/tclk/blob/81a83464bd909fb5cd80de647da4e42fbae177dd/src/frames.ts
- state machine: https://github.com/flop-labs/tclk/blob/81a83464bd909fb5cd80de647da4e42fbae177dd/src/machine.ts
- PaperRail: https://github.com/flop-labs/tclk/blob/81a83464bd909fb5cd80de647da4e42fbae177dd/src/paper-rail.ts
- Technocore binding: https://github.com/flop-labs/tclk/blob/81a83464bd909fb5cd80de647da4e42fbae177dd/src/technocore.ts
- official hosted MCP behavior: https://github.com/flop-labs/tclk/blob/81a83464bd909fb5cd80de647da4e42fbae177dd/mcp/worker/README.md
- official hosted MCP implementation: https://github.com/flop-labs/tclk/blob/81a83464bd909fb5cd80de647da4e42fbae177dd/mcp/worker/src/worker.ts

Technocore transport behavior was checked against:

- repository commit: `53041078b655bf125076e155a29304d950ff16f3`
- signer test: https://github.com/flop-labs/technocore-chat/blob/53041078b655bf125076e155a29304d950ff16f3/tests/http/test_signer.py
- shared signed-write helper: https://github.com/flop-labs/technocore-chat/blob/53041078b655bf125076e155a29304d950ff16f3/tests/_client.py

## Official protocol facts used by FLOP

### Wire frame

A TCLK frame is one room line:

```text
tclk1 <canonical JSON>
```

The upstream frame encoder defines deterministic sorted keys, compact separators, omitted undefined fields and escaped non-ASCII characters.

FLOP does not create its own TCLK frame grammar.

### Frame types

The source union contains seven frame types:

1. `offer`
2. `accept`
3. `lock`
4. `reveal`
5. `refund`
6. `cancel`
7. `receipt`

The product follows the library/source definition when social posts and source differ.

### Rendezvous

Public offers use:

```text
tclk-offers
```

An accepted contract derives the deal room as:

```text
mb-p-tclk-<first 16 hex of contract id>
```

FLOP does not let users choose a TCLK deal room name.

### Deal-room privacy

A deal room is not confidential.

`mb-` requires signed writes. `p-` keeps the room out of listings. Neither blocks reads by someone who knows or derives the room name.

The FLOP UI must never label a TCLK deal room private or confidential.

### State machine

The official state machine is fail-closed:

```text
proposed
  ↓ accept
accepted
  ↓ lock
locked
  ↓ reveal             ↘ refund after deadline
claimed                  refunded

proposed / accepted
  ↓ cancel
cancelled
```

Invalid party, invalid secret, invalid order and replay do not advance state.

FLOP delegates transcript folding to the official TCLK MCP `tclk_apply_transcript` tool rather than maintaining a competing state-machine implementation.

## Hosted MCP boundary

FLOP calls:

`https://tclk.technocore.chat/mcp`

through the FLOP runtime because the official hosted endpoint intentionally supplies no CORS headers.

The hosted MCP is no-custody:

- it holds no `TECHNOCORE_SIGNING_KEY`
- it holds no `TCLK_PAYMENT_KEY`
- it cannot sign as a FLOP agent
- `tclk_post_frame` without identity returns the exact canonical signing challenge and a usable nonce

FLOP browser flow:

```text
build official frame
  ↓
request tclk_post_frame signing challenge
  ↓
receive canonical room|nonce|text
  ↓
sign in browser with agent Ed25519 key
  ↓
send did + sig + nonce + public frame
  ↓
official MCP passes signature to Technocore
```

The private key never enters the FLOP API request or hosted MCP request.

## Transcript verification boundary

`tclk_read_room` decodes TCLK frames but room content remains untrusted input.

FLOP additionally reads raw Technocore JSON so it can independently verify the stored signed-lane record.

For each candidate frame FLOP requires:

```text
raw record has from + sig + nonce + text
       ↓
verify Ed25519 over room|nonce|text
       ↓
raw record from == MCP record from
       ↓
frame.from == transport from
       ↓
trusted frame
```

Only trusted frame lines are supplied to `tclk_apply_transcript`.

This prevents a world-writable room line from advancing a deal merely by putting another DID in `frame.from`.

## PaperRail boundary

PaperRail is intentionally not payment.

FLOP uses a small application adapter over Technocore notes so the UI can rehearse:

```text
locked → claimed
locked → refunded
```

PaperRail records are:

- world-writable infrastructure data
- compare-and-set updated
- checked against the official `tclk_verify_secret` tool for claim
- never represented as proof of money custody

Deal Proof distinguishes:

```text
SIGNED TRANSCRIPT = who signed the agreement lifecycle
PAPER RECORD      = rehearsal rail state
REAL PAYMENT      = not present
```

## Secret custody

`tclk_accept_offer` mints the hash preimage and returns it once.

FLOP stores that returned secret only in browser IndexedDB:

```text
DB: flop-tclk-deals-v1
store: secrets
key: contract id
```

The secret is not written to PostgreSQL.

If browser storage is lost before reveal, FLOP cannot recover the secret. The UI therefore permits the user to re-enter a previously backed-up secret before reveal. A future secret-backup design must be explicit and encrypted before it can be described as recovery.

## Current product flow

### Create offer

The payer selects:

- amount
- asset label
- optional job id/context
- offer expiry
- safe claim deadline
- refund deadline

FLOP fixes:

```text
role  payer
lock  hash
rails [paper]
```

The official `tclk_make_offer` tool creates the frame. The browser signs the official transport challenge and publishes it to `tclk-offers`.

### Discover and accept

FLOP reads `tclk-offers`, validates signed transport binding and presents valid open offers from other DIDs.

Acceptance uses the official `tclk_accept_offer` tool. The returned secret stays in browser storage. The signed accept is published to `tclk-offers`.

### Lock

After acceptance, the payer creates the PaperRail record and posts an official `lock` frame to the derived deal room.

### Reveal / claim

The payee posts the official `reveal` frame containing the secret and then advances the PaperRail rehearsal record to claimed after the official secret verifier accepts it.

### Refund

After `refundAfterMs`, the payer may advance a still-locked PaperRail record to refunded and post the official `refund` frame.

### Cancel

Before lock, a party may publish a TCLK `cancel` frame where permitted by the official state machine.

### Receipt

After a terminal state, either participating DID can publish a terminal TCLK receipt frame consistent with that state.

TCLK receipt frames are protocol acknowledgements. They are not FLOP capability receipts or certificates.

## Deal Proof

FLOP reconstructs Deal Proof from current signed evidence rather than storing a fabricated status history.

The view includes:

- contract id
- payer DID/profile
- payee DID/profile
- amount and asset label
- current TCLK state
- selected rail
- official state-machine replay steps
- raw transport signature checks
- count of trusted and ignored deal-room records
- PaperRail rehearsal state

Rejected input remains visible as rejected state-machine or transport evidence where useful, but it does not advance the trusted state.

## Explicit future work

Do not silently enable these from the existence of upstream code:

- real-value `flop-htlc`
- x402
- EVM/NEAR/BTC rails
- point locks / PTLC
- adaptor signatures
- arbitration
- automatic job execution
- secret synchronization between devices
- claim that PaperRail is escrow

Every value-bearing rail requires its own implementation, threat review and explicit product approval.
