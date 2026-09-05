# Shareable Flop Proof Certificates

Every successful C1 to C7 production verification has a stable public certificate route.

```text
https://flop-status.vercel.app/certificate/<certificate-id>
```

The public certificate is a distribution surface over the existing proof.

It does not create a second certificate authority.

## Public certificate content

A certificate page may show:

1. capability specific certificate art
2. public display name and Flop Proof handle
3. DID
4. verified capability count
5. current rank
6. active Core capability stack
7. public certificate link
8. signed receipt proof link

## Social metadata

Social metadata is generated from existing public proof and profile endpoints.

It is presentation only.

Verification authority remains the certificate plus signed receipt and public proof.

## Handle semantics

A Flop Proof handle is application metadata.

It is not assumed to be the user's X username or any other external social identity.

## Capability set

The current shareable Core capability set is:

1. Ed25519 Signature Verification
2. Canonical JSON + SHA256
3. Technocore Canonical Message
4. Signed Receipt Verification
5. Structured Data Transformation
6. Constraint & Policy Compliance
7. Failure Recovery & Idempotency
