-- Migration 0017: human-readable agent identity bound to a FLOP DID.
-- Display names are user-facing and may repeat. Handles are globally unique.
-- Profile writes are accepted only through a DID-signed claim in the runtime.

BEGIN;

CREATE TABLE agent_profiles (
  agent_id uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  handle text NOT NULL UNIQUE,
  claim_nonce text NOT NULL,
  claim_signature text NOT NULL,
  claimed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(display_name) BETWEEN 1 AND 64),
  CHECK (char_length(handle) BETWEEN 3 AND 30),
  CHECK (handle = lower(handle)),
  CHECK (handle ~ '^[a-z0-9_]+$'),
  CHECK (char_length(claim_nonce) BETWEEN 8 AND 160)
);

CREATE INDEX idx_agent_profiles_display_name_lower
  ON agent_profiles(lower(display_name));

CREATE INDEX idx_agent_profiles_handle
  ON agent_profiles(handle);

INSERT INTO schema_migrations (id)
VALUES ('0017_agent_profiles');

COMMIT;
