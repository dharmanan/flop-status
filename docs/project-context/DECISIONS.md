# Project Decisions

Record only durable decisions that are likely to matter in future work.

## 2026-09-01

### Every production capability PASS issues its own certificate

FLOP does not wait for 7/7 or 10/10 before issuing certification. Each certificate-eligible production capability PASS creates one separate capability certificate for the agent DID. Cumulative rank is a different layer derived from the set of valid individual certificates.

Initial rank thresholds are: 0 Unranked, 1–2 individually certified with no named rank, 3–4 Rookie, 5–6 Regular, 7 Core Verified, 8–9 Advanced, 10 Agentic Verified. Rank names may be refined later without changing the individual certificate invariant.

Status: Active

### Production certificate journey always starts at Capability 1 and proceeds one by one

Every user, including a DID used during development, begins the production certificate journey at Capability 1 and completes each capability individually. There is no bulk activation, migration credit, `verify previous four` action or other shortcut based on internal development acceptance runs.

Status: Active

### Trial 1–4 browser auto-solver receipts are development acceptance evidence, not production certificates

The existing Trial 1–4 browser auto-solver runs proved the verification infrastructure. Their signed receipts remain immutable historical protocol evidence, but they do not count toward production certificate totals or rank. Production capability certificates require the normal FLOP capability runtime path.

Status: Active

### FLOP v1 capability structure is seven deterministic Core plus three optional Agentic

Capabilities 1–7 require no LLM. Capabilities 8–10 require an LLM, are optional, require explicit user opt-in and may create usage cost. Each of all ten capabilities has its own individual certificate when passed. The LLM may perform Agentic tasks, but FLOP PASS/FAIL remains deterministic and FLOP does not use an LLM judge.

Status: Active

### FLOP-managed capability execution is contained inside FLOP

FLOP-created capability modules are acquired, practiced, verified and used through explicit user-initiated FLOP product actions. FLOP v1 does not expose a general public hosted-agent invocation endpoint for arbitrary third-party applications. Identity, receipts, certificates and proof are public/portable; FLOP-managed execution is not.

Status: Active

### Idle agents are metadata, not permanent services

Creating an agent must not create a dedicated Railway service or permanently running process. Capability implementations are stored once in a versioned FLOP registry, while agent profiles store references and state. Execution cost should occur only from explicit user actions.

Status: Active

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

### Previous ten-deterministic-trial program is superseded

The former target of ten deterministic trials is superseded by the 2026-09-01 decision defining seven deterministic Core capabilities plus three optional LLM-backed Agentic capabilities. The shared deterministic verification/receipt engine remains required.

Status: Superseded by `FLOP v1 capability structure is seven deterministic Core plus three optional Agentic`

### Public certificate is a high-information shareable credential surface

FLOP must produce visually strong public capability certificate surfaces backed by FLOP capability receipts. Each production capability PASS has its own certificate/proof surface, and the public agent profile aggregates all certificates plus cumulative rank. Share images are artifacts; live proof pages and signed receipts are the source of truth.

Status: Active

### Previous single ten-of-ten certificate framing is superseded

The earlier framing of certification as a special certificate state obtained only at ten of ten is superseded. Each capability PASS issues an individual certificate. Ten of ten now represents the highest cumulative `Agentic Verified` rank while preserving all ten underlying certificates.

Status: Superseded by `Every production capability PASS issues its own certificate`

### Testnet certificate target is identity-bound

When an official FLOP testnet specification exists, certificate or cumulative rank state may be represented using identity-bound primitives supported by that official specification. Any on-chain artifact references live proof and receipt evidence; it never contains private key or seed material.

Status: Active

### FLOP token integration is reserved but not fabricated

The product reserves FLOP-token seams for future official testnet operations if supported by the official protocol. Exact amounts, wallet APIs, chain ids, contract addresses, faucet rules and eligibility logic must not be invented before official testnet specifications exist.

Status: Active

### Trial 1 protocol acceptance is not Product MVP completion

Trial 1 acceptance proves the first verification protocol vertical slice. Product completion additionally requires the current capability runtime, certificate and product requirements. Do not equate `Trial 1 complete` with Product completion.

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

### Deterministic verification remains mandatory

Even when optional Agentic capabilities use an LLM to perform a task, certification verdicts must remain deterministic. Subjective LLM judging is not used for PASS/FAIL.

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

### Production capabilities are defined in one bounded registry

Capabilities 1–4 share a single production definition list (`lib/runtime/capability-registry.ts`) carrying ordinal, capability id/version, module id/version, production trial id, historical trial id, verifier identity, certificate name and prerequisite capability.

Reason: the Capability 1 implementation used capability-specific service methods and inline trial-id branches. Repeating that for four capabilities would have produced four parallel if/else chains across issuance, submission, finalization and the product service, which is exactly where a sequencing or certificate-eligibility mistake would hide. The registry is a bounded data table, not a framework, and the runtime security checks stay where they were.

Status: Active

### Sequential capability order is enforced in the backend

Acquiring Capability N requires an ACTIVE production certificate for Capability N-1, checked in `CapabilityProductService`. Issuing a production certification challenge requires the matching capability to be installed for that DID.

Reason: hiding buttons is not enforcement. A direct API call must not be able to skip the order.

Status: Active

### Certificate eligibility is decided only by the production trial id

`finalizeCapabilityVerification` issues a certificate only when the finalized challenge's trial id resolves to a production capability in the registry. Historical Trial 1–4 receipts still finalize and remain immutable evidence, but never create a certificate.

Reason: production certificates must never be inferred from historical development acceptance evidence or from `capability_records`.

Status: Active

### Cumulative rank is derived, not stored

Rank is computed from the count of ACTIVE certificates (`lib/runtime/agent-rank.ts`) and is never written onto a certificate.

Reason: certificate and rank are different concepts. Storing rank on a certificate would freeze a value that changes as other capabilities are certified.

Status: Active

### One capability module serves practice, certification and use

Each capability exposes exactly one browser executor. The page controller only ever calls `capability.execute(...)`, whether for practice, for the certification challenge or for normal FLOP use, and the module never receives the hidden expected answer.

Reason: a certification-specific solver would make a PASS prove something other than the capability the certificate names.

Status: Active

### Verification progress is bound to real operations

The shared verification run surface advances a step only when the corresponding asynchronous operation resolves. No timer, interval or animation frame advances verification state.

Reason: simulated progress would misrepresent what FLOP actually did, which is the opposite of what an evidence product exists to show.

Status: Active
