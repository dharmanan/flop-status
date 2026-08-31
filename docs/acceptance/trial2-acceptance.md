# Trial 2 Acceptance — Canonical JSON + SHA256

## Goal

Prove that an agent can deterministically canonicalize structured JSON using RFC 8785 JCS and return the exact SHA256 digest of the canonical UTF-8 bytes.

Trial 2 must reuse the accepted FLOP evidence path:

Identity → Challenge → DID-signed Submission → Deterministic Verification → Server-signed Receipt → Capability Record → Public Verification.

No parallel receipt or evidence architecture is allowed.

## Capability

Capability id:

`data.canonical-json-sha256`

Trial id:

`canonical-json-sha256`

Trial version:

`1`

Verifier id:

`canonical-json-sha256-verifier`

Verifier version:

`1`

## Challenge requirements

PASS only if the server-issued challenge:

1. is bound to a supported Ed25519 `did:key`
2. has a unique UUID challenge id and unpredictable nonce
3. expires after the normal challenge TTL
4. contains a JSON document that is safe to expose publicly
5. covers deterministic case classes including nested objects, Unicode keys/values, mixed arrays and numeric edge cases
6. stores expected canonical JSON and SHA256 only in hidden verifier context
7. hashes the public challenge with the existing RFC 8785 challenge-hash rule

## Submission requirements

The agent result must contain exactly:

* `canonical_json`
* `sha256`

The submission envelope must preserve the existing fields and DID signature semantics:

* submission version
* canonicalization id
* challenge id/hash
* agent DID
* trial id/version
* result
* submitted timestamp
* Ed25519 signature over RFC 8785 canonical bytes of the submission payload

Schema/signature/binding errors are request or identity errors, not capability FAIL.

## Deterministic verifier requirements

PASS only if:

1. the verifier independently recomputes RFC 8785 JCS from the persisted public challenge document
2. the hidden expected canonical JSON agrees with that recomputation
3. the hidden expected SHA256 agrees with SHA256 of the canonical UTF-8 bytes
4. the submitted `canonical_json` matches byte-for-byte
5. the submitted `sha256` matches exactly

Deterministic mismatch reason codes:

* `CANONICAL_JSON_MISMATCH`
* `SHA256_MISMATCH`

Successful reason code:

* `EXPECTED_RESULT_MATCH`

Infrastructure uncertainty remains UNKNOWN, never FAIL.

## Persistence and evidence requirements

A PASS must:

1. persist one verification run
2. mark the challenge PASS
3. create one FLOP server-signed receipt using the existing receipt format
4. upsert the agent capability record for `data.canonical-json-sha256`
5. expose the receipt through the existing public receipt API
6. expose Trial 2 evidence in the existing public agent capability response

A deterministic FAIL must not create a verified receipt or increment verified capability evidence.

## Replay, race and recovery requirements

Trial 2 inherits the accepted Trial 1 rules:

* one active ISSUED challenge per agent/trial
* one accepted submission per challenge
* race-safe challenge consumption
* expired challenges cannot produce PASS/FAIL capability evidence
* lost HTTP response is recovered through GET challenge state rather than resubmitting a consumed challenge

## Browser/agent behavior

For a browser-owned identity, FLOP may compute the Trial 2 result locally and sign the submission with the nonextractable active key.

For an external agent, the same public challenge/submission API must work without FLOP key custody.

No seed, private key or passphrase may be transmitted.

## Automated minimum

CI must cover at minimum:

1. all four Trial 2 challenge case classes
2. valid schema acceptance and strict unknown-field rejection
3. exact canonical JSON PASS
4. canonical JSON mismatch FAIL
5. SHA256 mismatch FAIL
6. hidden verifier-context tamper rejection
7. DID binding/signature acceptance through the shared submission layer after Trial 2 is wired
8. PASS receipt/capability finalization after Trial 2 is wired
9. deterministic FAIL without receipt after Trial 2 is wired
10. public evidence aggregation after Trial 2 is wired

## Completion statement

Do not mark Trial 2 complete until the full deployed vertical slice passes:

DID → Trial 2 challenge → DID-signed canonical JSON/SHA256 result → deterministic PASS/FAIL → server-signed receipt → refresh persistence → public verification.
