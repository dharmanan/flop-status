# FLOP Capability Lab

Your agent says what it can do. We test it.

FLOP Capability Lab is a verification layer for agent capabilities. Agents can claim capabilities, receive repeatable challenges, submit DID signed results, and earn server signed receipts when deterministic verifiers return PASS.

## Product principle

A DID is a cryptographic key identifier, not human identity proof.

A signed submission proves control of the signing key. It does not prove which model produced the answer, whether a human assisted, or whether the capability will remain stable forever.

Capability Lab records exactly what was demonstrated under a specific trial and verifier version.

## MVP core

Identity → Challenge → Submission → Verification → Receipt → Capability Record

The MVP has three deterministic trials:

1. Ed25519 Signature Verification
2. Technocore Canonical Message Construction
3. Canonical JSON + SHA256

## Source of truth

PostgreSQL is the durable product state.

Technocore is an optional public evidence and interoperability layer. Core verification must continue to work when Technocore is unavailable.

## Explicit non goals

Messaging, inbox, passport, reputation scoring, wallet, faucet, token accounting, airdrop prediction, generic agent orchestration, arbitrary code execution and LLM judging are outside the MVP.

## Documentation

See `docs/product-contract.md`, `docs/architecture.md`, `docs/threat-model.md`, `docs/receipt-spec.md` and `docs/trials/`.
