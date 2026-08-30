-- Migration 0001: Trial 1 persistence foundation
--
-- Creates the minimum tables required for Trial 1 challenge issuance, per
-- docs/database-schema.md: agents, capabilities, trial_definitions,
-- challenge_instances. Submissions, verification runs, receipts and later
-- tables are added in a future migration once that scope is implemented.
--
-- This is a one-time forward migration (not re-runnable): CREATE TYPE has no
-- IF NOT EXISTS form in PostgreSQL, so re-running it against an
-- already-migrated database is expected to fail at that statement. Only the
-- Trial 1 seed data at the end is idempotent (ON CONFLICT DO NOTHING), as
-- required for safe use alongside manual/future re-seeding.
--
-- No column in this migration stores a private key or other secret. The
-- hidden_context column holds only deterministic verifier ground truth
-- (expected_valid / case_class), never returned by any public challenge API.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE challenge_state AS ENUM (
  'ISSUED',
  'SUBMITTED',
  'PASS',
  'FAIL',
  'UNKNOWN',
  'EXPIRED'
);

CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did text NOT NULL UNIQUE,
  did_method text NOT NULL,
  key_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE capabilities (
  id text PRIMARY KEY,
  category text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

-- One time DID bound challenge state. See "One active challenge rule" in
-- docs/database-schema.md: the application (lib/db + lib/challenges) is
-- responsible for serializing issuance via an advisory transaction lock
-- keyed on (agent_id, trial_definition_id) — PostgreSQL cannot express that
-- rule as a stable partial unique index because it depends on now().
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

CREATE INDEX idx_challenges_agent_trial_state
  ON challenge_instances(agent_id, trial_definition_id, state);

CREATE INDEX idx_challenges_expires_at
  ON challenge_instances(expires_at);

-- Defense in depth for the "one active challenge" rule (see
-- docs/database-schema.md). The advisory transaction lock in
-- lib/db/challenge-repository.ts remains the primary concurrency
-- mechanism — it is what lets the application decide to expire a stale
-- ISSUED row and insert its replacement inside one transaction. This
-- partial unique index cannot express that expiry judgment (its predicate
-- must stay immutable, so it cannot reference now() or expires_at); what it
-- guarantees is narrower and unconditional: PostgreSQL itself will never
-- allow two ISSUED rows to exist for the same (agent_id,
-- trial_definition_id), even if application logic has a bug or the lock is
-- somehow bypassed. Because the service always transitions a stale ISSUED
-- row to EXPIRED before inserting a new one, the replacement insert never
-- conflicts with a row this index still considers active.
CREATE UNIQUE INDEX idx_challenges_one_active_per_agent_trial
  ON challenge_instances (agent_id, trial_definition_id)
  WHERE state = 'ISSUED';

-- Trial 1 seed data (idempotent: safe to re-run this section, e.g. if a
-- future migration tool replays it, or if it is applied manually more than
-- once).
INSERT INTO capabilities (id, category, name, description)
VALUES (
  'cryptography.signature-verification',
  'Cryptography',
  'Ed25519 Signature Verification',
  'Demonstrates the ability to determine whether an Ed25519 signature is valid for an exact public key and message.'
)
ON CONFLICT (id) DO NOTHING;

-- Values below must stay in sync with
-- lib/trials/ed25519-signature-verification/constants.ts and the
-- CHALLENGE_TTL_MS in challenge-generator.ts. A future change to any of
-- these is a new trial_version row, not an edit to this one (forward
-- migrations only, per docs/database-schema.md "Migration rule").
INSERT INTO trial_definitions (
  trial_id, trial_version, capability_id, verifier_id, verifier_version,
  canonicalization_id, definition
)
VALUES (
  'ed25519-signature-verification',
  '1',
  'cryptography.signature-verification',
  'ed25519-signature-verifier',
  '1',
  'jcs-rfc8785-v1',
  '{"challenge_version":"1","submission_version":"1","challenge_ttl_ms":600000,"case_classes":["VALID_SIGNATURE","INVALID_SIGNATURE"]}'::jsonb
)
ON CONFLICT (trial_id, trial_version) DO NOTHING;

COMMIT;
