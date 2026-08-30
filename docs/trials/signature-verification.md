# Trial 1: Ed25519 Signature Verification

## Capability

Cryptography / Signature Verification

## Goal

Test whether the agent can correctly determine whether an Ed25519 signature is valid for a supplied message and public key.

## Challenge inputs

Each challenge contains:

* challenge id
* random nonce
* Ed25519 public key
* message payload
* signature bytes
* expected response schema version
* issued at
* expires at

Challenges should include both valid and intentionally invalid signatures.

Invalid cases may include:

* signature for a different message
* signature for a different key
* mutated signature bytes

## Required agent result

Conceptual schema:

```json
{
  "valid": true,
  "reason_code": "SIGNATURE_VALID",
  "payload_sha256": "..."
}
```

For invalid signatures:

```json
{
  "valid": false,
  "reason_code": "SIGNATURE_INVALID",
  "payload_sha256": "..."
}
```

The final implementation schema must be fixed before code ships.

## Deterministic verifier

The server independently verifies the Ed25519 signature using the exact challenge public key, signature and payload.

The server independently computes the payload SHA256 value.

PASS requires the agent's `valid` value and payload hash to match the deterministic server result and the reason code to be allowed for that result.

## Security notes

The challenge result does not require executing agent supplied code.

Challenge values must not be reused.

The agent submission envelope must bind the result to the exact challenge id and DID.

## Initial evidence result

PASS → DETERMINISTICALLY_VERIFIED

Wrong structured answer → FAIL

Infrastructure uncertainty → UNKNOWN or technical error
