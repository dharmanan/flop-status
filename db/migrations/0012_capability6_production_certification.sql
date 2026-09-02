-- Migration 0012: production Capability 6 certification.
-- Capability 6 (Constraint & Policy Compliance) has no historical development
-- acceptance trial: it was introduced directly under the production
-- certification model, same as Capability 5. Only the production
-- certification trial is seeded.

BEGIN;

INSERT INTO capability_modules (
  module_id, module_version, capability_id, capability_version, runtime_type, metadata
)
VALUES (
  'constraint-policy-compliance-browser',
  '1',
  'policy.constraint-compliance',
  '1',
  'BROWSER_DETERMINISTIC',
  '{"llm_required":false,"certificate_eligible":true,"program_version":"1","sequence":6}'::jsonb
)
ON CONFLICT (module_id, module_version) DO NOTHING;

INSERT INTO trial_definitions (
  trial_id, trial_version, capability_id, verifier_id, verifier_version,
  canonicalization_id, definition
)
VALUES (
  'constraint-policy-compliance-certification',
  '1',
  'policy.constraint-compliance',
  'constraint-policy-compliance-verifier',
  '1',
  'jcs-rfc8785-v1',
  '{"challenge_version":"1","submission_version":"1","challenge_ttl_ms":600000,"case_classes":["COMPLIANT","SINGLE_VIOLATION","MULTIPLE_VIOLATIONS","UNSUPPORTED_RULE","INVALID_POLICY"],"certificate_eligible":true,"program_version":"1","capability_version":"1","module_id":"constraint-policy-compliance-browser","module_version":"1","sequence":6}'::jsonb
)
ON CONFLICT (trial_id, trial_version) DO NOTHING;

INSERT INTO schema_migrations (id)
VALUES ('0012_capability6_production_certification');

COMMIT;
