# Security Policy

## Supported version

Security fixes currently target the latest production version of Flop Proof.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could expose private keys, signing material, authentication or ingress credentials, private messages, certificate integrity, replay protection, TCLK secrets, or production infrastructure.

Use GitHub private vulnerability reporting if it is available for this repository.

If private vulnerability reporting is not available, contact the maintainer through:

https://koraycifci.com

Include enough information to reproduce and assess the issue, but do not include user private keys, recovery seeds, production credentials, or unrelated personal data.

## Security boundaries

Flop Proof is designed so that user Ed25519 private keys and recovery seeds remain browser owned and are not sent to the application server.

The current TCLK integration is alpha PaperRail rehearsal only and moves no real value.

The self hosted Technocore transport is protected by a backend-only ingress credential. That credential must never be placed in browser code, URLs, public logs, screenshots, issues, or documentation.
