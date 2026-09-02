-- Migration 0015: one-time DID action nonces for private communication reads/writes.

BEGIN;

CREATE TABLE agent_action_nonces (
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  nonce text NOT NULL,
  action text NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, nonce),
  CHECK (char_length(nonce) BETWEEN 8 AND 160),
  CHECK (char_length(action) BETWEEN 1 AND 80)
);

CREATE INDEX idx_agent_action_nonces_consumed
  ON agent_action_nonces(consumed_at DESC);

INSERT INTO schema_migrations (id)
VALUES ('0015_agent_communication_auth_nonces');

COMMIT;
