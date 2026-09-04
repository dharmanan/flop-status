-- Migration 0020: venue- and room-generation-scope TCLK durable history.
--
-- Two independent collision dimensions, both real:
--  1. offer_id/contract_id are content hashes over agent-chosen offer/accept
--     fields (@flop-labs/tclk), not scoped to a venue by the protocol.
--     Official Technocore and a self-host Technocore deployment can produce
--     the same offer_id, and already share room names (tclk-offers,
--     mb-p-tclk-*) with independent seq counters.
--  2. A Technocore room has a generation (epoch). Reaping and recreating a
--     room restarts seq under a new, higher generation, so (room, seq) is
--     not even a stable key within one venue over time.
--
-- Every row that exists before this migration is official Technocore
-- history. It is backfilled to venue = 'https://technocore.chat' -- a known
-- fact, not a guess: this deployment has only ever talked to that venue.
-- Its original room generation was never recorded and is left NULL, meaning
-- "unknown", never a guessed real value. Technocore itself uses the integer
-- 0 for "room never existed", so 0 is reserved for that and never stored on
-- a frame (an empty room has no messages to produce frame rows from).

BEGIN;

-- 1-3: tclk_deals gets an explicit venue, backfilled for every existing row.
ALTER TABLE tclk_deals ADD COLUMN venue text;
UPDATE tclk_deals SET venue = 'https://technocore.chat' WHERE venue IS NULL;
ALTER TABLE tclk_deals ALTER COLUMN venue SET NOT NULL;
ALTER TABLE tclk_deals ADD CONSTRAINT tclk_deals_venue_check CHECK (venue ~ '^https://' AND venue !~ '/$');

-- 4-6: tclk_deal_frames gets venue, room_generation, and a physical-record
-- fingerprint for the case a real generation is not known. All three are
-- backfilled conservatively for existing rows: venue is a known fact,
-- generation and fingerprint are left NULL rather than fabricated.
ALTER TABLE tclk_deal_frames ADD COLUMN venue text;
ALTER TABLE tclk_deal_frames ADD COLUMN room_generation integer;
ALTER TABLE tclk_deal_frames ADD COLUMN transport_record_fingerprint text;
UPDATE tclk_deal_frames SET venue = 'https://technocore.chat' WHERE venue IS NULL;
-- room_generation and transport_record_fingerprint are deliberately left
-- NULL for every pre-existing row.
ALTER TABLE tclk_deal_frames ALTER COLUMN venue SET NOT NULL;
ALTER TABLE tclk_deal_frames ADD CONSTRAINT tclk_deal_frames_venue_check CHECK (venue ~ '^https://' AND venue !~ '/$');
ALTER TABLE tclk_deal_frames ADD CONSTRAINT tclk_deal_frames_room_generation_check CHECK (room_generation IS NULL OR room_generation > 0);
ALTER TABLE tclk_deal_frames ADD CONSTRAINT tclk_deal_frames_fingerprint_check CHECK (transport_record_fingerprint IS NULL OR transport_record_fingerprint ~ '^[0-9a-f]{64}$');

-- 7: drop the frame -> deal FK FIRST. It references tclk_deals_pkey, which
-- step 8 is about to drop -- PostgreSQL refuses to drop a PK/unique
-- constraint a live FK still depends on, so this ordering is load-bearing.
ALTER TABLE tclk_deal_frames DROP CONSTRAINT tclk_deal_frames_offer_id_fkey;

-- 8-9: re-key tclk_deals. Nothing depends on its old PK/unique anymore.
ALTER TABLE tclk_deals DROP CONSTRAINT tclk_deals_pkey;
ALTER TABLE tclk_deals ADD PRIMARY KEY (venue, offer_id);
ALTER TABLE tclk_deals DROP CONSTRAINT tclk_deals_contract_id_key;
ALTER TABLE tclk_deals ADD CONSTRAINT tclk_deals_venue_contract_id_key UNIQUE (venue, contract_id);

-- 10-11: re-key tclk_deal_frames onto a surrogate id. Nothing else in the
-- schema references tclk_deal_frames_pkey, so there is no ordering
-- dependency here beyond step 7 already being done.
ALTER TABLE tclk_deal_frames DROP CONSTRAINT tclk_deal_frames_pkey;
ALTER TABLE tclk_deal_frames ADD COLUMN id bigserial;
ALTER TABLE tclk_deal_frames ADD PRIMARY KEY (id);

-- 12-13: rebuild the offer-lookup index for the new venue-scoped shape.
DROP INDEX idx_tclk_deal_frames_offer_seq;
CREATE INDEX idx_tclk_deal_frames_venue_offer_seq ON tclk_deal_frames(venue, offer_id, room, seq);

-- 14: known-generation physical identity -- a partial index so it only
-- constrains rows where the generation is actually established.
CREATE UNIQUE INDEX tclk_deal_frames_known_generation_key
  ON tclk_deal_frames (venue, room, room_generation, seq)
  WHERE room_generation IS NOT NULL;

-- 15: unknown-generation physical identity, keyed by a content fingerprint
-- rather than seq -- seq is not trusted to be stable without a generation.
-- Deliberately NOT keyed on transport_sig: a signature covers room|nonce|
-- text but not seq or the server-assigned ts, and a signed record can
-- legitimately be re-accepted by Technocore outside its narrow replay
-- window, producing a second genuine venue append with the same signature.
CREATE UNIQUE INDEX tclk_deal_frames_unknown_generation_key
  ON tclk_deal_frames (venue, transport_record_fingerprint)
  WHERE room_generation IS NULL AND transport_record_fingerprint IS NOT NULL;

-- 16: the new composite FK -- valid now that tclk_deals has a (venue,
-- offer_id) primary key (step 8) for it to reference. This is what makes
-- "a frame can only attach to a deal in its own venue" a database-enforced
-- invariant, not an application convention.
ALTER TABLE tclk_deal_frames
  ADD CONSTRAINT tclk_deal_frames_venue_offer_id_fkey
  FOREIGN KEY (venue, offer_id) REFERENCES tclk_deals(venue, offer_id) ON DELETE CASCADE;

-- idx_tclk_deals_payer_updated / idx_tclk_deals_payee_updated: left exactly
-- as-is, on purpose. A payer or payee's own deal history must remain
-- readable across every venue they ever used, not just the current one.

-- 17-18: register and commit.
INSERT INTO schema_migrations (id) VALUES ('0020_tclk_venue_scoping');

COMMIT;
