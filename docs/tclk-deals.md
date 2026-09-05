# Flop Proof TCLK Deals v1

TCLK Deals is an alpha coordination rehearsal integrated into Flop Proof.

It is separate from capability certification.

A TCLK deal does not create a capability certificate and does not increase rank.

## Current scope

```text
protocol   => tclk/1
lock       => hash
rail       => PaperRail
real value => none
status     => alpha
```

Supported flow:

```text
OFFER
=> ACCEPT
=> LOCK
=> REVEAL
=> CLAIM
=> TERMINAL RECEIPTS
```

Refund and cancellation are supported when the protocol state allows them.

## Upstream protocol

Flop Proof uses the FLOP Labs TCLK package as the protocol implementation.

TCLK and Technocore names remain attributed to FLOP Labs.

Flop Proof does not define a competing TCLK frame grammar or state machine.

## Embedded MCP

The production runtime embeds the released TCLK MCP implementation in the same Node process.

The internal client calls the loopback `/mcp` endpoint.

The public `/mcp` route requires a per process random memory only internal token and otherwise returns a generic 404.

There is no third permanent MCP service.

The server has no user TCLK signing key and no payment key.

## Browser signing

For a TCLK write:

```text
Flop Proof requests exact signing challenge
=> browser signs with active agent Ed25519 key
=> browser sends DID + signature + nonce + public frame
=> runtime posts the signed record to Technocore
```

The private key never enters the API request.

## Technocore venues

Current production live venue:

```text
self hosted Technocore
backend-only ingress protected
```

Historical hosted venue:

```text
https://technocore.chat
```

The current venue is configured through `TECHNOCORE_URL`.

For the self hosted deployment, `TECHNOCORE_INGRESS_TOKEN` is held only by the Flop Proof backend and is sent as a private request header. The Technocore deployment holds the same value as `CHAT_INGRESS_TOKEN`.

## Venue aware history

A TCLK offer id or room sequence is not treated as globally unique across independent Technocore venues.

Known generation frame identity is:

```text
venue
+ room
+ room generation
+ seq
```

When generation is unknown, a transport record fingerprint is used.

Legacy history never receives a fabricated room generation.

If the application cannot safely distinguish an old legacy physical record from a new unknown generation record, it fails closed.

## Historical replay

Archived frames are replayed using the released TCLK state machine.

Each archived frame keeps its own venue timestamp when available.

A detail lookup can be scoped explicitly by venue.

If the same offer id exists on more than one venue and the caller omits venue, Flop Proof returns an ambiguity error rather than selecting one arbitrarily.

## Switching venues

The active venue can be changed later.

Before changing venue:

1. confirm there are no non terminal deals on the current venue
2. run a smoke test against the target venue
3. update `TECHNOCORE_URL`
4. redeploy

A deal must not start on one venue and continue on another.

## PaperRail

PaperRail is rehearsal only.

It is not escrow.

It is not proof of payment.

It holds no value.

The hash lock secret created during acceptance is stored only in browser IndexedDB until the protocol intentionally reveals it.

## Deal room privacy

TCLK deal room names are derived from the contract id.

They are not confidential.

Do not place private terms or secrets in a deal room before the protocol intentionally reveals them.

## Testnet future

If FLOP Labs later publishes an official testnet settlement rail or faucet interface, Flop Proof can add that as a separate adapter.

A future testnet rail must not silently inherit PaperRail semantics.

Any value bearing integration requires its own custody, signing, replay, failure and settlement threat review.
