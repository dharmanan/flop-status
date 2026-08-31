-- Migration 0006: Trial 4 Signed Receipt Verification
-- Adds capability/trial metadata while reusing the shared evidence engine.

BEGIN;

INSERT INTO capabilities (id, category, name, description)
VALUES (
  'evidence.signed-receipt-verification',
  'Evidence Verification',
  'Signed Receipt Verification',
  'Demonstrates deterministic verification of FLOP-style signed receipts, server key binding and tamper detection.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trial_definitions (
  trial_id, trial_version, capability_id, verifier_id, verifier_version,
  canonicalization_id, definition
)
VALUES (
  'signed-receipt-verification',
  '1',
  'evidence.signed-receipt-verification',
  'signed-receipt-verification-verifier',
  '1',
  'jcs-rfc8785-v1',
  '{"challenge_version":"1","submission_version":"1","challenge_ttl_ms":600000,"case_classes":["VALID","TAMPERED_FIELD","KEY_ID_MISMATCH","UNKNOWN_KEY"]}'::jsonb
)
ON CONFLICT (trial_id, trial_version) DO NOTHING;

INSERT INTO schema_migrations (id)
VALUES ('0006_trial4_signed_receipt_verification')
ON CONFLICT (id) DO NOTHING;

COMMIT;
