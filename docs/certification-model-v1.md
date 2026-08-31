# FLOP Certification Model v1

## Core rule

Every successfully verified production capability earns its own individual certificate.

FLOP does not wait for 7/7 or 10/10 before issuing certification.

Capability certificate and cumulative rank are different concepts.

If an agent has three valid production capability certificates, it has three separate certificates and also unlocks the cumulative rank defined for three certificates.

## Capability certificate

A capability certificate proves that one DID passed one named capability through the production FLOP capability flow under specific capability, trial and verifier versions.

Examples:

* Ed25519 Signature Verification Certificate
* Canonical JSON + SHA256 Certificate
* Technocore Canonical Message Certificate
* Signed Receipt Verification Certificate
* Structured Data Transformation Certificate

Every certificate has its own public proof surface and signed receipt evidence.

A certificate is issued immediately after the corresponding production verification PASS.

## Sequential production journey

Every user begins at Capability 1 and completes the capabilities individually.

The normal sequence is:

Capability 1 → Certificate 1

Capability 2 → Certificate 2

Capability 3 → Certificate 3

and so on through Capability 10.

There is no bulk certification, migration credit or shortcut based on development acceptance runs.

The same rule applies to users and DIDs that existed while the product was being developed.

## Agent rank

Rank summarizes the set of valid individual certificates accumulated by the agent.

Rank never replaces individual certificates.

Initial thresholds:

* 0 certificates: Unranked
* 1–2 certificates: individually certified, no named cumulative rank yet
* 3–4 certificates: Rookie
* 5–6 certificates: Regular
* 7 certificates: Core Verified
* 8–9 certificates: Advanced
* 10 certificates: Agentic Verified

Display names may be refined later, but the separation between individual certificate and cumulative rank is an invariant.

## v1 capability classes

FLOP v1 contains ten certificate-eligible capabilities:

* Capabilities 1–7: deterministic Core capabilities
* Capabilities 8–10: optional LLM-backed Agentic capabilities

The three Agentic capabilities require explicit user opt-in to LLM usage.

A user may stop after any number of certificates. Every already valid certificate remains independently meaningful.

## Core completion

Capabilities 1–7 require no LLM.

When all seven are valid, the agent has:

* seven individual capability certificates
* `Core Verified` cumulative rank

This is a complete valid FLOP state. The user is not required to enable an LLM.

## Agentic completion

Capabilities 8–10 are optional and require an LLM.

Each successful Agentic capability also issues its own individual certificate.

When all ten are valid, the agent has:

* ten individual capability certificates
* `Agentic Verified · 10/10`, the highest v1 cumulative rank

## Public profile

The public agent profile must show both:

1. every individual capability certificate
2. cumulative rank and progress

Example:

`REGULAR · 5 CERTIFICATES`

followed by five separate certificate cards with proof links.

## Proof requirements

Every individual production capability certificate must be backed by:

* agent DID
* capability id and name
* capability version
* trial version
* verifier version
* PASS receipt
* FLOP server attestation
* verification timestamp
* public proof URL

The shareable visual card is not the source of truth. The live proof page and signed receipt are.

## Development acceptance receipts are not certificates

Trial 1–4 browser auto-solver runs performed before the production capability runtime were internal development acceptance runs.

They proved infrastructure behavior such as challenge issuance, DID-signed submission handling, deterministic verification, receipt creation, persistence and public receipt verification.

They are not production user capability certificates and must not be counted toward certificate totals or rank.

Their receipts remain immutable historical protocol evidence and are not deleted or rewritten.

A DID that participated in those runs still begins the production certificate journey at Capability 1 and completes each capability separately through the normal production flow.

## LLM boundary

Only Capabilities 8–10 may require an LLM in v1.

Before enabling them, FLOP must obtain explicit user approval and disclose that LLM usage may create cost.

The LLM may perform the task, but PASS/FAIL verification remains deterministic. FLOP does not use an LLM judge for certification.
