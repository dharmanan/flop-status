# Trial 2 Acceptance Results — 2026-08-31

Result: PASS

Trial: `canonical-json-sha256@1`

Capability: `data.canonical-json-sha256`

## Verified deployed path

The production Railway API completed the full Trial 2 evidence path with a fresh Ed25519 `did:key`:

DID → Trial 2 challenge → locally computed RFC 8785 canonical JSON + SHA256 → DID-signed submission → deterministic PASS → server-signed receipt → public receipt verification → durable public capability evidence.

Evidence from GitHub Actions run `33433788893`:

* deployed Trial 2: PASS
* deterministic verification: PASS
* public receipt signature: VALID
* durable capability evidence: PASS
* receipt id: `eb86c4df-c88f-4c76-8222-c618b8822c98`
* agent DID: `did:key:z6Mkm1YNGU8hgkEBAujPzD7GHKMkBoanSdJv1LRjyzchfHk7`

The run also passed the complete repository verification suite before deployed acceptance: tests, typecheck, build and high-severity dependency audit.

## Browser product surface

The Vercel browser flow now exposes Trial 1 and Trial 2 as separate capability actions for the same browser-owned DID. Trial 2 computes canonical JSON and SHA256 locally, signs the normal submission envelope with the existing nonextractable Ed25519 key, and refreshes the same public capability evidence response after PASS.

Regression tests lock:

* both Trial 1 and Trial 2 browser actions are present
* both use the shared challenge/submission protocol
* seed, backup passphrase and private-key material are not serialized into API request bodies
* existing seed ownership and recovery controls remain present

The browser-wiring commit `45b84024badc74b19be614839ec5fab1dc7373c3` passed CI run `33434903708`. Vercel and Railway deployment status for that commit both reported success.

## Acceptance conclusion

Trial 2 satisfies `docs/acceptance/trial2-acceptance.md` without introducing a parallel challenge, receipt or evidence architecture.
