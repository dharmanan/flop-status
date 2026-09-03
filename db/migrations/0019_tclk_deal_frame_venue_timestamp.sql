-- Migration 0019: preserve each archived TCLK frame's authoritative Technocore
-- venue timestamp. Historical reconstruction must fold frames in the order they
-- actually happened and evaluate each one at the moment it happened, not at
-- "offer room first, deal room second" plus today's wall clock. NULL means the
-- frame was archived before this column existed, or its venue timestamp could
-- not be recovered — such frames are excluded from historical reconstruction
-- rather than backed by a guessed or fabricated timestamp.

BEGIN;

ALTER TABLE tclk_deal_frames
  ADD COLUMN venue_timestamp_ms bigint;

INSERT INTO schema_migrations (id)
VALUES ('0019_tclk_deal_frame_venue_timestamp');

COMMIT;
