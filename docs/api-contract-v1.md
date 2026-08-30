# API Contract v1

## Scope

This API contract covers the Trial 1 vertical slice only.

All routes are JSON unless noted otherwise.

All timestamps are UTC RFC 3339 strings.

All ids are opaque UUID strings unless a stable semantic id is explicitly documented.

Unknown fields in write payloads are rejected.

## Error envelope

All application errors use:

```json
{
  "error": {
    "code": "CHALLENGE_EXPIRED",
    "message": "The challenge has expired.",
    "request_id": "..."
  }
}
```

`message` is for humans.

`code` is stable machine readable behavior.

Capability FAIL is not represented as an HTTP error. A signed, accepted, deterministic submission may produce a normal response with verdict `FAIL`.

## GET /api/v1/capabilities

Returns active capabilities and available trial versions.

Example:

```json
{
  "capabilities": [
    {
      "id": "cryptography.signature-verification",
      "category": "Cryptography",
      "name": "Ed25519 Signature Verification",
      "trials": [
        {
          "trial_id": "ed25519-signature-verification",
          "trial_version": "1"
        }
      ]
    }
  ]
}
```

## GET /api/v1/capabilities/:id

Returns one capability definition and active trial metadata.

404 code:

`CAPABILITY_NOT_FOUND`

## POST /api/v1/challenges

Creates one DID bound challenge.

Request:

```json
{
  "agent_did": "did:key:...",
  "trial_id": "ed25519-signature-verification"
}
```

Success status:

`201 Created`

Response:

```json
{
  "challenge": {
    "challenge_version": "1",
    "challenge_id": "...",
    "agent_did": "did:key:...",
    "capability_id": "cryptography.signature-verification",
    "trial_id": "ed25519-signature-verification",
    "trial_version": "1",
    "nonce": "...",
    "case": {
      "algorithm": "Ed25519",
      "public_key": "...",
      "message": "...",
      "signature": "..."
    },
    "issued_at": "...",
    "expires_at": "..."
  },
  "challenge_hash": "sha256:..."
}
```

The API never returns hidden verifier ground truth.

Expected errors:

`INVALID_DID`

`UNSUPPORTED_DID`

`TRIAL_NOT_FOUND`

`ACTIVE_CHALLENGE_EXISTS`

`RATE_LIMITED`

## GET /api/v1/challenges/:challengeId

Returns durable state for response loss recovery.

Response while issued:

```json
{
  "challenge_id": "...",
  "state": "ISSUED",
  "expires_at": "...",
  "receipt_id": null
}
```

Response after PASS:

```json
{
  "challenge_id": "...",
  "state": "PASS",
  "expires_at": "...",
  "receipt_id": "..."
}
```

Response after FAIL:

```json
{
  "challenge_id": "...",
  "state": "FAIL",
  "expires_at": "...",
  "receipt_id": null
}
```

Response after UNKNOWN:

```json
{
  "challenge_id": "...",
  "state": "UNKNOWN",
  "expires_at": "...",
  "receipt_id": null
}
```

404 code:

`CHALLENGE_NOT_FOUND`

## POST /api/v1/challenges/:challengeId/submissions

Accepts exactly one valid DID signed submission per challenge.

Request:

```json
{
  "payload": {
    "submission_version": "1",
    "canonicalization": "jcs-rfc8785-v1",
    "challenge_id": "...",
    "challenge_hash": "sha256:...",
    "agent_did": "did:key:...",
    "trial_id": "ed25519-signature-verification",
    "trial_version": "1",
    "result": {
      "valid": true,
      "reason_code": "SIGNATURE_VALID",
      "message_hash": "sha256:..."
    },
    "submitted_at": "..."
  },
  "signature": {
    "algorithm": "Ed25519",
    "encoding": "base64url",
    "value": "..."
  }
}
```

The signature covers RFC 8785 canonical UTF-8 bytes of `payload` only.

Success response for PASS:

```json
{
  "challenge_id": "...",
  "state": "PASS",
  "verdict": "PASS",
  "receipt_id": "..."
}
```

Success response for deterministic FAIL:

```json
{
  "challenge_id": "...",
  "state": "FAIL",
  "verdict": "FAIL",
  "receipt_id": null
}
```

Infrastructure uncertainty response may use HTTP 503 with:

`VERIFICATION_UNKNOWN`

The durable challenge state must remain discoverable through GET challenge.

Expected errors before verifier execution:

`INVALID_SUBMISSION_SCHEMA`

`CHALLENGE_NOT_FOUND`

`CHALLENGE_EXPIRED`

`CHALLENGE_ALREADY_CONSUMED`

`CHALLENGE_BINDING_MISMATCH`

`INVALID_AGENT_SIGNATURE`

`UNSUPPORTED_DID`

These errors must not create capability FAIL evidence.

## GET /api/v1/receipts/:receiptId

Returns the stored receipt object.

Example:

```json
{
  "receipt": {
    "receipt_version": "1",
    "receipt_id": "...",
    "agent_did": "did:key:...",
    "capability_id": "cryptography.signature-verification",
    "trial_id": "ed25519-signature-verification",
    "trial_version": "1",
    "challenge_id": "...",
    "challenge_hash": "sha256:...",
    "result_hash": "sha256:...",
    "verifier_id": "ed25519-signature-verifier",
    "verifier_version": "1",
    "verdict": "PASS",
    "evidence_type": "DETERMINISTICALLY_VERIFIED",
    "issued_at": "...",
    "server_key_id": "...",
    "server_signature": "..."
  }
}
```

404 code:

`RECEIPT_NOT_FOUND`

## GET /api/v1/verification/:receiptId

Public verification oriented response.

The server may include convenience verification status, but the browser verification page must also possess enough public material to verify the receipt signature rather than blindly trusting a boolean returned beside the receipt.

Example:

```json
{
  "receipt": {},
  "server_key": {
    "key_id": "...",
    "algorithm": "Ed25519",
    "public_key": "...",
    "encoding": "base64url",
    "status": "ACTIVE"
  }
}
```

## GET /api/v1/server-keys

Returns public attestation keys required to verify current and historical receipts.

Example:

```json
{
  "keys": [
    {
      "key_id": "capability-lab-attestation-2026-01",
      "algorithm": "Ed25519",
      "public_key": "...",
      "encoding": "base64url",
      "status": "ACTIVE",
      "valid_from": "...",
      "valid_until": null
    }
  ]
}
```

Private key material is never returned.

## GET /api/v1/agents/:did

Returns public agent summary.

A row means the DID has interacted with Capability Lab. It does not imply verified human identity.

Example:

```json
{
  "agent": {
    "did": "did:key:...",
    "capabilities": [
      {
        "capability_id": "cryptography.signature-verification",
        "evidence_type": "DETERMINISTICALLY_VERIFIED",
        "passed_trials": 1,
        "latest_receipt_id": "..."
      }
    ]
  }
}
```

## GET /api/v1/agents/:did/capabilities

Returns capability evidence summaries and receipt references for the DID.

Claims, when later added, must be represented separately from deterministic verified evidence.

## HTTP status guidance

`200` successful reads and completed submission verdicts

`201` challenge creation

`400` invalid schema or malformed identifier

`401` invalid agent signature where authentication semantics are appropriate

`404` missing resource

`409` active challenge exists, consumed challenge or binding conflict

`410` expired challenge may be used instead of 409 when route semantics benefit from explicit expiry

`413` payload too large

`429` rate limited

`503` verification infrastructure uncertainty

Status selection must remain consistent once implementation begins.

## Payload limits

Write endpoints must have explicit limits.

Initial target:

Challenge creation request: 8 KiB maximum

Trial 1 submission request: 32 KiB maximum

These limits are product configuration and can be revised before public launch without changing cryptographic receipt semantics.

## Idempotency and retries

Challenge submission is not generally repeatable.

A client that loses the HTTP response must query `GET /api/v1/challenges/:challengeId` instead of sending the same submission again.

Future API versions may add an explicit idempotency key, but it is not required for Trial 1 if database challenge consumption is race safe and recovery reads are implemented.

## Technocore

There is no Technocore dependency in any route required for Trial 1 PASS.

Future Technocore publication endpoints must be downstream of stored receipts and must not change the meaning of this API contract.
