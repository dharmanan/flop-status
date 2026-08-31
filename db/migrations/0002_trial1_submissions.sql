-- Migration 0002: Trial 1 signed submissions
--
-- Adds immutable accepted submission persistence. Invalid or unauthenticated
-- requests never create rows here. Exactly one accepted submission may exist
-- per challenge.

BEGIN;

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

CREATE INDEX idx_submissions_agent_created
  ON submissions(agent_id, created_at DESC);

COMMIT;
