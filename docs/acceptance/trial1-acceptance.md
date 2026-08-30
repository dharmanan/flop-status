# Trial 1 Acceptance Plan v0.1

## Goal

Prove the first complete Capability Lab vertical slice in clean environments before adding Trial 2.

The test target is:

Fresh browser → Ed25519 did:key → unique challenge → signed submission → deterministic PASS → persisted server signed receipt → refresh persistence → separate browser public verification.

## Environment assumptions

The acceptance environment must use the same application and PostgreSQL instance for both browsers.

Technocore may be disabled or unreachable.

No browser may rely on state restored from the old Technocore Agent Console.

## Gate A: repository and configuration

PASS only if:

1. application starts from a clean checkout
2. database migrations succeed on an empty PostgreSQL database
3. Trial 1 seed exists exactly once
4. server public attestation key metadata is readable
5. private attestation key is provided only through secret configuration
6. no private key value appears in source control or database schema

## Gate B: agent key custody

PASS only if:

1. a fresh browser can create an Ed25519 signing identity
2. resulting DID is a supported `did:key`
3. active private signing material is not stored as plaintext JWK in localStorage
4. private key never appears in network requests
5. a deliberate backup mechanism, if present in the milestone, is encrypted

Backup UI is not required to pass Trial 1 if key creation and signing work correctly, but insecure plaintext backup is forbidden.

## Gate C: challenge issuance

Create a Trial 1 challenge for the agent DID.

PASS only if:

1. challenge is bound to the exact DID
2. challenge has trial id and version
3. challenge has unique nonce
4. challenge has server issued and expiry timestamps
5. expiry is ten minutes after issuance within expected clock precision
6. public challenge does not expose hidden expected validity
7. stored challenge hash matches RFC 8785 canonical public payload
8. a second active challenge for the same DID and trial is refused

## Gate D: valid agent submission signature

Produce the correct structured result and sign the submission payload with the agent key.

PASS only if:

1. server verifies the DID signature
2. accepted submission is persisted once
3. challenge transitions to SUBMITTED before verdict finalization
4. persisted payload hash matches the exact canonical signed payload
5. persisted result hash matches the exact canonical result object

## Gate E: signature tamper rejection

Starting from a valid signed submission, modify one signed field after signing.

Examples:

challenge id

challenge hash

result.valid

result.message_hash

agent DID

PASS only if the modified request is rejected as an invalid agent signature or binding error and does not create a capability FAIL verdict.

## Gate F: DID binding

Create Challenge A for DID A.

Attempt to submit it with DID B and a valid DID B signature.

PASS only if:

1. request is rejected
2. no submission for DID B is accepted
3. no PASS or FAIL verdict is created
4. Challenge A remains unconsumed if no valid DID A submission was accepted

## Gate G: deterministic PASS

Submit a fully correct Trial 1 answer.

PASS only if:

1. verifier executes without external network dependencies
2. result boolean matches hidden expected validity
3. reason code matches the boolean
4. message hash matches SHA-256 of exact challenge message bytes
5. verification run is persisted as PASS
6. challenge transitions to PASS
7. exactly one PASS receipt is created
8. capability record reflects deterministic verified evidence

## Gate H: deterministic FAIL

On a new challenge, submit a DID signed, structurally valid but incorrect Trial 1 answer.

PASS only if:

1. agent signature is valid
2. deterministic verifier actually executes
3. verification run is persisted as FAIL
4. challenge transitions to FAIL
5. no public deterministic verified receipt is created
6. public capability record does not increment from the failed trial

This is the only path in which capability FAIL is expected.

## Gate I: expired challenge

Create a challenge and make it expired using controlled test clock or test fixture support.

Attempt a correctly signed submission.

PASS only if:

1. request cannot produce PASS
2. request cannot produce capability FAIL
3. challenge is represented as EXPIRED
4. no accepted submission is created after expiry
5. user can request a fresh replacement challenge

## Gate J: replay and race

### Sequential replay

Send the exact same accepted submission twice.

PASS only if exactly one submission exists and no second receipt is created.

### Concurrent race

Send two valid submission requests for the same ISSUED challenge concurrently.

PASS only if exactly one consumes the challenge.

Database constraints and locking must enforce the invariant even if application requests overlap.

## Gate K: UNKNOWN semantics

Force an internal verifier finalization failure after a signed submission has been accepted, using a controlled test fault.

PASS only if:

1. system does not label the capability FAIL
2. no deterministic verified receipt is issued
3. user facing state distinguishes infrastructure uncertainty from incorrect result
4. stored submission can be inspected or safely reprocessed internally

Technocore failure is also tested here and must have no effect on core PASS or FAIL determination.

## Gate L: receipt cryptography

For a successful PASS receipt:

PASS only if:

1. unsigned receipt fields match persisted challenge, result and verifier metadata
2. receipt payload canonicalizes using RFC 8785
3. server signature verifies with public key selected by `server_key_id`
4. changing one unsigned receipt field causes signature verification to fail
5. changing the server signature causes verification to fail
6. no server private key is returned by public APIs

## Gate M: refresh persistence

After PASS:

1. hard refresh the browser
2. reopen the agent capability page
3. reopen the receipt page

PASS only if the persisted evidence remains available and consistent.

No successful state may depend solely on React state, memory or localStorage.

## Gate N: separate clean browser

Open the public receipt URL in a completely separate clean browser context.

This browser must not contain the agent private key or application local state.

PASS only if it can retrieve the receipt, obtain the required public server key and display:

`Receipt signature: VALID`

It must also show the same:

agent DID

capability

trial version

verifier version

challenge hash

result hash

issue time

## Gate O: Technocore independence

Disable or block all Technocore access.

Repeat the successful Trial 1 path.

PASS only if challenge issuance, signed submission, deterministic verification, receipt generation, persistence and public verification all still work.

## Gate P: clean database rebuild

Against a new empty PostgreSQL database:

1. run migrations
2. run seed
3. start application
4. execute the full successful Trial 1 flow

PASS only if no manual database patching is needed.

## Automated test minimum

Before declaring Trial 1 complete, automated tests must cover at least:

1. RFC 8785 canonicalization fixtures
2. did:key Ed25519 decoding and rejection cases
3. agent signature valid and invalid cases
4. Trial 1 valid signature challenge
5. Trial 1 invalid signature challenge
6. message hash comparison
7. challenge expiry
8. challenge DID binding
9. one submission per challenge
10. concurrent replay protection
11. PASS receipt signature
12. receipt tampering detection
13. UNKNOWN is not FAIL
14. capability record derivation from PASS receipts
15. Technocore adapter not imported by core verifier path

## Browser matrix for milestone 1

At minimum test current stable versions of:

Chrome desktop

Safari desktop

Mobile Safari on iPhone

If WebCrypto Ed25519 persistence behavior differs across browsers, document the supported custody path before declaring completion.

## Completion statement

Do not write `Trial 1 complete`, `MVP core works` or equivalent until all required gates above have passed in the actual deployed acceptance environment.

Passing unit tests alone is insufficient.
