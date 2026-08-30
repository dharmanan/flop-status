# Project Decisions

Record only durable decisions that are likely to matter in future work.

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
