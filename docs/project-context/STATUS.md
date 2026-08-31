# Project Status

Last updated: 2026-08-31

## Current phase

Trial 1 deployed protocol acceptance is complete.

The accepted protocol milestone is:

Identity → Challenge → DID signed Submission → Deterministic Verification → Server signed Receipt → Public Verification.

Product MVP is not complete. The identity ownership/connectivity implementation is now present on `main` and is awaiting deployed acceptance against `docs/acceptance/identity-ownership-acceptance.md`.

## Completed

* Product, architecture, threat model, receipt, PostgreSQL, API and Trial 1 acceptance contracts defined.
* Persistent AI workflow rules added through root `AGENTS.md`.
* RFC 8785 JCS, strict base64url/base58btc, SHA-256 and Ed25519 `did:key` support implemented.
* Trial 1 challenge generator implemented with public payload and hidden verifier context separated.
* VALID_SIGNATURE and INVALID_SIGNATURE cases implemented without malformed-input shortcuts.
* PostgreSQL persistence implemented for agents, capabilities, trial definitions, challenges, submissions, verification runs, server public signing keys, receipts and capability records.
* Race-safe challenge issuance implemented with transaction advisory locking and a partial unique index.
* Real `pg` adapter retains one checked-out PostgreSQL connection across each transaction.
* Foundation, submission and receipt migrations verified against real Railway PostgreSQL.
* Real Railway PostgreSQL concurrent challenge issuance and one-ISSUED invariant verified.
* DID-signed submission acceptance, canonical payload/result hashes, one submission per challenge and sequential replay protection verified against real Railway PostgreSQL.
* Deterministic PASS verified against real Railway PostgreSQL.
* Atomic PASS finalization, verification-run persistence, exactly one receipt and capability-record derivation verified against real Railway PostgreSQL.
* Receipt signature validation and tamper detection verified; server private attestation key is not persisted in PostgreSQL.
* Public receipt, verification, server-key and agent-evidence JSON APIs implemented on Railway.
* Persistent Ed25519 attestation signer configured through Railway service secrets. Only derived public key metadata is persisted and published.
* Real deployed HTTP write path implemented and verified on Railway: challenge creation, durable challenge recovery, signed submission POST, deterministic PASS, receipt generation and public receipt verification.
* Deterministic FAIL and UNKNOWN semantics verified on Railway.
* Signed-field tamper rejection, DID binding, expired challenge replacement, sequential replay and concurrent submission race acceptance passed on Railway.
* Railway is backend only. Product HTML/CSS/browser JavaScript is not served by Railway.
* Chrome desktop, Safari desktop and Mobile Safari on iPhone Trial 1 browser matrix passed.
* Clean-browser public receipt verification passed.
* Technocore independence passed while Technocore was deliberately unreachable.
* Clean empty PostgreSQL rebuild passed without manual patching and the temporary acceptance database was verified deleted.
* Full deployed Trial 1 acceptance results are recorded in `docs/acceptance/trial1-results-2026-08-31.md`.
* Identity architecture reference to `PranjalBoraCrypto/overheard` is recorded in `docs/references/overheard.md`.
* Browser-owned identity creation now produces an encrypted portable recovery backup and re-imports the active signing key as a nonextractable IndexedDB `CryptoKey`.
* Encrypted backup restore now reconstructs the same DID locally and keeps the restored active private key nonextractable.
* Existing supported Ed25519 `did:key` identities can now be connected without FLOP receiving private key material.
* Existing-DID Trial 1 flow now exposes the exact canonical payload for an external signer, accepts only the resulting Ed25519 signature, verifies that signature locally against the connected DID, and then uses the same Railway submission protocol.
* Vercel key-custody surface now has a strict CSP, no third-party script permission, bounded Railway API connectivity, `no-referrer`, and `nosniff` headers in repository configuration.
* Automated browser identity tests cover encrypted backup round trip, same-DID restore, nonextractable active keys, wrong-passphrase failure and unsupported DID rejection.
* Automated Vercel security test locks the key-custody CSP requirements.
* Railway backend deployment: `https://flop-status-production.up.railway.app`.
* Vercel frontend deployment: `https://flop-status.vercel.app`.

## In progress

Identity ownership/connectivity deployed acceptance, before Trial 2 or final product UI:

* Gate IA browser-owned creation on deployed Vercel
* Gate IB refresh persistence with the new portable identity model
* Gate IC encrypted backup properties
* Gate ID clean-browser restore to the exact same DID and successful new Trial 1
* Gate IE existing external DID plus external signature PASS path
* Gate IF direct external Agent API path
* Gate IG deployed custody/CSP and no-key-leak boundary

Acceptance source of truth: `docs/acceptance/identity-ownership-acceptance.md`.

Reference architecture: `docs/references/overheard.md`.

## Next after identity milestone

* Trial 2: Technocore Canonical Message Construction
* Trial 3: Canonical JSON + SHA256
* CLAIM/UNTESTED flow
* real IDENTIFY → CLAIM → TRIALS → RECORD information architecture
* premium Vercel product UI and user-facing copy

## Known problems

* The Vercel UI is still an acceptance shell, not the final product UI or final user-facing copy.
* Identity ownership/connectivity code has automated verification, but the new create/backup/restore/external-signer paths have not yet completed deployed browser acceptance.
* `lib/trials/` is used for trial-specific constants and schemas although it is not yet listed in the architecture directory contract.
* Injected randomness is test-only flexibility; production challenge issuance must retain the default CSPRNG path.

## Blocked

None currently known.

## Important current state

Trial 1 protocol acceptance is complete, but Product MVP is not complete.

Do not call the identity ownership/connectivity milestone complete until `docs/acceptance/identity-ownership-acceptance.md` passes with deployed evidence.

Do not call Product MVP complete until the active product contract is met, including create/connect DID, encrypted backup/restore, external signer/API support and all three initial deterministic trials.

Future work must preserve the accepted Trial 1 protocol invariants unless a versioned architecture/product decision explicitly changes them.
