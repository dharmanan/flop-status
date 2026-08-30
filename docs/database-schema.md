# PostgreSQL Database Schema v0.1

## Purpose

PostgreSQL is the durable source of truth for FLOP Capability Lab product state.

This schema supports the Trial 1 vertical slice first, while leaving clean seams for additional deterministic trials, future peer evidence, Deal Room and FLOP testnet evidence.

The schema must not store agent private keys or the Capability Lab server attestation private key.

## Design rules

1. receipts are immutable
2. submissions are immutable
3. verification runs are append only
4. challenge instances are stateful but auditable
5. server signing key private material never enters PostgreSQL
6. Technocore references are optional downstream metadata
7. PASS evidence is derived from verification and receipt records, not agent claims
8. timestamps use `timestamptz`
9. JSON payloads use `jsonb`
10. identifiers are UUIDs unless a stable semantic string id is required

## Required extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

`gen_random_uuid()` is used for opaque application identifiers.

## Enum types

```sql
CREATE TYPE challenge_state AS ENUM (
  'ISSUED',
  'SUBMITTED',
  'PASS',
  'FAIL',
  'UNKNOWN',
  'EXPIRED'
);

CREATE TYPE verification_verdict AS ENUM (
  'PASS',
  'FAIL',
  'UNKNOWN'
);

CREATE TYPE evidence_type AS ENUM (
  'CLAIMED',
  'UNTESTED',
  'DETERMINISTICALLY_VERIFIED',
  'PEER_VERIFIED',
  'UNKNOWN'
);

CREATE TYPE server_key_status AS ENUM (
  'ACTIVE',
  'RETIRED',
  'COMPROMISED'
);
```

## agents

Tracks agent identifiers known to the product.

A row does not imply human identity verification.

```sql
CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did text NOT NULL UNIQUE,
  did_method text NOT NULL,
  key_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
```

Milestone 1 accepted values:

`did_method = 'key'`

`key_type = 'Ed25519'`

## capabilities

Stable semantic capability catalog.

```sql
CREATE TABLE capabilities (
  id text PRIMARY KEY,
  category text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Initial capability:

`cryptography.signature-verification`

## capability_claims

Optional self declared claims.

Claims never create verified evidence.

```sql
CREATE TABLE capability_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id),
  capability_id text NOT NULL REFERENCES capabilities(id),
  claim_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (agent_id, capability_id, revoked_at)
);
```

This table is not required for Trial 1 implementation and may remain unused until claim UI exists.

## trial_definitions

Versioned trial contracts.

A new behavior that changes challenge semantics or expected result meaning creates a new version row rather than mutating historical rows.

```sql
CREATE TABLE trial_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trial_id text NOT NULL,
  trial_version text NOT NULL,
  capability_id text NOT NULL REFERENCES capabilities(id),
  verifier_id text NOT NULL,
  verifier_version text NOT NULL,
  canonicalization_id text NOT NULL,
  definition jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trial_id, trial_version)
);
```

Initial Trial 1 values:

`trial_id = 'ed25519-signature-verification'`

`trial_version = '1'`

`verifier_id = 'ed25519-signature-verifier'`

`verifier_version = '1'`

`canonicalization_id = 'jcs-rfc8785-v1'`

## challenge_instances

One time DID bound challenge state.

```sql
CREATE TABLE challenge_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id),
  trial_definition_id uuid NOT NULL REFERENCES trial_definitions(id),
  state challenge_state NOT NULL DEFAULT 'ISSUED',
  nonce text NOT NULL UNIQUE,
  public_payload jsonb NOT NULL,
  hidden_context jsonb NOT NULL,
  challenge_hash text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > issued_at)
);
```

The hidden context contains deterministic verifier ground truth and is never returned by public challenge APIs.

## One active challenge rule

PostgreSQL cannot use `now()` inside a stable partial unique index predicate.

Therefore the application must serialize issuance and perform an explicit active challenge query inside a transaction. This remains the primary concurrency mechanism.

Recommended lock key is the tuple:

`agent_id + trial_definition_id`

A PostgreSQL advisory transaction lock or a dedicated lock row can be used.

The application then queries for `state = 'ISSUED'` and checks expiry using server time before creating another challenge.

Expired rows should be transitioned to `EXPIRED` before a replacement challenge is inserted.

### Defense in depth: partial unique index

A partial unique index enforces the same invariant at the storage layer, independent of application correctness:

```sql
CREATE UNIQUE INDEX idx_challenges_one_active_per_agent_trial
  ON challenge_instances (agent_id, trial_definition_id)
  WHERE state = 'ISSUED';
```

Its predicate only references `state`, never `now()` or `expires_at`, so it stays a valid immutable partial index.

This index cannot decide whether an existing `ISSUED` row is expired — that judgment still requires server time and stays the application's responsibility, inside the advisory-locked transaction described above. What the index guarantees is narrower and unconditional: PostgreSQL itself refuses a second `ISSUED` row for the same `agent_id` and `trial_definition_id`, even if application logic has a bug or the advisory lock is somehow bypassed. Because the application always transitions a stale `ISSUED` row to `EXPIRED` before inserting its replacement, a correct issuance flow never conflicts with this index; an incorrect one fails loudly with a constraint violation instead of silently creating two active challenges.

The advisory transaction lock is not redundant with this index: it is what allows the expire-then-insert sequence to happen safely as one atomic step in the first place. The index is a backstop, not a replacement.

## submissions

Immutable signed submission envelopes.

Exactly one accepted submission may exist per challenge.

```sql
CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL UNIQUE REFERENCES challenge_instances(id),
  agent_id uuid NOT NULL REFERENCES agents(id),
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  result_payload jsonb NOT NULL,
  result_hash text NOT NULL,
  signature_algorithm text NOT NULL,
  signature_encoding text NOT NULL,
  signature_value text NOT NULL,
  agent_signature_valid boolean NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (agent_signature_valid = true)
);
```

Invalid signatures are rejected before a submission row is accepted.

If audit of invalid requests is required, record them only in a separate bounded security log. Do not create product submissions for unauthenticated payloads.

## verification_runs

Append only verifier executions.

```sql
CREATE TABLE verification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenge_instances(id),
  submission_id uuid NOT NULL REFERENCES submissions(id),
  verifier_id text NOT NULL,
  verifier_version text NOT NULL,
  verdict verification_verdict NOT NULL,
  reason_code text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at >= started_at)
);
```

Multiple rows are allowed so an UNKNOWN infrastructure outcome can later be reprocessed without deleting history.

For Trial 1, once PASS or FAIL has been committed, normal application logic must not run another capability verdict for that challenge.

## server_signing_keys

Public metadata only.

```sql
CREATE TABLE server_signing_keys (
  key_id text PRIMARY KEY,
  algorithm text NOT NULL,
  public_key text NOT NULL,
  public_key_encoding text NOT NULL,
  status server_key_status NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

No private key column is permitted.

The private key lives in deployment secret storage.

## receipts

Immutable Capability Lab attestations.

```sql
CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_version text NOT NULL,
  challenge_id uuid NOT NULL UNIQUE REFERENCES challenge_instances(id),
  submission_id uuid NOT NULL REFERENCES submissions(id),
  verification_run_id uuid NOT NULL UNIQUE REFERENCES verification_runs(id),
  agent_id uuid NOT NULL REFERENCES agents(id),
  capability_id text NOT NULL REFERENCES capabilities(id),
  trial_id text NOT NULL,
  trial_version text NOT NULL,
  challenge_hash text NOT NULL,
  result_hash text NOT NULL,
  verifier_id text NOT NULL,
  verifier_version text NOT NULL,
  verdict verification_verdict NOT NULL,
  evidence_type evidence_type NOT NULL,
  issued_at timestamptz NOT NULL,
  server_key_id text NOT NULL REFERENCES server_signing_keys(key_id),
  unsigned_payload jsonb NOT NULL,
  server_signature text NOT NULL,
  signature_encoding text NOT NULL,
  technocore_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (verdict = 'PASS'),
  CHECK (evidence_type = 'DETERMINISTICALLY_VERIFIED')
);
```

Milestone 1 stores public PASS receipts only.

FAIL and UNKNOWN remain represented by verification runs and challenge state.

## capability_records

Materialized product summary for fast profile reads.

This is a cache of evidence, not the fundamental evidence itself.

```sql
CREATE TABLE capability_records (
  agent_id uuid NOT NULL REFERENCES agents(id),
  capability_id text NOT NULL REFERENCES capabilities(id),
  evidence_type evidence_type NOT NULL,
  passed_trials integer NOT NULL DEFAULT 0,
  latest_receipt_id uuid REFERENCES receipts(id),
  first_verified_at timestamptz,
  last_verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, capability_id),
  CHECK (passed_trials >= 0)
);
```

For deterministic verified records, this summary must be rebuildable entirely from immutable PASS receipts.

If the summary disagrees with receipts, receipts win.

## technocore_references

Optional downstream publication records.

```sql
CREATE TABLE technocore_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES receipts(id),
  reference_type text NOT NULL,
  reference_value text NOT NULL,
  publish_state text NOT NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (receipt_id, reference_type, reference_value)
);
```

No Technocore record participates in PASS calculation.

## audit_events

Security and state transition audit trail.

```sql
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  agent_id uuid REFERENCES agents(id),
  challenge_id uuid REFERENCES challenge_instances(id),
  submission_id uuid REFERENCES submissions(id),
  receipt_id uuid REFERENCES receipts(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Do not place agent private keys, server private keys or secret environment values in audit metadata.

## Indexes

```sql
CREATE INDEX idx_challenges_agent_trial_state
  ON challenge_instances(agent_id, trial_definition_id, state);

CREATE INDEX idx_challenges_expires_at
  ON challenge_instances(expires_at);

CREATE INDEX idx_verification_runs_challenge
  ON verification_runs(challenge_id, created_at DESC);

CREATE INDEX idx_receipts_agent_capability
  ON receipts(agent_id, capability_id, issued_at DESC);

CREATE INDEX idx_audit_challenge
  ON audit_events(challenge_id, created_at DESC);
```

## Trial 1 seed data

```sql
INSERT INTO capabilities (id, category, name, description)
VALUES (
  'cryptography.signature-verification',
  'Cryptography',
  'Ed25519 Signature Verification',
  'Demonstrates the ability to determine whether an Ed25519 signature is valid for an exact public key and message.'
)
ON CONFLICT (id) DO NOTHING;
```

The trial definition seed should be installed through an application migration or seed script so the full JSON definition remains version controlled with the verifier implementation.

## Transaction boundaries

### Challenge issuance

One transaction must:

1. serialize issuance for agent and trial
2. mark stale ISSUED challenge rows EXPIRED when applicable
3. verify no active challenge remains
4. insert the new challenge

### Submission acceptance

One transaction must:

1. lock the challenge row
2. validate state and server time expiry
3. insert one submission
4. update challenge state to SUBMITTED

### PASS finalization

One transaction must:

1. insert verification run
2. insert signed receipt
3. update challenge state to PASS
4. upsert capability record summary

A receipt must never exist without its corresponding verification run.

### FAIL finalization

One transaction must:

1. insert verification run
2. update challenge state to FAIL

No public verified receipt is created.

## Expiry maintenance

Reading a challenge whose `state = ISSUED` and `expires_at <= server now()` should transition or logically represent it as EXPIRED.

A scheduled cleanup process may normalize stale rows later, but correctness must not depend on a scheduler.

## Migration rule

Schema changes are forward migrations.

Do not rewrite historical receipt rows to match a new verifier or trial contract.

Changes that alter cryptographic payload meaning require version changes in the relevant specification and stored records.
