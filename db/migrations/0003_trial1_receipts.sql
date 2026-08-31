-- Migration 0003: Trial 1 verification runs, server public keys, PASS receipts
-- and derived capability records.
--
-- Server attestation private key material is intentionally absent. Only public
-- key metadata is persisted.

BEGIN;

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

CREATE TABLE receipts (
  id uuid PRIMARY KEY,
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

CREATE INDEX idx_verification_runs_challenge
  ON verification_runs(challenge_id, created_at DESC);

CREATE INDEX idx_receipts_agent_capability
  ON receipts(agent_id, capability_id, issued_at DESC);

INSERT INTO schema_migrations (id)
VALUES ('0003_trial1_receipts');

COMMIT;
