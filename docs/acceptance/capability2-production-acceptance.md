# Capability 2 Production Acceptance

Date: 2026-09-01

Capability: `data.canonical-json-sha256`

Production certification trial: `canonical-json-sha256-certification@1`

Historical development trial: `canonical-json-sha256@1`

## Product invariant

Capability 2 is a separate user certification step after Capability 1.

The required journey is:

**ACQUIRE → PRACTICE → VERIFY → CERTIFY → USE → PROVE**

A historical Trial 2 PASS does not unlock, create or count as a production Capability 2 certificate.

## Sequential gate

Capability 2 acquisition MUST be rejected until the same DID has an ACTIVE production Capability 1 certificate.

Expected error:

`PREREQUISITE_CERTIFICATE_REQUIRED`

The browser lock is UX only. The backend MUST enforce the prerequisite independently.

## Acquisition

After Capability 1 certification, the user may explicitly acquire Capability 2.

Expected installed module:

* capability id: `data.canonical-json-sha256`
* capability version: `1`
* module id: `canonical-json-sha256-browser`
* module version: `1`
* runtime: deterministic browser capability
* LLM required: no

Acquisition alone MUST NOT create a certificate.

## Practice

Practice is optional and does not create evidence or certification.

The same versioned capability implementation used for certification and normal FLOP use MUST process the practice fixture.

Practice demonstrates that the module can:

1. serialize a JSON value using RFC 8785 / JCS-compatible deterministic canonicalization
2. compute SHA256 over the UTF-8 bytes of the canonical JSON

## Verification

FLOP issues a fresh DID-bound, one-time production challenge.

The public challenge contains a JSON document but does not contain the expected canonical JSON or expected SHA256 value.

The installed capability implementation receives only the public challenge case and returns:

* `canonical_json`
* `sha256`

The browser-owned DID signs the exact submission payload.

The seed/private key MUST NOT be transmitted.

## Deterministic verifier

The backend verifier independently recomputes:

1. canonical JSON from the public challenge document
2. SHA256 over its UTF-8 bytes

PASS requires both values to match.

Wrong canonical JSON or wrong SHA256 MUST deterministically FAIL.

FAIL MUST NOT create a receipt or capability certificate.

## Certificate

A successful production Capability 2 verification MUST create:

* one server-signed PASS receipt
* one individual Capability 2 certificate
* public certificate proof
* independently verifiable receipt signature

Certificate metadata:

* certificate name: `Canonical JSON + SHA256 Certificate`
* capability version: `1`
* program version: `1`
* verifier: `canonical-json-sha256-verifier@1`

After Capability 2 PASS, an agent that previously held one active production certificate MUST have exactly two active production certificates.

No cumulative rank is unlocked at two certificates.

## Use

After acquisition, the capability can be used inside FLOP on user-supplied JSON.

The Use path MUST call the same `executeCanonicalJsonSha256` implementation used by Practice and Verify.

No public third-party invocation endpoint is added.

## Reload

After page reload, server state MUST restore:

* Capability 1 certificate
* Capability 2 installation state
* Capability 2 certificate if issued
* total certificate count
* correct certificate links

No temporary DOM-only flag may be required to restore certification state.

## Historical evidence isolation

Existing `canonical-json-sha256@1` development receipts remain immutable historical protocol evidence.

They MUST NOT:

* satisfy the Capability 1 prerequisite
* create Capability 2 installation state
* create Capability 2 certificate state
* increase production certificate count
* affect cumulative rank

## Security acceptance

The implementation MUST preserve:

* browser-owned portable Ed25519 identity
* nonextractable active browser private key
* no seed/private key in request bodies
* no seed/private key in localStorage
* existing CSP/security headers
* deterministic verifier only
* no LLM judge

## Completion gate

Capability 2 is complete only after all of the following are verified:

1. Capability 1 certificate prerequisite enforced by backend
2. acquire succeeds after prerequisite
3. practice succeeds without certification
4. production challenge uses `canonical-json-sha256-certification@1`
5. same versioned module is used by Practice, Verify and Use
6. deliberate wrong answer produces FAIL with no certificate
7. correct answer produces PASS and Certificate 2
8. public certificate proof loads
9. receipt signature verifies independently
10. active certificate count becomes two
11. reload restores all state
12. TR/EN product copy is coherent
13. historical Trial 2 evidence remains excluded from production certificate count
