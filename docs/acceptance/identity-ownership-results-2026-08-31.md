# Identity Ownership Acceptance Results — 2026-08-31

Source contract: `docs/acceptance/identity-ownership-acceptance.md`

Reference: `PranjalBoraCrypto/overheard`

Environment:

* Frontend: `https://flop-status.vercel.app`
* Backend: `https://flop-status-production.up.railway.app`
* Browser acceptance performed manually against deployed Vercel on 2026-08-31.

Public test DID used during the browser acceptance run:

`did:key:z6Mkm1gZwfKqaa5GGZbSYLoG6QCUDQ9jNepgMvSujv4rDgnR`

No seed, private key, passphrase or encrypted recovery content is recorded in this document.

## Gate IA — browser-owned creation and seed ownership

Status: PARTIAL PASS

Observed on deployed Vercel:

* fresh browser explicitly created a new Ed25519 `did:key`
* portable seed was presented before continuation and hidden by default
* Reveal, Copy and `.txt` Download controls were present
* `I've saved my seed` remained disabled until Copy or Download was used
* user confirmed seed saving before entering capability tests
* the created identity completed Trial 1 with PASS
* a server-signed receipt was produced and independently verified as VALID in the browser

Receipt observed during this run:

`50f57acd-6043-449d-96a9-0f4794d6f99e`

Still required before full Gate IA PASS:

* deployed no-secret network boundary evidence
* deployed verification that active IndexedDB signing key remains nonextractable beyond the UI claim

## Gate IB — refresh persistence

Status: BEHAVIOR PASS, CUSTODY CHECK PENDING

Observed after returning to the main FLOP page and refreshing:

* exact same public DID recovered
* previously verified `cryptography.signature-verification` evidence recovered from Railway
* latest verified receipt remained available

Still required for full Gate IB PASS:

* direct deployed inspection of the recovered active CryptoKey's `extractable === false`

## Gate IC — seed/text-file portability

Status: PASS

User manually verified in a clean browser context that the downloaded identity `.txt` file can be selected through `I already have one`, reconstructing the identity successfully.

The implementation and automated tests already require seed/text-file restoration to derive the exact same DID and import the active signing key as nonextractable.

No secret material was shared back during the manual acceptance run.

## Gate ID — optional encrypted backup

Status: PENDING DEPLOYED BROWSER ACCEPTANCE

Automated coverage exists for:

* AES-GCM encrypted backup
* PBKDF2-SHA256 key derivation
* no plaintext seed or passphrase in serialized backup
* wrong-passphrase failure
* exact same DID restoration
* nonextractable restored active key

Still required:

* deployed create encrypted backup
* clean-browser restore using backup plus passphrase
* same DID confirmation
* Trial 1 PASS after restore

## Gate IE — external signer semantics

Status: PENDING ACCEPTANCE

Consumer UI no longer exposes manual canonical-payload signing fields. External signer semantics remain an API/integration concern.

## Gate IF — external Agent API

Status: PENDING ACCEPTANCE

The Railway API already accepts DID-bound challenge creation and externally signed submissions, but a current seed-first milestone acceptance run still needs to be recorded.

## Gate IG — custody boundary and browser security

Status: PENDING DEPLOYED EVIDENCE

Repository tests and Vercel configuration cover the intended CSP/no-custody rules, but the deployed milestone is not complete until the no-secret network/storage boundary and active-key properties are explicitly verified and recorded.

## Current milestone statement

Browser creation, direct seed ownership, Trial 1 PASS, refresh persistence behavior and clean-browser identity text-file restoration are now demonstrated on deployed Vercel.

Identity ownership/connectivity is not yet complete. Gates ID, IE, IF and IG remain open, and IA/IB retain their explicit deployed custody checks.
