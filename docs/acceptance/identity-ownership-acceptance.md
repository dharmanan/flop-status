# Identity Ownership and Connectivity Acceptance

## Goal

Close the product identity gap without making FLOP a private-key custodian.

This milestone is separate from the already completed Trial 1 protocol acceptance.

`PranjalBoraCrypto/overheard` is the binding ownership/portability reference for this milestone.

## Required identity paths

1. Browser-owned Ed25519 `did:key` created by FLOP frontend with direct user ownership of the portable 32-byte seed.
2. Existing user-owned identity restored from seed or the downloaded identity text file.
3. Optional encrypted FLOP backup restore.
4. Existing externally controlled Ed25519 `did:key` used through the same challenge/submission API without FLOP custody.

The normal consumer onboarding must not require a user to understand or manually sign canonical JSON payloads.

## Gate IA: browser-owned creation and seed ownership

PASS only if, in the deployed Vercel frontend:

1. a fresh browser can explicitly create a new Ed25519 `did:key`
2. the user is shown the portable 32-byte seed before continuing
3. the seed can be revealed, copied and downloaded locally as an identity text file
4. the user cannot continue until they have copied or downloaded the seed and explicitly confirmed saving it
5. the active signing private key persisted in IndexedDB is nonextractable
6. plaintext private JWK, seed or recovery secret is not stored in localStorage
7. the seed/private key does not appear in network requests
8. the new identity can complete Trial 1 through the existing Railway protocol

The optional encrypted backup is not a substitute for direct seed ownership and is not required to complete creation.

## Gate IB: refresh persistence

After Gate IA:

1. hard refresh the same browser
2. verify the exact same DID is recovered
3. verify the active private key remains nonextractable
4. verify durable capability evidence is recovered from Railway

PASS only if all four hold.

## Gate IC: seed portability

Using a separate clean browser context with no FLOP identity state:

1. open the deployed Vercel frontend
2. choose `I already have one`
3. restore from the 64-character seed or the downloaded identity text file

PASS only if:

1. the restored DID is byte-for-byte the same DID created in Gate IA
2. the restored active key is nonextractable
3. the restored identity can sign and complete a new Trial 1 challenge
4. durable evidence continues under the same DID rather than creating a new identity
5. no seed/private key material is transmitted to Railway or Vercel server code

## Gate ID: optional encrypted backup

PASS only if:

1. an encrypted backup can be created from the same browser-owned identity after seed ownership is established
2. backup format is versioned
3. private key/seed material is inside authenticated encryption rather than plaintext JSON
4. backup uses AES-GCM
5. backup key is derived from the user's passphrase with PBKDF2-SHA256 and an explicit work factor
6. passphrase itself is never stored in the backup
7. tampering or a wrong passphrase cannot restore an identity
8. a separate clean browser can restore the exact same DID from backup plus passphrase
9. the restored active key is nonextractable and can complete Trial 1

The encrypted backup is an optional recovery convenience. The portable seed remains the master identity material.

## Gate IE: external signer semantics

Use an Ed25519 `did:key` whose private key is controlled outside FLOP.

PASS only if:

1. FLOP accepts the public DID without asking for its private key, seed, mnemonic or recovery secret
2. merely entering/declaring the DID does not create verified capability evidence or claim cryptographic control
3. FLOP creates a normal DID-bound challenge for that DID
4. the external wallet/agent/signer signs the canonical submission payload outside FLOP
5. FLOP receives only the signed result envelope, not private key material
6. Railway verifies the DID signature before deterministic trial verification
7. a signature from a different key, DID or payload is rejected
8. a valid signature can produce the normal PASS receipt and capability record

Consumer UI must not make manual canonical-payload signing the normal user flow. External signer integration is an Agent API/integration concern.

## Gate IF: external agent API

PASS only if an external agent can perform the same core path directly against the documented Railway API without using the FLOP browser key generator:

DID → challenge → externally signed submission → deterministic verification → receipt → public verification.

The API must not require an identity to have been created by FLOP.

## Gate IG: custody boundary and browser security

PASS only if:

1. FLOP PostgreSQL stores no agent seed, private key, mnemonic, passphrase or recovery secret
2. Railway public/private API payloads contain no agent seed/private key/recovery secret
3. Vercel uses a CSP with `default-src 'none'`
4. Vercel browser scripts are restricted to `script-src 'self'`
5. CSP does not allow `unsafe-eval` or third-party scripts
6. outbound browser connections are restricted to the FLOP origin and the explicit Railway API origin
7. referrer policy is `no-referrer`
8. browser-created/restored active private keys remain nonextractable

## Automated test minimum

Before deployed acceptance, CI must cover at minimum:

1. browser identity creation produces an Ed25519 `did:key` and a 32-byte seed
2. active created key is nonextractable
3. seed text export can restore the exact same DID
4. optional encrypted backup contains neither plaintext seed nor passphrase
5. encrypted backup restores the same DID
6. restored active key is nonextractable and signs successfully
7. wrong passphrase fails closed
8. unsupported DID methods fail explicitly
9. Vercel CSP retains the key-custody restrictions above
10. consumer onboarding does not expose a manual canonical-payload signing form

## Completion statement

Do not mark the identity ownership/connectivity milestone complete until Gates IA through IG have passed with deployed evidence.

Passing CI alone is not sufficient.
