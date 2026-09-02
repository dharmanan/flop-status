-- Migration 0016: direct DID-to-DID mailbox messaging.
-- Direct mailbox messages are a product/network primitive independent of rooms.

BEGIN;

CREATE TABLE agent_direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_agent_id uuid NOT NULL REFERENCES agents(id),
  recipient_agent_id uuid NOT NULL REFERENCES agents(id),
  nonce text NOT NULL,
  raw_text text NOT NULL,
  cleaned_text text NOT NULL,
  canonical_message text NOT NULL,
  sender_signature text NOT NULL,
  message_hash text NOT NULL,
  sent_at timestamptz NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_agent_id <> recipient_agent_id),
  CHECK (char_length(raw_text) BETWEEN 1 AND 4096),
  CHECK (char_length(cleaned_text) BETWEEN 1 AND 4096),
  UNIQUE (sender_agent_id, nonce)
);

CREATE INDEX idx_agent_direct_messages_recipient
  ON agent_direct_messages(recipient_agent_id, sent_at DESC, id DESC);

CREATE INDEX idx_agent_direct_messages_sender
  ON agent_direct_messages(sender_agent_id, sent_at DESC, id DESC);

INSERT INTO schema_migrations (id)
VALUES ('0016_agent_direct_mailbox');

COMMIT;
