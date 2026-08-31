# Trial 3 Acceptance Results — 2026-08-31

Result: PASS

Trial: `technocore-canonical-message@1`

Capability: `protocol.technocore-canonical-message`

Reference canonical form: `room|nonce|cleaned text`

## Reference correctness

Trial 3 follows the inspected Technocore reference implementation rather than the earlier program-summary approximation.

The reference cleans message text by replacing control/C1/U+2028/U+2029 characters with spaces, collapsing whitespace and trimming it. The signed canonical string is exactly:

`room|nonce|cleaned text`

The sender DID is carried separately by Technocore and is not inserted into this canonical string. FLOP still binds its own challenge and signed submission to the agent DID.

## Automated verification

GitHub Actions run `33436891527` passed:

* 34 test files
* 168 tests
* typecheck
* build
* high-severity dependency audit
* deployed Trial 3 acceptance

Automated Trial 3 coverage includes:

* whitespace/control cleaning fixture
* Unicode fixture
* pipe-character fixture
* plain-text fixture
* strict challenge/result/submission schemas
* unknown-field rejection
* exact canonical PASS
* cleaned-text mismatch FAIL
* canonical-message mismatch FAIL
* hidden verifier-context tamper rejection
* migration metadata seed
* semantic Technocore network-independence checks
* browser custody/network-boundary checks

## Deployed vertical slice

The production Railway API completed both deterministic outcomes for a fresh Ed25519 `did:key`.

PASS path:

DID → Trial 3 challenge → local reference cleaning/canonical construction → DID-signed submission → deterministic PASS → server-signed receipt → public receipt verification → durable public capability evidence.

FAIL path:

A second DID-signed result deliberately changed the canonical message. The deterministic verifier returned FAIL with no receipt, and the existing verified capability count remained unchanged.

Recorded deployed evidence from run `33436891527`:

* deployed Trial 3: PASS
* deterministic PASS: PASS
* deterministic mismatch: `FAIL_WITHOUT_RECEIPT`
* Technocore network dependency: NONE
* public receipt signature: VALID
* durable capability evidence: `PASS_COUNT_1`
* agent DID: `did:key:z6MkefpJ3fBPUDudnE2yivdsjmfvkagN6Ytuh6KSwMAYsgMH`
* receipt id: `4073532f-5b49-4797-b0d4-ba35eebe5731`

## Browser product surface

The deployed Vercel capability list exposes Trial 1, Trial 2 and Trial 3 for the same browser-owned DID.

Trial 3 is solved locally using the same reference cleaning rule and exact `room|nonce|cleaned text` construction, then uses the existing nonextractable browser Ed25519 key to sign the normal FLOP submission envelope.

The browser surface shows `N of 3 verified` and refreshes the same durable public agent evidence after PASS.

Browser wiring and custody regression tests passed, and the corresponding Vercel and Railway deployment statuses reported success.

## Acceptance conclusion

Trial 3 satisfies `docs/acceptance/trial3-acceptance.md` without making Technocore availability part of core verification and without introducing a parallel challenge, submission, receipt or evidence architecture.
