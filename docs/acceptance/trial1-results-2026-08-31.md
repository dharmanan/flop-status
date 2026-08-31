# Trial 1 Deployed Acceptance Results

Date: 2026-08-31

Status: PASS

## Completion statement

Trial 1 is complete for the deployed milestone described by `docs/acceptance/trial1-acceptance.md`.

The accepted vertical slice is:

Fresh browser → Ed25519 `did:key` → unique challenge → DID-signed submission → deterministic PASS/FAIL with separate UNKNOWN semantics → persisted server-signed receipt → refresh persistence → separate clean-browser public verification.

## Environment

Backend: Railway

PostgreSQL: Railway PostgreSQL

Frontend: Vercel

Technocore: deliberately unreachable during independence acceptance

## Gate results

* Gate A repository and configuration: PASS
* Gate B agent key custody: PASS
* Gate C challenge issuance: PASS
* Gate D valid agent submission signature: PASS
* Gate E signature tamper rejection: PASS
* Gate F DID binding: PASS
* Gate G deterministic PASS: PASS
* Gate H deterministic FAIL: PASS
* Gate I expired challenge: PASS
* Gate J replay and race: PASS
* Gate K UNKNOWN semantics: PASS
* Gate L receipt cryptography: PASS
* Gate M refresh persistence: PASS
* Gate N separate clean browser: PASS
* Gate O Technocore independence: PASS
* Gate P clean database rebuild: PASS

## Browser matrix

### Chrome desktop

PASS

Verified:

* Ed25519 browser identity creation
* nonextractable private key custody
* IndexedDB persistence
* Trial 1 PASS
* durable evidence recovery after hard refresh
* browser receipt signature verification

### Safari desktop

PASS

Verified:

* Ed25519 browser identity creation
* nonextractable private key custody
* IndexedDB persistence
* Trial 1 PASS
* same DID preserved after refresh
* durable server evidence recovery after refresh
* browser receipt signature verification as `VALID`

### Mobile Safari on iPhone

PASS

Verified:

* Ed25519 browser identity creation
* nonextractable private key custody
* IndexedDB persistence
* Trial 1 PASS
* durable server evidence recovered after refresh
* public receipt page loaded successfully
* browser receipt signature verification as `VALID`

No browser-specific custody fallback was required in the tested milestone matrix.

## Clean browser verification

A previously issued receipt was opened directly in a fresh Chrome Incognito context containing no normal-browser FLOP local state or agent private key.

Result: `Receipt signature: VALID`.

The receipt displayed the same agent DID, capability, trial version, verifier version, challenge hash, result hash, issue time and server key metadata.

## Clean database rebuild

A temporary empty PostgreSQL database was created on Railway and used for acceptance.

Verified:

* migrations from zero: PASS
* Trial 1 seed exactly once: PASS
* application startup: PASS
* server public signing key metadata initialization: PASS
* full Trial 1 successful flow: PASS
* public receipt verification: PASS
* manual database patching required: NO
* production database used by acceptance flow: NO
* temporary database cleanup: PASS

## Technocore independence

During the clean-database acceptance flow, Technocore access was deliberately configured as unreachable.

Challenge issuance, signed submission acceptance, deterministic verification, receipt generation, persistence and public verification all still passed.

## Security invariants demonstrated

* agent private signing key is nonextractable in the tested browser path
* agent private signing key is not transferred to the backend
* server attestation private key is supplied through Railway secret configuration
* server attestation private key is not stored in PostgreSQL
* public APIs expose only public signing-key metadata
* signed-field tampering does not create capability FAIL
* DID mismatch does not consume a valid challenge
* expired challenges cannot produce PASS or capability FAIL
* exactly one concurrent submission consumes a challenge
* deterministic FAIL does not create a verified receipt or increment capability evidence
* UNKNOWN is distinct from FAIL
* receipt tampering invalidates the server signature

## Remaining work after Trial 1

Trial 1 protocol acceptance is complete, but the current Vercel frontend remains an acceptance shell. Product UI, user-facing copy, branding, information architecture and later trials are separate future work and are not part of this completion statement.
