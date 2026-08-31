# Overheard identity architecture reference

Reference repository: `https://github.com/PranjalBoraCrypto/overheard`

This is a reference for identity ownership, browser custody and portability. It is not the FLOP product implementation base and FLOP must not copy Overheard's archive/card product direction.

## What Overheard gets right and FLOP must preserve or improve

* A user can arrive with an existing Ed25519 `did:key`; creating a new identity is not the only path.
* A new Ed25519 identity can be created in the browser.
* Signing happens in the browser. The service receives signatures, not the private key.
* The active browser signing key is imported as a nonextractable WebCrypto `CryptoKey` and persisted in IndexedDB.
* Recovery material is kept separately from the active unlocked key.
* Recovery/backup is encrypted before persistent storage or export.
* Identity is portable rather than locked to one site or one browser database.
* Server-side forwarding code must be incapable of signing as the user and should reject accidental key material.

## FLOP requirement beyond Overheard

Overheard primarily answers questions such as who a key is, where it was active and what public activity is associated with it.

FLOP must add a stronger capability verification layer:

DID → signed challenge → repeatable capability trial → deterministic verification → immutable server-signed receipt → public capability record → machine API.

## Non-negotiable identity boundary for FLOP

FLOP is not a private-key custodian.

Two entry paths are first class:

1. Create a new browser-owned Ed25519 `did:key`.
2. Connect an existing supported Ed25519 `did:key` controlled by an external signer/agent.

Connecting an existing DID means proving control with a valid signature. Merely pasting a DID is not sufficient proof of control.

For browser-created identities, the product target is:

* nonextractable active signing key in IndexedDB
* encrypted exportable backup and restore path
* private key/recovery secret never sent to Railway, Vercel server code or PostgreSQL

For externally owned identities, FLOP must accept signed submissions from the holder's own signer through the same protocol/API. FLOP must not require that the identity was created by FLOP.
