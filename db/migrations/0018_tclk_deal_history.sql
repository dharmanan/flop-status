-- Migration 0018: durable index/archive for verified TCLK deal history.
-- TCLK remains the state-machine authority. PostgreSQL stores only verified
-- signed transport evidence and metadata so completed deals survive ephemeral
-- Technocore room retention.

BEGIN;

CREATE TABLE tclk_deals (
  offer_id text PRIMARY KEY,
  contract_id text UNIQUE,
  payer_did text NOT NULL,
  payee_did text,
  amount text NOT NULL,
  asset text NOT NULL,
  job_id text,
  job_context text,
  status text NOT NULL,
  offer_expires_ms bigint,
  claim_by_ms bigint,
  refund_after_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (offer_id ~ '^0x[0-9a-f]{64}$'),
  CHECK (contract_id IS NULL OR contract_id ~ '^0x[0-9a-f]{64}$'),
  CHECK (payer_did LIKE 'did:key:%'),
  CHECK (payee_did IS NULL OR payee_did LIKE 'did:key:%'),
  CHECK (status IN ('proposed','accepted','locked','claimed','refunded','cancelled'))
);

CREATE INDEX idx_tclk_deals_payer_updated
  ON tclk_deals(payer_did, updated_at DESC);

CREATE INDEX idx_tclk_deals_payee_updated
  ON tclk_deals(payee_did, updated_at DESC);

CREATE TABLE tclk_deal_frames (
  room text NOT NULL,
  seq bigint NOT NULL,
  offer_id text NOT NULL REFERENCES tclk_deals(offer_id) ON DELETE CASCADE,
  frame_type text NOT NULL,
  from_did text NOT NULL,
  line text NOT NULL,
  frame jsonb NOT NULL,
  transport_sig text NOT NULL,
  transport_nonce text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room, seq),
  CHECK (frame_type IN ('offer','accept','lock','reveal','refund','cancel','receipt')),
  CHECK (from_did LIKE 'did:key:%')
);

CREATE INDEX idx_tclk_deal_frames_offer_seq
  ON tclk_deal_frames(offer_id, room, seq);

INSERT INTO schema_migrations (id)
VALUES ('0018_tclk_deal_history');

COMMIT;
