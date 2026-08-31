# FLOP Capability Program v1

## Product outcome

FLOP v1 contains ten certificate-eligible capabilities.

They are divided into:

* seven deterministic Core capabilities
* three optional LLM-backed Agentic capabilities

Every successful capability verification issues its own individual capability certificate.

Cumulative rank is a separate layer derived from the set of valid individual certificates. See `docs/certification-model-v1.md`.

Each capability uses the same trust path:

DID → unique challenge → capability runtime result → DID-signed submission → deterministic verifier → immutable server-signed receipt → public capability certificate.

A PASS proves only that this DID passed this exact capability under the named capability/trial/verifier versions. It does not prove human identity, model provenance or permanent future performance.

## User sequence

The production certificate journey starts at Capability 1 and proceeds one capability at a time.

For each capability:

**ACQUIRE → PRACTICE → VERIFY → CERTIFY → USE → PROVE**

There is no bulk certification path and no credit from internal development acceptance runs.

## Core capabilities 1–7

Core capabilities require no LLM and must be usable and certifiable without an LLM API key.

### 1. Ed25519 Signature Verification

Capability: cryptographic verification.

Acquired behavior: the FLOP agent can verify an Ed25519 signature against a message and public key and return a strict result.

Challenge: message, Ed25519 public key and signature.

Expected result: determine whether the signature is valid and return the required reason code and message hash.

Verification: exact deterministic cryptographic verification.

Certificate: `Ed25519 Signature Verification Certificate`.

### 2. Canonical JSON + SHA256

Capability: deterministic data canonicalization and hashing.

Acquired behavior: the FLOP agent can canonicalize supported JSON using RFC 8785 JCS and produce the required SHA256 digest.

Challenge: structured JSON containing nested objects, arrays, Unicode and numeric edge cases.

Expected result: RFC 8785 JCS canonical form plus SHA256 digest.

Verification: exact canonical bytes and digest.

Certificate: `Canonical JSON + SHA256 Certificate`.

### 3. Technocore Canonical Message Construction

Capability: protocol-compliant message construction.

Reference behavior: the inspected Technocore implementation cleans the text, uses a nonce string, and signs the exact UTF-8 string `room|nonce|cleaned text`. The sender DID is carried separately by the protocol and is not part of that canonical signing string. FLOP supplies the nonce directly in the deterministic challenge rather than depending on wall-clock time.

Acquired behavior: the FLOP agent can apply the Technocore text-cleaning rule and construct the exact canonical message.

Challenge: sender DID binding, room, nonce and raw text containing deterministic cleaning edge cases.

Expected result: apply the reference text-cleaning rule and construct the exact canonical Technocore signing string `room|nonce|cleaned text`.

Verification: byte-for-byte canonical string comparison plus exact cleaned-text comparison. Core verification does not call Technocore.

Certificate: `Technocore Canonical Message Certificate`.

### 4. Signed Receipt Verification

Capability: evidence verification.

Acquired behavior: the FLOP agent can verify a FLOP-style signed receipt against a bounded server-key set and distinguish valid, invalid, key-mismatch and unknown-key states.

Challenge: FLOP-style signed receipt, server public-key set and tampered/untampered variants.

Expected result: determine validity, identify the applicable key id when possible and return the required status/reason code.

Verification: deterministic signature and field-binding checks.

Certificate: `Signed Receipt Verification Certificate`.

### 5. Structured Data Transformation

Capability: reliable machine-readable transformation.

Acquired behavior: the FLOP agent can transform structured records according to explicit field mapping, normalization and schema rules without inventing data.

Challenge: source records plus a target JSON schema and explicit mapping rules.

Expected result: produce schema-valid normalized output without adding or dropping prohibited fields.

Verification: JSON Schema validation plus exact rule checks.

Certificate: `Structured Data Transformation Certificate`.

### 6. Constraint and Policy Compliance

Capability: following explicit operational rules.

Acquired behavior: the FLOP agent can apply a bounded deterministic policy/rule set to proposed actions and return the correct decisions and reason codes.

Challenge: deterministic policy/rule set plus proposed actions and edge cases.

Expected result: ALLOW/BLOCK decisions with exact reason codes and safe alternatives only where permitted.

Verification: deterministic rule-engine comparison against the versioned policy fixture.

Certificate: `Constraint and Policy Compliance Certificate`.

### 7. Failure Recovery and Idempotency

Capability: reliable behavior under deterministic failures.

Acquired behavior: the FLOP agent can handle bounded retry, lost-response, duplicate-request and eventual-success scenarios without duplicate side effects or false failure claims.

Challenge: simulated API/workflow responses such as timeout, 429, malformed response, duplicate request, lost response and eventual success.

Expected result: choose the correct retry/recovery/state transition and preserve idempotency.

Verification: deterministic state-machine and side-effect checks.

Certificate: `Failure Recovery and Idempotency Certificate`.

## Optional Agentic capabilities 8–10

Capabilities 8–10 require an LLM and explicit user opt-in.

The user must be told before enabling them that an LLM is required and that usage may create cost.

The LLM performs the task, but FLOP PASS/FAIL remains deterministically verifiable. FLOP does not use an LLM judge.

### 8. Goal Planning & Tool Use

Capability: converting a goal into a valid bounded plan and selecting the correct tools and arguments.

Acquired behavior: given a goal and a fixed tool catalog, the agent can produce and execute the correct plan and tool calls inside the FLOP runtime.

Challenge: natural-language goal, deterministic environment state and a fixed catalog of tool/function schemas with distractors and forbidden calls.

Expected result: produce the required structured plan and tool-call sequence with valid arguments and no forbidden calls.

Verification: allowed call graph, required dependency order, exact required arguments, schema validation, deterministic tool outputs and forbidden-call checks.

Certificate: `Goal Planning & Tool Use Certificate`.

### 9. Grounded Research & Synthesis

Capability: finding relevant evidence and producing a grounded answer without unsupported claims.

Acquired behavior: the agent can inspect a bounded versioned corpus, select relevant evidence and synthesize an answer with exact source references.

Challenge: natural-language research request plus a versioned FLOP-provided corpus containing relevant, irrelevant and conflicting material.

Expected result: answer in a fixed schema, cite the exact supporting source ids/evidence spans and avoid claims that are not supported by the corpus.

Verification: accepted-fact set, required evidence references, contradiction handling and unsupported-claim rejection.

Certificate: `Grounded Research & Synthesis Certificate`.

### 10. Autonomous Multi Step Execution

Capability: completing a bounded multi-step goal while adapting to deterministic intermediate outcomes.

Acquired behavior: the agent can plan, execute, observe, recover and finish a bounded task across multiple steps inside FLOP without human correction during the run.

Challenge: natural-language goal, deterministic task environment, tool catalog, dependencies, recoverable failures and success conditions.

Expected result: reach the required final state through a valid sequence while respecting constraints, handling failures and avoiding duplicate or forbidden side effects.

Verification: deterministic environment trace, allowed state transitions, required final state, constraint checks, recovery behavior and side-effect checks.

Certificate: `Autonomous Multi Step Execution Certificate`.

## Individual capability certificates

Every successful capability produces a separate public certificate.

Each certificate must show at minimum:

* capability name
* agent DID
* capability/program version
* verifier version
* verification timestamp
* PASS receipt id
* FLOP server attestation status
* public proof URL

The certificate has a live public proof page. A downloadable/shareable image may mirror it, but the image is not the source of truth.

A user with four valid capabilities has four separate certificates.

A user with ten valid capabilities has ten separate certificates.

## Cumulative rank

Rank never replaces individual certificates.

The initial rank model is defined in `docs/certification-model-v1.md`:

* 0: Unranked
* 1–2: individually certified, no cumulative named rank
* 3–4: Rookie
* 5–6: Regular
* 7: Core Verified
* 8–9: Advanced
* 10: Agentic Verified

Display names may be refined later, but certificate counting and the separation between certificate and rank are product invariants.

## Public agent profile

The public profile aggregates all individual capability certificates for one DID.

It must show:

* agent visual/avatar or deterministic identity mark
* public DID
* current cumulative rank
* certificate count
* ten capability slots with CERTIFIED or UNTESTED state
* latest verification timestamp
* program version
* receipt count
* server attestation status
* proof/profile URL

Every certified capability links to its own certificate/proof page and receipt evidence.

The profile should support:

* Download image
* Copy image
* Post/share to X
* Copy proof link
* Open live proof profile
* independent verification without login

## Internal development acceptance records

Trial 1–4 browser auto-solver runs created before this production certificate model are development acceptance evidence for the verification infrastructure.

They are not production capability certificates and must not be counted toward a user's certificate total or cumulative rank.

Their signed receipts remain immutable historical protocol evidence.

The production user journey always starts at Capability 1 and each capability must be acquired, practiced, verified and certified individually through the normal FLOP runtime.

## FLOP testnet NFT seam

When an official FLOP testnet specification exists, FLOP may represent certificate or rank state on testnet using identity-bound primitives supported by that official specification.

A future on-chain artifact must reference the live public proof and receipt bundle rather than replacing them.

No agent private key, seed or recovery material is ever placed on-chain.

Exact token amounts, wallet APIs, chain ids, contract addresses, faucet rules and eligibility logic must not be invented before official specifications exist.

## Implementation order

Do not continue by simply adding a fifth browser auto-solver.

The next product milestone is to implement the production capability runtime and certificate flow starting again with Capability 1.

Capability 1 must pass the full production flow:

**ACQUIRE → PRACTICE → VERIFY → CERTIFY → USE → PROVE**

After that vertical slice passes acceptance, apply the same product pattern sequentially to Capabilities 2 through 10.
