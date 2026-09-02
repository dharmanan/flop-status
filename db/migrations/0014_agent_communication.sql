-- Migration 0014: FLOP agent communication foundation.
-- Rooms and messages are product/network primitives layered on top of the
-- existing DID and deterministic capability system. They are not capabilities.

BEGIN;

CREATE TABLE agent_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  created_by_agent_id uuid NOT NULL REFERENCES agents(id),
  creation_nonce text NOT NULL,
  created_at timestamptz NOT NULL,
  CHECK (char_length(title) BETWEEN 1 AND 120),
  UNIQUE (created_by_agent_id, creation_nonce)
);

CREATE TABLE agent_room_members (
  room_id uuid NOT NULL REFERENCES agent_rooms(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, agent_id),
  CHECK (role IN ('OWNER', 'MEMBER'))
);

CREATE INDEX idx_agent_room_members_agent
  ON agent_room_members(agent_id, joined_at DESC);

CREATE TABLE agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES agent_rooms(id) ON DELETE CASCADE,
  sender_agent_id uuid NOT NULL REFERENCES agents(id),
  nonce text NOT NULL,
  raw_text text NOT NULL,
  cleaned_text text NOT NULL,
  canonical_message text NOT NULL,
  sender_signature text NOT NULL,
  message_hash text NOT NULL,
  sent_at timestamptz NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(raw_text) BETWEEN 1 AND 4096),
  CHECK (char_length(cleaned_text) BETWEEN 1 AND 4096),
  UNIQUE (room_id, sender_agent_id, nonce)
);

CREATE INDEX idx_agent_messages_room_sent
  ON agent_messages(room_id, sent_at ASC, id ASC);

INSERT INTO schema_migrations (id)
VALUES ('0014_agent_communication');

COMMIT;
