-- Migration 0005: Trial 3 Technocore Canonical Message Construction
-- Adds only capability/trial metadata. Existing generic challenge, submission,
-- verification, receipt and capability-record tables are reused unchanged.

BEGIN;

INSERT INTO capabilities (id, category, name, description)
VALUES (
  'protocol.technocore-canonical-message',
  'Protocol Compliance',
  'Technocore Canonical Message Construction',
  'Demonstrates the ability to apply the reference Technocore text-cleaning rule and construct the exact room|nonce|cleaned text signing payload.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trial_definitions (
  trial_id, trial_version, capability_id, verifier_id, verifier_version,
  canonicalization_id, definition
)
VALUES (
  'technocore-canonical-message',
  '1',
  'protocol.technocore-canonical-message',
  'technocore-canonical-message-verifier',
  '1',
  'jcs-rfc8785-v1',
  '{"challenge_version":"1","submission_version":"1","challenge_ttl_ms":600000,"reference_payload":"room|nonce|cleaned text","case_classes":["WHITESPACE_CONTROL","UNICODE_TEXT","PIPE_TEXT","PLAIN_TEXT"]}'::jsonb
)
ON CONFLICT (trial_id, trial_version) DO NOTHING;

INSERT INTO schema_migrations (id)
VALUES ('0005_trial3_technocore_canonical_message');

COMMIT;
