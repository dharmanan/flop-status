# Production Capability 1 Acceptance

Capability: Ed25519 Signature Verification

Program class: Core

LLM required: No

Certificate eligible: Yes

## Purpose

This acceptance contract proves the first real FLOP product capability slice.

It is intentionally different from the earlier Trial 1 development acceptance harness.

The production user must acquire the capability, practice it, verify it through the installed FLOP capability implementation, receive an individual certificate, use the same implementation inside FLOP and independently verify the proof.

## Required user sequence

The sequence is mandatory and user-visible:

1. Identity ready
2. Capability 1 available, not acquired
3. Acquire Capability 1
4. Capability 1 installed
5. Optional/available practice
6. Start production verification
7. Installed capability runtime solves fresh challenge
8. Browser-owned DID signs exact submission
9. Deterministic verifier returns PASS or FAIL
10. PASS creates immutable receipt
11. PASS creates Ed25519 Signature Verification Certificate
12. Public proof verifies independently
13. Same installed capability can be used from a normal FLOP use action

No bulk activation or credit from previous development runs is allowed.

## Identity requirements

* Existing accepted browser-owned Ed25519 `did:key` identity model remains unchanged.
* Portable seed remains user-owned.
* Active private signing key remains client side and nonextractable where supported.
* No seed, private key or recovery material is sent to Railway, Vercel server code or PostgreSQL.
* An existing DID may be reused, but its prior development acceptance receipts do not count as production certificates.

## Capability installation requirements

Before acquisition:

* Capability 1 installation state is `AVAILABLE` or equivalent, not installed.
* No production certificate exists merely because historical Trial 1 evidence exists.

On acquisition:

* FLOP records the agent-to-capability installation/reference with an explicit capability/module version.
* Capability implementation code is not duplicated per agent.
* Acquisition itself does not create a PASS receipt or certificate.
* Acquisition requires no LLM and no API key.

## Practice requirements

* Practice uses the installed Capability 1 implementation.
* Practice receives a bounded non-certificate fixture.
* Practice result is visibly PASS/FAIL or equivalent learning feedback.
* Practice never creates a server-signed production capability receipt.
* Practice never creates or increments certificate count or rank.

## Production verification requirements

* Verification cannot start unless Capability 1 is installed.
* FLOP issues a fresh, unpredictable, DID-bound, expiring, one-time challenge.
* The installed Capability 1 runtime receives only the public challenge fields needed to solve it.
* The same versioned signature-verification implementation used by normal FLOP `USE` produces the result.
* The page must not contain a separate test-specific answer solver that bypasses the installed capability runtime.
* The browser-owned DID signs the exact canonical submission envelope.
* Existing strict schema, challenge binding, expiry, one-time-use and signature checks remain enforced.
* Correct runtime result deterministically produces PASS.
* A deliberately wrong structurally valid result deterministically produces FAIL without a certificate.
* Infrastructure uncertainty remains UNKNOWN/technical error, never false FAIL.

## Production-version separation

Development Trial 1 receipts and production Capability 1 certification must be distinguishable in durable state.

The production flow must use explicit certificate-eligible program/capability/trial version metadata or an equivalent durable discriminator.

Historical development receipts:

* remain immutable
* remain publicly verifiable as historical protocol evidence
* do not create production certificate records
* do not count toward production certificate totals
* do not affect cumulative rank

## Certificate requirements

A production PASS immediately creates one individual certificate:

`Ed25519 Signature Verification Certificate`

The certificate record must bind at minimum:

* certificate id
* agent DID / agent id
* capability id
* capability version
* program version
* trial id and production trial version
* verifier id and version
* PASS receipt id
* issued/verified timestamp
* current certificate status

The certificate must not be inferred merely from `capability_records.passed_trials > 0`, because historical development acceptance evidence exists.

## Public certificate proof

The certificate must have a public URL that works without login.

The public proof must show at minimum:

* certificate name
* agent DID
* capability id/name
* certificate/program/capability/trial/verifier versions
* PASS state
* verification timestamp
* receipt id
* FLOP server attestation status
* link to/opening of underlying receipt verification

Independent verification must validate the underlying signed receipt using FLOP public server-key material.

## Certificate count and rank

After the first production certificate:

* certificate count = 1 for this production journey if no other production certificates exist
* rank remains the v1 state for 1 certificate, with no named cumulative rank yet
* historical Trial 1–4 development receipts do not increase the count

## Normal FLOP use requirement

After acquisition, the user must have a normal FLOP action for Capability 1 separate from the certification challenge.

Example behavior:

* user supplies a message, Ed25519 public key and signature inside FLOP
* installed Capability 1 implementation returns validity, reason code and message hash

This use action:

* uses the same core implementation as verification
* does not itself create another certificate
* is explicit user-initiated FLOP execution
* requires no LLM
* is not exposed as an arbitrary third-party public agent invocation endpoint

## Failure and retry requirements

* A failed production challenge does not create a certificate.
* A retry uses a fresh challenge.
* Duplicate/lost-response handling preserves existing one-time challenge safety.
* Re-running an already certified capability may later support re-certification/version upgrade, but v1 must not create duplicate current certificates for the same agent/capability/program version accidentally.

## Persistence requirements

Durable state must distinguish at least:

* installed capability state
* development verification evidence
* production certificate-eligible verification evidence
* individual capability certificate record

Certificate implementation must not require one database copy of capability code per agent.

## Security requirements

* no arbitrary user code execution
* no LLM
* no uncontrolled external network dependency
* no private identity material server side
* deterministic verifier remains versioned
* receipt remains immutable
* certificate references proof; it does not replace proof

## Browser acceptance

A clean production browser acceptance must demonstrate in order:

1. same user-owned DID starts with zero production certificates despite historical development evidence
2. Capability 1 is acquired individually
3. practice completes without certificate creation
4. production verification PASS completes
5. exactly one production certificate appears
6. certificate public proof opens and verifies independently
7. normal Capability 1 use works with a user-provided fixture

Only after all seven steps pass may Production Capability 1 be declared complete and Capability 2 implementation begin.
