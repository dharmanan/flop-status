# FLOP Certification Model v1

## Core rule

Every successfully verified capability earns its own certificate.

FLOP does not wait for 7/7 or 10/10 before issuing certification.

If an agent has passed three distinct certificate-eligible capabilities, it has three individual capability certificates.

Cumulative rank is a separate layer derived from the number and class of valid capability certificates.

## Two separate concepts

### Capability certificate

A capability certificate proves that one DID passed one named capability trial under a specific verifier/program version.

Examples:

* Ed25519 Signature Verification Certificate
* Canonical JSON + SHA256 Certificate
* Signed Receipt Verification Certificate
* Structured Data Transformation Certificate

Each certificate has its own public proof surface and receipt evidence.

### Agent rank

Rank summarizes how many current capability certificates the agent has accumulated and which program requirements it has completed.

Rank never replaces the individual certificates.

An agent at a higher rank still exposes every underlying capability certificate separately.

## v1 capability structure

FLOP v1 contains ten certificate-eligible capabilities:

* seven deterministic Core capabilities
* three optional LLM-backed Agentic capabilities

The three Agentic capabilities require explicit user opt-in to LLM usage.

A user may stop after any number of certificates. Existing valid certificates remain meaningful on their own.

## Cumulative rank model

The semantic model is fixed; display names may be refined later without changing certificate evidence.

Initial rank thresholds:

* 0 certificates: Unranked
* 1–2 certificates: individually certified, no cumulative rank yet
* 3–4 certificates: Rookie
* 5–6 certificates: Regular
* 7 certificates: Core Verified
* 8–9 certificates: Advanced
* 10 certificates: Agentic Verified

The important invariant is that rank is cumulative status, while each successful capability remains an independent certificate.

## Core completion

The first seven certificate-eligible capabilities are deterministic and require no LLM.

When all seven are valid, the agent has:

* seven individual capability certificates
* the `Core Verified` cumulative rank/seal

This is a complete and valid FLOP state. The user is not required to enable LLM features.

## Agentic completion

Capabilities 8–10 are optional LLM-backed Agentic capabilities.

Each successful Agentic capability also issues its own individual capability certificate.

Therefore an agent can have:

* 8 certificates
* 9 certificates
* 10 certificates

without discarding any earlier evidence.

When all ten are valid, the agent receives the highest v1 cumulative rank/seal:

`Agentic Verified · 10/10`

## Public profile

The public agent profile must show both dimensions:

1. individual capability certificates
2. cumulative rank/progress

Example:

`REGULAR · 5 CERTIFICATES`

followed by the five certificate cards and their proof links.

A 3-certificate Rookie profile still exposes all three certificates separately.

A 10/10 Agentic profile exposes all ten certificates separately.

## Proof requirements

Every individual capability certificate must be backed by:

* agent DID
* capability id and name
* capability/trial version
* verifier version
* PASS receipt
* FLOP server attestation
* verification timestamp
* public proof URL

The shareable visual certificate/card is not the source of truth. The live proof page and signed receipt are.

## Current Trial 1–4 acceptance caveat

Existing Trial 1–4 browser auto-solvers have proven the verification protocol and receipt engine.

For final product certification, FLOP must ensure that certificate-eligible results are actually produced through the FLOP agent capability runtime rather than a browser shortcut that computes the answer on behalf of the agent.

Historical receipts remain valid protocol evidence and must not be deleted or rewritten.

## LLM boundary

Only the final three Agentic capabilities may require an LLM in v1.

Before enabling them, FLOP must obtain explicit user approval and disclose that LLM usage may create cost.

The LLM may perform the task, but PASS/FAIL verification remains deterministic. FLOP does not use an LLM judge for certification.
