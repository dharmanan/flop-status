# Roadmap

## Now

Build and accept Production Capability 2: Canonical JSON + SHA256 through the same proven production certificate flow as Capability 1.

Required product flow:

**ACQUIRE → PRACTICE → VERIFY → CERTIFY → USE → PROVE**

Required outcome:

* Capability 1 remains completed and independently certified
* Capability 2 stays locked until an ACTIVE Capability 1 production certificate exists
* the prerequisite is enforced by backend as well as UI
* the user explicitly acquires Capability 2 inside FLOP
* FLOP attaches `canonical-json-sha256-browser@1` to the agent profile
* practice is optional and creates no certificate
* production verification uses `canonical-json-sha256-certification@1`
* challenge contains public JSON but not expected canonical JSON/hash
* the same capability implementation handles Practice, Verify and Use
* the browser-owned DID signs the exact result submission
* the deterministic verifier independently recomputes RFC 8785 canonical JSON and SHA256
* wrong answer creates FAIL with no receipt/certificate
* PASS creates normal server-signed receipt and individual Certificate 2
* certificate count becomes two without unlocking a cumulative rank
* historical `canonical-json-sha256@1` acceptance evidence remains excluded
* public certificate proof and independent receipt verification work
* no LLM is required

Acceptance contract: `docs/acceptance/capability2-production-acceptance.md`

## Completed production capability

1. Capability 1: Ed25519 Signature Verification

Accepted production behavior includes explicit acquisition, same-module Practice/Verify/Use, fresh challenge, deterministic verification, individual Certificate 1, public proof and durable reload state.

## Next

Apply the same production pattern sequentially:

3. Capability 3: Technocore Canonical Message Construction
4. Capability 4: Signed Receipt Verification
5. Capability 5: Structured Data Transformation
6. Capability 6: Constraint and Policy Compliance
7. Capability 7: Failure Recovery and Idempotency
8. Capability 8: Goal Planning & Tool Use, optional LLM
9. Capability 9: Grounded Research & Synthesis, optional LLM
10. Capability 10: Autonomous Multi Step Execution, optional LLM

Every PASS issues a separate certificate.

Cumulative rank remains independent from certificate issuance:

* 3–4 certificates: Rookie
* 5–6 certificates: Regular
* 7 certificates: Core Verified
* 8–9 certificates: Advanced
* 10 certificates: Agentic Verified

## After capability runtime completion

* complete the public agent profile aggregating all individual certificates
* expose cumulative rank on profile
* add certificate image download/copy/share surfaces
* refine final premium product UI and onboarding
* add optional official testnet integration only when an official specification exists

## FLOP v1 completion target

Product v1 is not complete until:

* identity ownership and portable recovery remain intact
* all seven deterministic Core capabilities are individually acquirable, usable, verifiable and certifiable
* all three optional Agentic capabilities require explicit LLM opt-in and use deterministic verdicts
* every certificate has a public proof URL and independently verifiable receipt
* the public profile aggregates individual certificates and cumulative rank
* FLOP-managed execution remains contained inside FLOP
* idle agents do not create permanently running services

## Historical infrastructure milestones

Identity and development Trials 1–4 established the shared verification infrastructure. Their historical receipts remain immutable protocol evidence but do not count toward production certificate totals or rank.

## Later

* optional Technocore evidence publication
* peer verified evidence class
* Deal Room seam
* official FLOP testnet integration when specification exists
* identity-bound certificate/rank representation only if official testnet primitives support it

## Not planned for current v1 core

* public arbitrary third-party invocation of FLOP-managed agents
* permanently running agent service per user
* messaging/inbox/passport product
* subjective reputation score
* speculative wallet/faucet/token implementation
* airdrop prediction
* LLM judge
* generic unrestricted orchestrator
* arbitrary user code execution
