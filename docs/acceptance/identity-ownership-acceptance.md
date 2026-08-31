# Identity Ownership and Connectivity Acceptance

## Goal

Close the product identity gap without making FLOP a private-key custodian.

This milestone is separate from the already completed Trial 1 protocol acceptance.

## Required identity paths

1. Browser-owned Ed25519 `did:key` created by FLOP frontend.
2. Existing externally owned Ed25519 `did:key` connected without giving FLOP its private key.

## Gate IA: browser-owned creation

PASS only if, in the deployed Vercel frontend:

1. a fresh browser can explicitly create a new Ed25519 `did:key`
2. an encrypted recovery backup is produced and downloadable during creation
3. the active signing private key persisted in IndexedDB is nonextractable
4. plaintext private JWK, seed, passphrase or recovery secret is not stored in localStorage
5. the private key or recovery secret does not appear in network requests
6. the new identity can complete Trial 1 through the existing Railway protocol

## Gate IB: refresh persistence

After Gate IA:

1. hard refresh the same browser
2. verify the exact same DID is recovered
3. verify the active private key remains nonextractable
4. verify durable capability evidence is recovered from Railway

PASS only if all four hold.

## Gate IC: encrypted backup properties

PASS only if:

1. backup format is versioned
2. private key material is inside authenticated encryption rather than plaintext JSON
3. backup uses AES-GCM
4. backup key is derived from the user's passphrase with PBKDF2-SHA256 and an explicit work factor
5. passphrase itself is never stored in the backup
6. tampering or a wrong passphrase cannot restore an identity

## Gate ID: clean restore and portability

Using a separate clean browser context with no FLOP identity state:

1. open the deployed Vercel frontend
2. select the encrypted backup produced in Gate IA
3. provide its passphrase
4. restore the identity

PASS only if:

1. the restored DID is byte-for-byte the same DID created in Gate IA
2. the restored active key is nonextractable
3. the restored identity can sign and complete a new Trial 1 challenge
4. durable evidence continues under the same DID rather than creating a new identity
5. no private key/recovery material is transmitted to Railway or Vercel server code

## Gate IE: existing external DID connection

Use an Ed25519 `did:key` whose private key is controlled outside FLOP.

PASS only if:

1. the deployed frontend accepts the public DID without asking for its private key, seed, mnemonic or recovery secret
2. merely entering the DID does not claim cryptographic control
3. FLOP creates a normal DID-bound Trial 1 challenge for that DID
4. the frontend exposes the exact canonical submission payload that must be signed
5. the payload is signed by the external signer outside FLOP
6. FLOP accepts only the resulting Ed25519 signature
7. the browser locally rejects a signature that does not match the connected DID and exact payload
8. Railway independently verifies the same signature before deterministic verification
9. a valid external signature can produce the normal PASS receipt and capability record

## Gate IF: external agent API

PASS only if an external agent can perform the same core path directly against the documented Railway API without using the FLOP browser key generator:

DID → challenge → externally signed submission → deterministic verification → receipt → public verification.

The API must not require an identity to have been created by FLOP.

## Gate IG: custody boundary and browser security

PASS only if:

1. FLOP PostgreSQL stores no agent private key or recovery secret
2. Railway public/private API payloads contain no agent private key or recovery secret
3. Vercel uses a CSP with `default-src 'none'`
4. Vercel browser scripts are restricted to `script-src 'self'`
5. CSP does not allow `unsafe-eval` or third-party scripts
6. outbound browser connections are restricted to the FLOP origin and the explicit Railway API origin
7. referrer policy is `no-referrer`
8. browser-created active private keys remain nonextractable after create and restore

## Automated test minimum

Before deployed acceptance, CI must cover at minimum:

1. browser identity creation produces an Ed25519 `did:key`
2. active created key is nonextractable
3. backup does not contain the passphrase or plaintext private JWK
4. encrypted backup restores the same DID
5. restored active key is nonextractable
6. restored key signs successfully
7. wrong passphrase fails closed
8. unsupported DID methods fail explicitly
9. Vercel CSP retains the key-custody restrictions above

## Completion statement

Do not mark the identity ownership/connectivity milestone complete until Gates IA through IG have passed with deployed evidence.

Passing CI alone is not sufficient.
