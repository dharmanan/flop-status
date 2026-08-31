# FLOP Capability Program v1

## Product outcome

FLOP v1 does not stop at three technical checks. A completed agent profile is evaluated across ten deterministic capability trials.

Each trial uses the same trust path:

DID → unique challenge → DID-signed result → deterministic verifier → immutable server-signed receipt → public capability record.

A PASS proves only that this DID passed this exact trial under this verifier version. It does not prove human identity, model provenance or permanent future performance.

## Ten v1 capability trials

### 1. Ed25519 Signature Verification

Capability: cryptographic verification.

Challenge: message, Ed25519 public key and signature.

Expected result: determine whether the signature is valid and return the required reason code and message hash.

Verification: exact deterministic cryptographic verification.

### 2. Canonical JSON + SHA256

Capability: deterministic data canonicalization and hashing.

Challenge: structured JSON containing nested objects, arrays, Unicode and numeric edge cases.

Expected result: RFC 8785 JCS canonical form plus SHA256 digest.

Verification: exact canonical bytes and digest.

### 3. Technocore Canonical Message Construction

Capability: protocol-compliant message construction.

Reference behavior: the inspected Technocore implementation cleans the text, uses a nonce string, and signs the exact UTF-8 string `room|nonce|cleaned text`. The sender DID is carried separately by the protocol and is not part of that canonical signing string. The current implementation commonly derives the nonce from `Date.now()`; FLOP supplies the nonce directly in the deterministic challenge rather than depending on wall-clock time.

Challenge: sender DID binding, room, nonce and raw text containing deterministic cleaning edge cases.

Expected result: apply the reference text-cleaning rule and construct the exact canonical Technocore signing string `room|nonce|cleaned text`.

Verification: byte-for-byte canonical string comparison plus exact cleaned-text comparison. Core verification does not call Technocore.

### 4. Signed Receipt Verification

Capability: evidence verification.

Challenge: FLOP-style signed receipt, server public key and tampered/untampered variants.

Expected result: determine validity, identify the correct key id and return the required status/reason code.

Verification: deterministic signature and field-binding checks.

### 5. Structured Data Transformation

Capability: reliable machine-readable transformation.

Challenge: source records plus a target JSON schema and explicit mapping rules.

Expected result: produce schema-valid normalized output without adding or dropping prohibited fields.

Verification: JSON Schema validation plus exact rule checks.

### 6. Tool Selection and Function Calling

Capability: choosing the correct tool and constructing exact arguments.

Challenge: a task plus a fixed catalog of tool/function schemas.

Expected result: select the correct tool or ordered tool calls and produce valid arguments.

Verification: allowed call graph, exact required arguments, schema validation and forbidden-call checks.

### 7. Multi-step Workflow Execution

Capability: deterministic planning and dependency handling.

Challenge: a small workflow graph with dependencies and deterministic tool outputs.

Expected result: execute or describe the correct dependency order and produce the required final structured result.

Verification: dependency order, intermediate state and final result checks.

### 8. Retrieval and Grounded Evidence

Capability: retrieving the right evidence from a fixed corpus without unsupported claims.

Challenge: a versioned local corpus with source identifiers plus a structured question.

Expected result: answer in a fixed schema and cite the exact supporting source ids/evidence spans.

Verification: accepted facts, required evidence references and unsupported-claim rejection.

### 9. Constraint and Policy Compliance

Capability: following explicit operational rules.

Challenge: deterministic policy/rule set plus proposed actions and edge cases.

Expected result: ALLOW/BLOCK decisions with exact reason codes and safe alternatives only where permitted.

Verification: rule engine comparison against the same versioned policy fixture.

### 10. Failure Recovery and Idempotency

Capability: reliable agent behavior under deterministic failures.

Challenge: simulated API/workflow responses such as timeout, 429, malformed response, duplicate request, lost response and eventual success.

Expected result: choose the correct retry/recovery/state transition without duplicate side effects or turning infrastructure uncertainty into a false capability failure.

Verification: deterministic state-machine and side-effect checks.

## Public FLOP Capability Certificate

The public artifact is not a PDF certificate. It is a high-information shareable credential surface inspired by the useful behavior of Overheard's credential card while representing FLOP capability evidence.

The canonical certificate is a live public page. A downloadable image is a share format, not the source of truth.

The certificate must show at minimum:

* agent visual/avatar or deterministic identity mark
* public DID
* ownership state: public lookup or ownership proven
* verified capability count, for example `7 OF 10 VERIFIED`
* ten named capability badges with VERIFIED or UNTESTED state
* latest verification timestamp
* verifier/program version
* receipt count
* server attestation status
* proof/profile URL
* compact receipt/evidence fingerprint

The certificate must support:

* Download image
* Copy image
* Post/share to X
* Copy proof link
* Open live proof profile
* independent verification without login

The image must never be treated as proof by itself. The proof link resolves to the live public capability record and its server-signed receipts.

Individual PASS receipts keep their own public verification URLs. The certificate profile aggregates those receipts into one strong public view.

## Completion state

The v1 certificate does not use a subjective reputation score.

A profile may state `N OF 10 VERIFIED`.

When all ten v1 trials are currently valid under the required verifier versions, the profile may display a distinct `FLOP VERIFIED AGENT · 10 OF 10` seal.

Version changes or re-certification requirements must be explicit rather than silently changing old evidence.

## FLOP testnet NFT seam

When an official FLOP testnet specification exists, the completed 10-of-10 certificate must be mintable as an identity-bound FLOP Capability Certificate NFT.

The NFT is a cryptographic representation of the certificate, not a replacement for the receipts.

Planned NFT metadata includes:

* agent DID
* capability-program version
* `10/10` completion state
* ten capability identifiers and verifier versions
* public certificate/proof URL
* receipt bundle hash or Merkle root
* issuance timestamp
* FLOP attestation identity/key reference

The certificate NFT should be non-transferable or otherwise identity-bound so it cannot be sold to a different agent and misrepresent capability ownership.

No agent private key, seed or recovery material is ever placed on-chain.

## FLOP token role on testnet

Exact token amounts, chain ids, wallet APIs and contract addresses remain undefined until an official FLOP testnet specification exists.

The product seam is reserved for:

* paying a FLOP-denominated trial execution fee
* paying a FLOP-denominated certificate NFT mint/re-certification fee
* recording FLOP spent by a verified agent as optional public evidence
* later rewarding decentralized verifier/execution providers if the official protocol supports that model

Do not invent token amounts, wallet contracts, faucet rules or eligibility logic before the official specification exists.

## Implementation order

The ten-trial program is the v1 product target, but implementation remains vertical and sequential.

Trial 1 already defines the protocol pattern. Each later trial must reuse the same challenge, DID-signature, verifier, receipt and public-verification engine rather than creating parallel evidence systems.
