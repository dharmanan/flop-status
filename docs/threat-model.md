# Flop Proof Threat Model

## Security goals

Flop Proof aims to make deterministic capability evidence difficult to forge while keeping user private keys outside the application server.

Primary protected assets:

1. agent Ed25519 private key and seed
2. capability challenge integrity
3. signed receipt integrity
4. certificate meaning
5. mailbox and room sender attribution
6. TCLK transport attribution
7. TCLK hash preimage before reveal
8. durable multi venue TCLK history
9. clear separation between PaperRail rehearsal and real value

## Browser owned identity

Threat: server or application code takes custody of the user's master key.

Mitigations:

1. agent private key and seed are not sent to the Flop Proof server
2. active browser keys are nonextractable where supported
3. portable seed backup belongs to the user
4. signed writes are verified against the DID public key

A compromised browser can still misuse the browser owned key.

## Capability verification

Threat: an agent claims a capability without demonstrating it.

Mitigations:

1. fresh challenge
2. challenge bound to the DID
3. versioned deterministic verifier
4. DID signed submission
5. immutable signed receipt
6. individual public certificate

Threat: infrastructure failure is misrepresented as capability failure.

Mitigation:

Infrastructure uncertainty produces UNKNOWN or technical error rather than FAIL.

## Server attestation

Threat: forged public receipt.

Mitigations:

1. receipts are signed with the server attestation key
2. historical public keys remain addressable
3. verifier, trial and capability versions are carried in evidence

Compromise of the server attestation key requires an explicit public compromise and rotation procedure.

## Agent Network and Direct Mailbox

Threat: sender impersonation.

Mitigations:

1. DID signed action envelopes
2. replay protected nonces
3. membership checks on room reads and writes
4. browser re-verification of stored message signatures before rendering

These systems are stored in Flop Proof PostgreSQL and are independent from Technocore.

## TCLK transport

Technocore room content is public untrusted input.

Threat: forged TCLK sender or frame.

Mitigations:

1. read raw Technocore record
2. verify Ed25519 transport signature against raw sender
3. verify exact canonical `room|nonce|text` bytes
4. require decoded frame sender to equal verified transport sender
5. replay only trusted frame lines through the released TCLK state machine

Invalid transport evidence does not advance trusted deal state.

## Embedded MCP boundary

Threat: public caller uses the embedded MCP as an unintended general service.

Mitigations:

1. per process random internal token generated at startup
2. token stored only in memory
3. internal loopback client supplies the token
4. missing or incorrect token returns generic 404
5. only the product required TCLK tool allowlist is exposed
6. PTLC and adaptor signature actions are not exposed

The server does not configure a user TCLK signing key or payment key.

## TCLK hash secret

Threat: server stores or leaks the acceptance preimage.

Mitigations:

1. secret is stored only in browser IndexedDB
2. no PostgreSQL secret column
3. secret is intentionally revealed only at the protocol reveal step

Browser data loss before reveal can lose the secret.

v1 has no encrypted cross device secret recovery.

## Multi venue history

Threat: a record on one Technocore instance is mistaken for a record on another instance.

Mitigations:

1. venue scoped deal identity
2. room generation aware physical frame identity
3. no global use of room plus seq
4. transport fingerprint when generation is unknown
5. fail closed ambiguous legacy records
6. explicit venue ambiguity response for duplicate offer ids across venues

## Venue switching

Threat: an agreement starts on one venue and continues on another.

Mitigation:

The operational venue must not change while non terminal deals remain on the current venue.

A future hosted return requires a target venue smoke test before `TECHNOCORE_URL` is changed.

## PaperRail

Threat: rehearsal state is represented as payment or escrow.

Mitigations:

1. product mode says `real_value=false`
2. UI labels PaperRail as no real funds
3. Deal Proof proves signed coordination transcript, not payment
4. a real value or testnet rail must be a separate adapter

## Deal room confidentiality

Threat: user assumes a derived TCLK room is private.

Mitigation:

The product must not describe a TCLK deal room as confidential.

Anyone who learns or derives the room name may be able to read it.

## Capacity and abuse

Threat: Technocore room or offer capacity prevents new agreements.

Current production uses a self hosted Technocore venue to avoid depending on shared hosted room capacity.

Self hosted capacity is still finite.

The current deployment has its own configured room creation and total room limits.

Offer discovery can also be degraded by spam.

Future mitigation may include quotas, reputation, moderation or economic controls, but these require separate product and threat review.

## Autonomous execution future

v1 does not run permanently autonomous agents.

A future autonomous runtime introduces new risks:

1. background signing authority
2. unbounded tool or LLM cost
3. long lived credentials
4. unintended side effects
5. external service compromise

A future implementation must use scoped authorization rather than storing the user's master seed on the server.

## Testnet and faucet future

No faucet, wallet, chain, contract or eligibility behavior is assumed until an official interface exists.

A future testnet integration requires separate review for:

1. key custody
2. scoped signing
3. replay protection
4. rate limits
5. token or value semantics
6. settlement finality
7. failure recovery
8. proof semantics

Capability certificates must not automatically become payment authorization.
