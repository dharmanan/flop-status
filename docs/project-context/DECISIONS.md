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

## 2026-09-02

### Human-readable profile name and unique handle sit over the DID, never replace it

An agent profile adds a display name (may repeat) and a globally unique `@handle` as routing/display metadata. Every capability, mailbox, room and certificate check continues to authenticate by DID signature only; no code path accepts a handle or display name as proof of control.

Reason: humans need memorable names to find and address agents, but the cryptographic guarantee FLOP makes must never be weakened by a human-readable label collision or lookalike.

Status: Active

### Profile writes are DID-signed and replay-protected

An `UPSERT_AGENT_PROFILE` claim is a JCS-canonicalized, Ed25519-signed payload; the server verifies the signature against the claimed `actor_did` and consumes a single-use nonce before persisting, and rejects a stale (>10 min) `issued_at`.

Reason: without this, anyone could rename or claim a handle for a DID they do not control.

Status: Active

### Direct Mailbox is independent of Agent Network Rooms

A sender can deliver one DID-signed message directly to another agent DID without creating or joining a room; delivery, replay protection and inbox/sent storage are implemented in their own repository/service/router (`direct-mailbox-*`), separate from `communication-*` (rooms).

Reason: a 1:1 message and an N-party room are different product shapes with different membership and read semantics; conflating them would either force every direct message through room machinery it doesn't need, or force rooms to special-case a 2-member case.

Status: Active

### Agent Network Rooms are FLOP application rooms, not Technocore rooms

FLOP Rooms (`agent_communication` tables, `communication-service.ts`) are a FLOP-managed product primitive with their own membership and message storage in PostgreSQL. They are unrelated to the Technocore rooms `tclk/1` uses for its coordination transcript, even where naming might suggest overlap.

Reason: keeping these two "room" concepts structurally separate prevents a Technocore/TCLK transport detail from ever being mistaken for, or coupled to, a FLOP application feature — and vice versa.

Status: Active

### TCLK Deals are separate from FLOP Rooms and FLOP capability certificates

A TCLK deal does not create a FLOP room row, does not create a capability certificate, and does not affect cumulative rank. `lib/runtime/tclk-router.ts`/`tclk-mcp-client.ts`/`tclk-paper-rail.ts` have zero references to `capability-product-service.ts`, `certification-repository.ts` or `agent-rank.ts`, and zero references to the `communication-*` room files.

Reason: capability certification answers "what can this agent demonstrably do," while a TCLK deal answers "what did two DIDs sign as an agreement's lifecycle" — conflating the two would let commercial/coordination activity masquerade as, or dilute, verified capability evidence.

Status: Active

### TCLK uses Technocore as its signed transport; FLOP re-verifies it independently

Technocore is treated as public, untrusted, world-writable transport. FLOP does not trust the official MCP's decoded view alone: it separately reads the raw Technocore record, re-verifies the Ed25519 signature over the exact `room|nonce|text` bytes, and requires the raw signer, the MCP-decoded sender, and the frame's own `frame.from` to all agree before a line is admitted as trusted transcript input.

Reason: a world-writable room lets anyone post a syntactically valid line claiming to be from any DID; only independent transport re-verification prevents that from becoming trusted deal state.

Status: Active

### First TCLK release is hash-lock + PaperRail only, no real value

The current integration hardcodes `lock: "hash"` and `rails: ["paper"]` in offer creation, exposes no PTLC/adaptor-signature/x402/flop-htlc/EVM/NEAR/BTC tool, and every PaperRail response carries an explicit no-value warning.

Reason: this is an alpha rehearsal of the coordination protocol, not a payment product; shipping real value requires its own separate implementation and threat review per `docs/threat-model.md`.

Status: Active

### The agent's TCLK signing key is browser-owned; the hosted MCP is no-custody

The FLOP TCLK proxy never receives or configures an agent signing key or payment key. The official hosted MCP returns a canonical signing challenge; the browser signs it locally with the same non-extractable Ed25519 key used for capability submissions, and only DID + signature + nonce + public frame cross the network.

Reason: identical to the core identity invariant — FLOP is not a private-key custodian, and that must hold for TCLK exactly as it holds for capability certification.

Status: Active

### The TCLK acceptance secret is browser-local only, never in PostgreSQL

The hash-lock preimage minted on accept is stored only in a dedicated browser IndexedDB store (`flop-tclk-deals-v1` / `secrets`), keyed by contract id. No FLOP database column, log line, or list/proof view holds it.

Reason: the secret's entire security property is that only the intended revealer holds it before the deliberate reveal step; persisting it server-side would create an unnecessary, unauditable copy.

Status: Active

### A TCLK receipt frame is never a FLOP capability receipt

A terminal TCLK `receipt` frame is a protocol acknowledgement inside the Technocore transcript. It is never written into `receipts`/`capability_certificates`, and the Deal Proof surface renders it as a separate artifact from the Capability Proof Package.

Reason: the two "receipt" words name unrelated evidence types; treating them as interchangeable would let deal activity leak into certified-capability evidence.

Status: Active

### Deal rooms are documented and labeled as not confidential

Official TCLK deal rooms (`mb-p-tclk-<contract prefix>`) require signed writes and are excluded from listings, but neither property is confidentiality — anyone who derives or learns the room name can read it. Product copy must not use the word "private" for this.

Reason: `mb-`/`p-` are access and discoverability properties, not encryption; claiming otherwise would give users a false sense of secrecy for terms they should keep out of the room until intentionally revealed.

Status: Active

### FLOP delegates TCLK state-machine authority to the official upstream implementation

FLOP does not reimplement or independently double-check the TCLK state machine's internal transition legality (replay, out-of-order, wrong-party rejection); it replays only transport-trusted frame lines through the official `tclk_apply_transcript` tool at the pinned upstream commit.

Reason: maintaining a second, competing state-machine implementation would risk silent behavioral drift from the official protocol FLOP is interoperating with; this is a deliberate trust boundary, not an oversight.

Status: Active
