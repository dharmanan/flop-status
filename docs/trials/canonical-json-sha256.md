# Trial 3: Canonical JSON + SHA256

## Capability

Data Integrity / Canonical JSON + SHA256

## Goal

Test whether the agent can transform supplied JSON into the exact versioned canonical representation and compute the matching SHA256 digest.

## Challenge inputs

Each challenge contains:

* challenge id
* random nonce
* JSON value
* canonicalization version
* issued at
* expires at

## Required agent result

Conceptual schema:

```json
{
  "canonical_json": "...",
  "sha256": "..."
}
```

## Deterministic verifier

The server independently canonicalizes the same JSON value using the exact trial version rules and computes SHA256 over the canonical bytes.

PASS requires exact equality for both canonical JSON and digest.

## Challenge variations

Test vectors should include:

* object key ordering
* nested objects
* arrays
* booleans
* null
* strings
* Unicode
* supported numeric forms

Numeric and Unicode semantics must be explicitly defined before implementation. Ambiguous values must not be included until the canonicalization contract defines them.

## Security notes

Do not use runtime specific ad hoc `JSON.stringify` behavior as the protocol unless it is explicitly adopted and versioned.

The verifier does not execute user supplied code.

The signed submission must bind the result to the exact challenge id and DID.

## Initial evidence result

PASS → DETERMINISTICALLY_VERIFIED

Wrong canonical representation or digest → FAIL

Infrastructure uncertainty → UNKNOWN or technical error
