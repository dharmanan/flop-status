-- Migration 0008: production Capability 2 certification.
-- Historical Trial 2 receipts remain protocol acceptance evidence and are not
-- inferred into production capability certificates.

BEGIN;

INSERT INTO capability_modules (
  module_id, module_version, capability_id, capability_version, runtime_type, metadata
)
VALUES (
  'canonical-json-sha256-browser',
  '1',
  'data.canonical-json-sha256',
  '1',
  'BROWSER_DETERMINISTIC',
  '{"llm_required":false,"certificate_eligible":true,"program_version":"1","sequence":2}'::jsonb
)
ON CONFLICT (module_id, module_version) DO NOTHING;

INSERT INTO trial_definitions (
  trial_id, trial_version, capability_id, verifier_id, verifier_version,
  canonicalization_id, definition
)
VALUES (
  'canonical-json-sha256-certification',
  '1',
  'data.canonical-json-sha256',
  'canonical-json-sha256-verifier',
  '1',
  'jcs-rfc8785-v1',
  '{"challenge_version":"1","submission_version":"1","challenge_ttl_ms":600000,"case_classes":["NESTED_OBJECT","UNICODE_KEYS","ARRAY_MIX","NUMERIC_EDGE"],"certificate_eligible":true,"program_version":"1","capability_version":"1","module_id":"canonical-json-sha256-browser","module_version":"1","sequence":2}'::jsonb
)
ON CONFLICT (trial_id, trial_version) DO NOTHING;

INSERT INTO schema_migrations (id)
VALUES ('0008_capability2_production_certification');

COMMIT;
