# Production Capability 2–4 Acceptance

Capabilities:

2. Canonical JSON + SHA256 — `data.canonical-json-sha256`
3. Technocore Canonical Message Construction — `protocol.technocore-canonical-message`
4. Signed Receipt Verification — `evidence.signed-receipt-verification`

Program class: Core. LLM required: No. Certificate eligible: Yes.

This contract extends `docs/acceptance/capability1-production-acceptance.md`. Everything required there for identity custody, challenge safety, receipt immutability and public proof continues to apply unchanged.

## Sequential gating

The order is a product invariant and must hold against direct API calls, not only in the UI.

* Capability 2 acquisition requires an ACTIVE `Ed25519 Signature Verification Certificate`.
* Capability 3 acquisition requires an ACTIVE `Canonical JSON + SHA256 Certificate`.
* Capability 4 acquisition requires an ACTIVE `Technocore Canonical Message Certificate`.
* A production certification challenge is issued only when the matching capability is installed for that DID.

An unmet prerequisite is a `PREREQUISITE_CERTIFICATE_MISSING` conflict. A missing installation is a `CAPABILITY_NOT_INSTALLED` conflict.

## Production-version separation

Each capability has two distinct trial ids:

| # | Historical trial id | Production trial id |
| - | ------------------- | ------------------- |
| 2 | `canonical-json-sha256` | `canonical-json-sha256-certification` |
| 3 | `technocore-canonical-message` | `technocore-canonical-message-certification` |
| 4 | `signed-receipt-verification` | `signed-receipt-verification-certification` |

Historical receipts remain immutable, remain publicly verifiable as protocol evidence, and never create a certificate record, never count toward certificate totals and never affect rank.

## Capability semantics that must not drift

**Capability 2.** RFC 8785 JCS canonical form plus the SHA-256 digest of its UTF-8 bytes. The browser canonicalizer must agree byte-for-byte with the server canonicalizer, including Unicode keys, nested structures, array ordering and numeric edge cases.

**Capability 3.** The signed canonical form is `room|nonce|cleaned text`. The cleaning rule is the existing FLOP source of truth in `lib/trials/technocore-canonical-message/protocol.ts`: control characters and U+2028/U+2029 become spaces, whitespace runs collapse to one space, the result is trimmed, and empty or over-long text is rejected. No alternative canonicalization may be introduced, and core verification must not call Technocore.

**Capability 4.** Statuses and reason codes come from the existing Trial 4 verifier:

* declared key present and signature verifies → `VALID` / `SIGNATURE_VALID` / declared key id
* declared key present, signature fails, another supplied key verifies → `INVALID` / `KEY_ID_MISMATCH` / the actually-signing key id
* declared key present, no supplied key verifies → `INVALID` / `SIGNATURE_INVALID` / declared key id
* declared key absent from the supplied set → `UNKNOWN` / `SERVER_KEY_NOT_FOUND` / `null`

`UNKNOWN` is missing key material, not failed evidence. It must never be reported or displayed as `INVALID` or as a capability failure.

## One module for practice, verification and use

Each capability exposes exactly one browser executor:

* `executeCanonicalJsonSha256`
* `executeTechnocoreCanonicalMessage`
* `executeSignedReceiptVerification`

The same function must serve practice, the certification challenge and normal FLOP use. There must be no certification-specific solver, and the module must receive only the public challenge input, never the hidden expected answer.

## Certificates and rank

A production PASS creates one individual certificate bound to the agent DID, capability id and version, program version, production trial id and version, verifier id and version, PASS receipt id and issue timestamp.

Certificate count and cumulative rank stay separate. Rank is derived from the count of ACTIVE certificates:

* 1–2 certificates: individually certified, no named cumulative rank
* 3 certificates (Capability 3 PASS): `Rookie`
* 4 certificates (Capability 4 PASS): `Rookie` continues

## Verification flow surface

Capabilities 1–4 share one verification run surface with steps: fresh challenge prepared, capability running, result produced, signed with the DID, FLOP verifying independently, verdict, and — on PASS only — certificate issued.

Each step must advance from a real asynchronous event. Simulated progress is not acceptable. FAIL marks the verdict step as failed and shows no certificate step. UNKNOWN uses its own state and is visually distinct from FAIL.

## Local verification status

Verified in this change set:

* browser canonicalization matches the server RFC 8785 implementation across nested, Unicode, array and numeric edge cases
* each browser module PASSes the corresponding deterministic verifier on freshly generated production challenges for every case class
* Capability 4 returns `UNKNOWN` for an unknown declared key, `SIGNATURE_INVALID` for tampered evidence and `KEY_ID_MISMATCH` naming the actually-signing key
* browser Technocore cleaning matches the server protocol implementation
* correct production results issue exactly one correctly named certificate; wrong results FAIL with no receipt and no certificate; historical trial PASSes create a receipt and no certificate
* sequential gating blocks acquisition without the prerequisite certificate and blocks challenge issuance without installation
* three certificates derive `Rookie`, four certificates keep `Rookie`, revoked certificates do not count
* the verification run steps are bound to real operations and no timer advances them

Not yet verified:

* migrations 0008–0010 applied to a live PostgreSQL instance
* a deployed browser acceptance run for Capabilities 2, 3 and 4

Until both are done, Capabilities 2–4 are implemented but not accepted, and Capability 5 must not begin.
