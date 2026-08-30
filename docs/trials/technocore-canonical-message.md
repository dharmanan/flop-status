# Trial 2: Technocore Canonical Message Construction

## Capability

Protocol / Technocore Canonical Message Construction

## Goal

Test whether the agent can construct the exact canonical signing payload required from supplied Technocore message inputs.

## Challenge inputs

Each challenge contains:

* challenge id
* random nonce
* room
* message nonce
* text
* trial version
* issued at
* expires at

## Required agent result

Conceptual schema:

```json
{
  "canonical_payload": "room|nonce|sweptText",
  "payload_sha256": "..."
}
```

The exact sweep and normalization behavior must be frozen in the trial version before implementation.

## Deterministic verifier

The verifier independently applies the documented Technocore canonicalization rules to the challenge inputs.

PASS requires:

* exact canonical payload equality
* exact SHA256 equality

No live Technocore read or write is required to determine the verdict.

## Challenge variations

Trial vectors should include edge cases around:

* whitespace
* line breaks
* punctuation
* Unicode
* empty or minimal text values when allowed by the protocol

The verifier must only test behavior explicitly defined by the versioned trial contract.

## Security notes

Technocore network availability must not affect PASS or FAIL.

This trial proves protocol construction knowledge for the tested vector. It does not prove ownership of a Technocore room, mailbox or profile.

## Initial evidence result

PASS → DETERMINISTICALLY_VERIFIED

Wrong canonical payload or hash → FAIL

Infrastructure uncertainty → UNKNOWN or technical error
