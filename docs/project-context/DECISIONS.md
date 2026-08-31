# Project Decisions

Record only durable decisions that are likely to matter in future work.

## 2026-08-31

### User-provided references are binding until deviation is approved

When the user provides a repository, product, screenshot or implementation as the basis for a flow, inspect the relevant source and preserve its behavior before proposing alternatives. Do not replace referenced behavior with an invented architecture from memory or preference. Any deviation must be labeled as a proposal and made explicit before implementation.

Status: Active

### Overheard is the identity ownership reference

`https://github.com/PranjalBoraCrypto/overheard` is the explicit reference for browser identity ownership, portability, encrypted recovery and noncustodial signing. FLOP is not based on Overheard's archive/card product, but must preserve its identity ownership semantics while adding capability verification.

Status: Active

### Browser-created identity ownership uses a portable seed plus optional encrypted backup

For a FLOP-created Ed25519 `did:key`, the user must receive the portable 32-byte seed as the master identity material at creation time, with simple local Reveal, Copy and Download options before continuing. The encrypted backup is an additional convenience and recovery mechanism, not a substitute for the user's direct ownership of the seed. Normal active signing still uses a nonextractable WebCrypto `CryptoKey` in IndexedDB, and no private material is sent to FLOP servers.

Status: Active

### Create DID and connect existing DID are both first class

FLOP must not assume identities are created by FLOP. A user or agent may create a new supported Ed25519 `did:key` in the browser or connect an existing supported DID by proving control with signatures.

Status: Active

### FLOP is not a private-key custodian

Private signing or recovery material must never be stored by Railway, Vercel server code or PostgreSQL. FLOP verifies signatures; it does not hold the user's signing authority.

Status: Active

### Previous encrypted-backup-only browser ownership target is superseded

The earlier target of treating a nonextractable active key plus encrypted exportable backup as the complete browser-created identity ownership model is superseded. The current model requires direct portable seed ownership at creation time as described above, with encrypted backup remaining optional/additional.

Status: Superseded by `Browser-created identity ownership uses a portable seed plus optional encrypted backup`

### External agents use the same verification protocol

An externally owned DID and signer must be able to request challenges and submit signed results through the same verification engine/API. FLOP must not require browser custody for agent/API users.

Status: Active

### FLOP v1 capability program targets ten deterministic trials

The product target is a ten-trial deterministic capability program, not a permanent three-trial ceiling. The ten v1 capabilities and verifier intent are defined in `docs/capability-program-v1.md`. Implementation remains sequential and every trial reuses the same DID-bound challenge, signed submission, deterministic verifier, server-signed receipt and public evidence engine.

Status: Active

### Public certificate is a high-information shareable credential surface

FLOP must produce a visually strong public capability certificate/profile inspired by the useful share behavior of Overheard's credential card, but backed by FLOP capability receipts. It must show capability completion state, DID, ownership/proof state, verifier/program version and evidence references. It must support downloadable image, copy image, X sharing, proof link and independent live verification. The image is a share artifact; the live proof profile and signed receipts are the source of truth.

Status: Active

### Ten-of-ten completion gets a distinct verified-agent seal

A public profile may display `N OF 10 VERIFIED`. An agent with all ten current v1 trials verified may display a distinct `FLOP VERIFIED AGENT · 10 OF 10` certificate state. FLOP does not turn this into a subjective reputation score.

Status: Active

### Testnet certificate target is an identity-bound NFT

When an official FLOP testnet specification exists, a completed ten-of-ten capability certificate must be mintable as a FLOP Capability Certificate NFT. The NFT must be non-transferable or otherwise identity-bound so it cannot be sold to a different agent. It references the public proof/certificate and receipt bundle; it never contains private key or seed material.

Status: Active

### FLOP token integration is reserved but not fabricated

The product reserves FLOP-token seams for trial execution fees, certificate NFT mint/re-certification fees, optional FLOP-spend evidence and possible verifier/execution-provider rewards if supported by the official protocol. Exact amounts, wallet APIs, chain ids, contract addresses, faucet rules and eligibility logic must not be invented before official testnet specifications exist.

Status: Active

### Trial 1 protocol acceptance is not Product MVP completion

Trial 1 acceptance proves the first verification protocol vertical slice. Product MVP completion additionally requires the product contract's identity/connectivity requirements and the current v1 capability-program requirements. Do not equate `Trial 1 complete` with `Product MVP complete`.

Status: Active

## 2026-08-30

### Capability Lab is the current product direction

The product tests demonstrable agent capabilities through repeatable trials and produces verifiable evidence.

Status: Active

### Existing Technocore Agent Console is not the implementation base

The previous console remains a reference and experiment archive. FLOP Capability Lab is built cleanly in this repository to avoid inheriting mailbox, messaging and readback state assumptions.

Status: Active

### PostgreSQL is durable product state

Technocore is not the product database and is not allowed to determine core PASS or FAIL state.

Status: Active

### Technocore is optional downstream evidence

Technocore may later publish or reference completed evidence. Core challenge, submission, verification, receipt and public verification flows must continue when Technocore is unavailable.

Status: Active

### Deterministic MVP only

The initial MVP uses deterministic verifiers. LLM judging and subjective capability evaluation are outside the first milestone.

Status: Active

### Trial 1 is the only first implementation target

No Trial 2, Trial 3 or broad product shell should be implemented before the complete Trial 1 vertical slice passes acceptance.

Status: Active

### Trial 1 identity scope is Ed25519 did:key

Other DID methods and key types are deferred. Unsupported identity types must fail explicitly rather than being guessed.

Status: Active

### Cryptographic JSON canonicalization is RFC 8785 JCS

Signed submission payloads and receipt payloads use versioned RFC 8785 JSON Canonicalization Scheme rather than runtime dependent JSON serialization.

Status: Active

### UNKNOWN is not FAIL

Infrastructure uncertainty, timeout or unavailable optional services must not become capability failure evidence.

Status: Active

### Receipt is a first class immutable object

PASS evidence is bound to exact agent DID, challenge, result hash, trial version, verifier version and Capability Lab server attestation.

Status: Active

### Browser private keys do not go to the server

The target browser custody model avoids plaintext private JWK storage in localStorage and keeps private signing material client side.

Status: Active

### FLOP testnet is not an MVP dependency

No speculative wallet, faucet, chain id, token accounting, eligibility or airdrop logic is added without official specification.

Status: Active
