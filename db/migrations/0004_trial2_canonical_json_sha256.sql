-- Migration 0004: Trial 2 Canonical JSON + SHA256
-- Adds only capability/trial metadata. Existing generic challenge, submission,
-- verification, receipt and capability-record tables are reused unchanged.

BEGIN;

INSERT INTO capabilities (id, category, name, description)
VALUES (
  'data.canonical-json-sha256',
  'Data Integrity',
  'Canonical JSON + SHA256',
  'Demonstrates the ability to produce RFC 8785 canonical JSON and the exact SHA256 digest of its UTF-8 bytes.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trial_definitions (
  trial_id, trial_version, capability_id, verifier_id, verifier_version,
  canonicalization_id, definition
)
VALUES (
  'canonical-json-sha256',
  '1',
  'data.canonical-json-sha256',
  'canonical-json-sha256-verifier',
  '1',
  'jcs-rfc8785-v1',
  '{"challenge_version":"1","submission_version":"1","challenge_ttl_ms":600000,"case_classes":["NESTED_OBJECT","UNICODE_KEYS","ARRAY_MIX","NUMERIC_EDGE"]}'::jsonb
)
ON CONFLICT (trial_id, trial_version) DO NOTHING;

INSERT INTO schema_migrations (id)
VALUES ('0004_trial2_canonical_json_sha256');

COMMIT;
