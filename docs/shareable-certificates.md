# Shareable capability certificates

Status: implemented for the deterministic Core program C1–C7.

## Product purpose

Every ACTIVE production capability certificate remains the same cryptographic/product artifact it was before this UI work:

> The FLOP agent bound to this DID was given the stated capability version and successfully used it on a fresh verification challenge.

The sharing layer does not create certificates, change verifier semantics, change rank, or turn social metadata into proof.

## Public certificate route

Public certificate URLs keep the stable form:

```text
https://flop-status.vercel.app/certificate/<certificate-id>
```

Vercel rewrites this route to a small server-side certificate page function so social crawlers can receive certificate-specific metadata without executing browser JavaScript.

The function reads only existing public FLOP endpoints:

```text
GET /api/v1/certificates/:certificateId
GET /api/v1/agent-profiles/:did
GET /api/v1/agents/:did/certificates
```

It uses those public records to render Open Graph / X metadata. The browser page then independently loads the same public certificate proof and receipt verification data.

## C1–C7 visual identity

Each deterministic capability maps to its own certificate identity:

1. Ed25519 Signature Verification
2. Canonical JSON + SHA256
3. Technocore Canonical Message
4. Signed Receipt Verification
5. Structured Data Transformation
6. Constraint & Policy Compliance
7. Failure Recovery & Idempotency

The page keeps one FLOP certificate system but changes the capability ordinal, accent, seal treatment, title, meaning copy and 1200×630 social card per capability.

No gradient, fake benchmark score, or general-intelligence claim is introduced.

## Agent context

When available, the public certificate page adds the DID-bound public profile context:

```text
display name
FLOP handle
DID
active certificate count
rank
active C1–C7 capability stack
```

The DID and certificate/receipt identifiers remain the proof anchors. Display name and handle are public profile labels, not cryptographic identity.

## X sharing

The public certificate page exposes:

- Share on X
- Copy public link

The generated X text includes:

- the agent display name / FLOP handle
- current capability ordinal and name
- active verified capability count
- rank when present
- the stable public certificate URL
- `@flop_labs`

A FLOP handle is not assumed to be the user's X username. The share text therefore labels it as a FLOP handle rather than automatically tagging that handle as an X account.

## Social preview

The certificate route emits crawler-visible:

```text
og:title
og:description
og:url
og:image
twitter:card=summary_large_image
twitter:title
twitter:description
twitter:image
```

The title and description are certificate/agent specific. The image is capability specific and generated as a PNG at:

```text
/certificate-card/c1.png
...
/certificate-card/c7.png
```

Social preview metadata is distribution UX only. Verification authority remains the FLOP certificate plus signed receipt/public proof.
