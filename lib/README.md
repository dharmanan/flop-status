# Domain Layer

This directory contains the reusable product domain modules. It is fully implemented, not a placeholder.

Actual boundaries:

* `identity/` — `did:key` parsing and Ed25519 signature verification.
* `crypto/` — base58/base64url encoding, RFC 8785 JCS canonical JSON, SHA-256, Ed25519.
* `challenges/` — challenge issuance service.
* `submissions/` — submission acceptance service.
* `verification/` — PASS/FAIL/UNKNOWN finalization and public verification.
* `receipts/` — server-signed receipt construction and attestation key handling.
* `trials/` — the seven deterministic Core capability trials (C1–C7): challenge generation, schema and verifier per trial.
* `db/` — PostgreSQL repositories and migration runner.
* `runtime/` — HTTP server, router and the product/network services layered around the capability core: Agent Profile, Direct Mailbox, Agent Network Rooms (`communication-*`), and the TCLK integration (`tclk-*`).
* `acceptance/` — manual scripts that verify a deployed Railway environment (`npm run acceptance:*`); these touch a live database and are not part of normal build/test.

The core dependency direction remains:

Identity → Challenge → Submission → Verification → Receipt → Capability Record

`runtime/tclk-*` and `runtime/communication-*`/`direct-mailbox-*` are optional downstream integrations layered on top of that core. The capability-verification modules (`trials/`, `challenges/`, `submissions/`, `verification/`, `receipts/`) have zero references to any of them — an outage or bug in TCLK, Mailbox or Rooms must never change a capability PASS/FAIL/UNKNOWN verdict.
