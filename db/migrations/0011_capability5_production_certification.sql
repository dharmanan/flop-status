-- Migration 0011: production Capability 5 certification.
-- Capability 5 (Structured Data Transformation) has no historical development
-- acceptance trial: it was introduced directly under the production
-- certification model. Only the production certification trial is seeded.

BEGIN;

INSERT INTO capability_modules (
  module_id, module_version, capability_id, capability_version, runtime_type, metadata
)
VALUES (
  'structured-data-transformation-browser',
  '1',
  'data.structured-transformation',
  '1',
  'BROWSER_DETERMINISTIC',
  '{"llm_required":false,"certificate_eligible":true,"program_version":"1","sequence":5}'::jsonb
)
ON CONFLICT (module_id, module_version) DO NOTHING;

INSERT INTO trial_definitions (
  trial_id, trial_version, capability_id, verifier_id, verifier_version,
  canonicalization_id, definition
)
VALUES (
  'structured-data-transformation-certification',
  '1',
  'data.structured-transformation',
  'structured-data-transformation-verifier',
  '1',
  'jcs-rfc8785-v1',
  '{"challenge_version":"1","submission_version":"1","challenge_ttl_ms":600000,"case_classes":["VALID","SOURCE_PATH_MISSING","INVALID_TYPE_COERCION","UNSUPPORTED_OPERATION","TARGET_PATH_CONFLICT"],"certificate_eligible":true,"program_version":"1","capability_version":"1","module_id":"structured-data-transformation-browser","module_version":"1","sequence":5}'::jsonb
)
ON CONFLICT (trial_id, trial_version) DO NOTHING;

INSERT INTO schema_migrations (id)
VALUES ('0011_capability5_production_certification');

COMMIT;
