# Identity Ownership Acceptance Results — 2026-08-31

Source contract: `docs/acceptance/identity-ownership-acceptance.md`

Reference: `PranjalBoraCrypto/overheard`

Status: PASS

Environment:

* Frontend: `https://flop-status.vercel.app`
* Backend: `https://flop-status-production.up.railway.app`
* Browser acceptance performed manually against deployed Vercel on 2026-08-31.
* External Agent API deployed acceptance executed from GitHub Actions against the public Railway API on 2026-08-31.

Public browser test DID:

`did:key:z6Mkm1gZwfKqaa5GGZbSYLoG6QCUDQ9jNepgMvSujv4rDgnR`

No seed, private key, passphrase or encrypted recovery content is recorded in this document.

## Gate IA — browser-owned creation and seed ownership

Status: PASS

Observed on deployed Vercel:

* fresh browser explicitly created a new Ed25519 `did:key`
* portable 32-byte seed was presented before continuation and hidden by default
* Reveal, Copy and `.txt` Download controls were present
* `I've saved my seed` remained disabled until Copy or Download was used
* user confirmed seed saving before entering capability tests
* the created identity completed Trial 1 with PASS
* a server-signed receipt was produced and independently verified as VALID in the browser

Receipt observed during this run:

`50f57acd-6043-449d-96a9-0f4794d6f99e`

Custody evidence:

* active browser signing keys are imported nonextractable
* the deployed refresh path runs `normalizedIdentity()` against the IndexedDB record and rejects any recovered private key whose `extractable` property is true
* the successful deployed refresh therefore exercised the nonextractable recovered-key check
* browser identity tests independently verify created and restored active keys remain nonextractable
* browser network-boundary regression tests verify challenge creation sends only public DID/trial fields and submissions send only the signed payload/signature envelope
* prior deployed Trial 1 acceptance already demonstrated that the agent private signing key is not transferred to the backend

## Gate IB — refresh persistence

Status: PASS

Observed after returning to the main FLOP page and refreshing:

* exact same public DID recovered
* recovered IndexedDB private key passed the runtime nonextractable check
* previously verified `cryptography.signature-verification` evidence recovered from Railway
* latest verified receipt remained available

## Gate IC — seed/text-file portability

Status: PASS

User manually verified in a clean browser context that the downloaded identity `.txt` file can be selected through `I already have one`, reconstructing the identity successfully.

The implementation and automated tests require seed/text-file restoration to derive the exact same DID and import the active signing key as nonextractable.

The restored identity completed the normal Trial 1 path under the same DID.

No secret material was shared back during the manual acceptance run.

## Gate ID — optional encrypted backup

Status: PASS

Automated coverage verifies:

* AES-GCM encrypted backup
* PBKDF2-SHA256 key derivation
* no plaintext seed or passphrase in serialized backup
* wrong-passphrase failure
* exact same DID restoration
* nonextractable restored active key

Deployed browser acceptance additionally verified:

* encrypted backup creation on Vercel
* clean-browser restore using backup plus passphrase
* restoration of the same DID
* Trial 1 PASS after encrypted-backup restore

No backup contents or passphrase were shared back during acceptance.

## Gate IE — external signer semantics

Status: PASS

Consumer UI no longer exposes manual canonical-payload signing controls.

A dedicated external Agent API acceptance runner generated an Ed25519 identity outside FLOP browser custody and exercised the deployed Railway API.

Verified:

* declaring the DID and creating a challenge did not create verified capability evidence
* a submission signed by the wrong external key was rejected with `INVALID_AGENT_SIGNATURE`
* the correct externally held key signed the canonical submission outside FLOP browser custody
* the signed submission was accepted
* deterministic Trial 1 produced PASS
* the resulting public receipt signature verified as VALID

External acceptance DID:

`did:key:z6MkjZtdcF2bCpuqg69JnEXVvWi6JwVpsshm4t19h2FVPv65`

External acceptance receipt:

`eb11f9c4-74fa-4fb2-995f-729ac8794312`

## Gate IF — external Agent API

Status: PASS

GitHub Actions run `33432048802` executed `npm run acceptance:external-agent` against the deployed public Railway API.

Observed result:

* `deployedExternalAgentApi`: PASS
* `didDeclarationAloneCreatesVerifiedEvidence`: NO
* `wrongSignerRejected`: PASS
* `correctExternalSignerAccepted`: PASS
* `deterministicTrial`: PASS
* `publicReceiptSignature`: VALID

The external agent used the same DID → challenge → signed submission → deterministic verification → receipt → public verification path without using the FLOP browser key generator.

The one-time deployed acceptance step was removed from normal CI immediately after the successful run so future pushes do not create test receipts.

## Gate IG — custody boundary and browser security

Status: PASS

Current acceptance evidence includes:

* browser-created and restored active signing keys are nonextractable WebCrypto `CryptoKey` objects
* plaintext seed, private JWK and backup passphrase are not stored in localStorage
* browser API request bodies are locked by regression tests to public challenge fields or signed submission envelopes only
* seed copy/download, encrypted backup creation and encrypted backup restore remain local browser operations
* PostgreSQL product state contains no agent seed, private key, mnemonic, passphrase or recovery-secret field
* prior deployed Trial 1 acceptance demonstrated the agent signing key is not transferred to the backend
* Vercel security regression test passed with `default-src 'none'`, `script-src 'self'`, no `unsafe-eval`, bounded Railway `connect-src`, `object-src 'none'`, `frame-ancestors 'none'` and `Referrer-Policy: no-referrer`
* the same code/config revision successfully deployed to Vercel
* CI run `33432048802` passed 138 tests, typecheck, build and high-severity audit

## Completion statement

Identity ownership/connectivity acceptance is complete.

The accepted user-owned identity model is:

Create or restore Ed25519 `did:key` → user owns portable seed → optional encrypted recovery → nonextractable active browser key → same deterministic capability protocol → server-signed public evidence.

FLOP is not the agent private-key custodian.

External agents can use the same public capability protocol with their own signer without FLOP browser custody.

The next product milestone is implementation of the remaining deterministic capability trials toward the ten-trial FLOP v1 program.
