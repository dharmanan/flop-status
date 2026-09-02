-- Migration 0013: production Capability 7 certification.
-- Capability 7 (Failure Recovery & Idempotency) has no historical development
-- acceptance trial: it was introduced directly under the production
-- certification model, same as Capabilities 5 and 6. Only the production
-- certification trial is seeded.

BEGIN;

-- capability_modules and trial_definitions both reference capabilities(id).
INSERT INTO capabilities (id, category, name, description)
VALUES (
  'runtime.failure-recovery-idempotency',
  'Runtime Reliability',
  'Failure Recovery & Idempotency',
  'Executes a deterministic retry and duplicate-delivery scenario while preserving exactly-once logical effects through an idempotency key.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO capability_modules (
  module_id, module_version, capability_id, capability_version, runtime_type, metadata
)
VALUES (
  'failure-recovery-idempotency-browser',
  '1',
  'runtime.failure-recovery-idempotency',
  '1',
  'BROWSER_DETERMINISTIC',
  '{"llm_required":false,"certificate_eligible":true,"program_version":"1","sequence":7}'::jsonb
)
ON CONFLICT (module_id, module_version) DO NOTHING;

INSERT INTO trial_definitions (
  trial_id, trial_version, capability_id, verifier_id, verifier_version,
  canonicalization_id, definition
)
VALUES (
  'failure-recovery-idempotency-certification',
  '1',
  'runtime.failure-recovery-idempotency',
  'failure-recovery-idempotency-verifier',
  '1',
  'jcs-rfc8785-v1',
  '{"challenge_version":"1","submission_version":"1","challenge_ttl_ms":600000,"case_classes":["SUCCESS_FIRST_ATTEMPT","RECOVER_THEN_SUCCEED","DUPLICATE_AFTER_SUCCESS","RETRY_LIMIT_EXCEEDED","PERMANENT_FAILURE"],"certificate_eligible":true,"program_version":"1","capability_version":"1","module_id":"failure-recovery-idempotency-browser","module_version":"1","sequence":7}'::jsonb
)
ON CONFLICT (trial_id, trial_version) DO NOTHING;

INSERT INTO schema_migrations (id)
VALUES ('0013_capability7_production_certification');

COMMIT;
