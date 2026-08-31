# Trial 3 Acceptance — Technocore Canonical Message Construction

## Goal

Prove that an agent can construct the exact canonical message string used by the inspected Technocore signing implementation without making Technocore availability part of FLOP verification.

Reference implementation:

`dharmanan/technocore-agent-console/lib/technocore.ts`

The reference behavior is:

1. clean the message text by replacing control characters, C1 controls, U+2028 and U+2029 with spaces
2. collapse whitespace runs to one ASCII space
3. trim leading/trailing whitespace
4. construct the exact string `room|nonce|cleaned text`
5. sign that string with the sender key

The sender DID is carried separately by the Technocore protocol and is not part of this canonical signing string. FLOP still binds its challenge and signed submission to the agent DID.

## Capability

Capability id:

`protocol.technocore-canonical-message`

Trial id:

`technocore-canonical-message`

Trial version:

`1`

Verifier id:

`technocore-canonical-message-verifier`

Verifier version:

`1`

## Challenge requirements

PASS only if the server-issued challenge:

1. is bound to a supported Ed25519 `did:key`
2. has a unique UUID challenge id and unpredictable nonce for FLOP replay protection
3. expires after the normal challenge TTL
4. contains a public Technocore fixture with `room`, Technocore `nonce` and raw `text`
5. covers deterministic cleaning cases including whitespace/control cleanup, Unicode and pipe characters in message text
6. stores expected cleaned text and expected canonical message only in hidden verifier context
7. never calls Technocore to determine ground truth

The Technocore fixture nonce is distinct from FLOP's top-level challenge nonce. The fixture nonce is input to the canonical message; the FLOP challenge nonce protects the FLOP challenge itself.

## Submission requirements

The agent result must contain exactly:

* `cleaned_text`
* `canonical_message`

The normal FLOP submission envelope remains unchanged:

* submission version
* RFC 8785 canonicalization id
* FLOP challenge id/hash
* agent DID
* trial id/version
* result
* submitted timestamp
* Ed25519 signature over RFC 8785 canonical bytes of the submission payload

Schema/signature/binding errors are request or identity errors, not capability FAIL.

## Deterministic verifier requirements

The verifier independently applies the inspected Technocore cleaning rule to the persisted public fixture and reconstructs `room|nonce|cleaned text`.

PASS only if:

1. persisted hidden cleaned text agrees with independent recomputation
2. persisted hidden canonical message agrees with independent recomputation
3. submitted `cleaned_text` matches exactly
4. submitted `canonical_message` matches byte-for-byte

Deterministic mismatch reason codes:

* `CLEANED_TEXT_MISMATCH`
* `CANONICAL_MESSAGE_MISMATCH`

Successful reason code:

* `EXPECTED_RESULT_MATCH`

Persisted verifier-context inconsistency is an internal verifier error and must become UNKNOWN through the existing recovery path, not capability FAIL.

## Persistence and evidence requirements

A PASS must reuse the existing evidence engine:

1. persist one verification run
2. mark the challenge PASS
3. create one FLOP server-signed receipt
4. upsert the capability record for `protocol.technocore-canonical-message`
5. expose the receipt through the existing public receipt API
6. expose Trial 3 evidence in the existing public agent response

A deterministic FAIL must not create a verified receipt or increment verified capability evidence.

## Independence requirement

Core Trial 3 PASS/FAIL/UNKNOWN must not depend on `technocore.chat`, Technocore rooms, notes or archive availability.

This trial proves protocol-compliant construction against a versioned reference rule; it does not prove that a message was actually posted to Technocore.

## Automated minimum

CI must cover at minimum:

1. all Trial 3 cleaning/canonical fixture classes
2. strict schema acceptance and unknown-field rejection
3. exact canonical PASS
4. cleaned text mismatch FAIL
5. canonical message mismatch FAIL
6. hidden verifier-context tamper rejection
7. DID-bound signed submission through the shared submission layer after wiring
8. PASS receipt/capability finalization after wiring
9. deterministic FAIL without receipt after wiring
10. Technocore-independent verification

## Completion statement

Do not mark Trial 3 complete until the deployed vertical slice passes:

DID → Trial 3 challenge → DID-signed canonical-message result → deterministic PASS/FAIL → server-signed receipt → durable capability evidence → public verification.
