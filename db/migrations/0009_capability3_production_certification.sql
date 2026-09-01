-- Migration 0009: production Capability 3 certification.
-- Historical Trial 3 receipts remain protocol acceptance evidence and are not
-- inferred into production capability certificates. Core verification does
-- not depend on Technocore.

BEGIN;

INSERT INTO capability_modules (
  module_id, module_version, capability_id, capability_version, runtime_type, metadata
)
VALUES (
  'technocore-canonical-message-browser',
  '1',
  'protocol.technocore-canonical-message',
  '1',
  'BROWSER_DETERMINISTIC',
  '{"llm_required":false,"certificate_eligible":true,"program_version":"1","sequence":3}'::jsonb
)
ON CONFLICT (module_id, module_version) DO NOTHING;

INSERT INTO trial_definitions (
  trial_id, trial_version, capability_id, verifier_id, verifier_version,
  canonicalization_id, definition
)
VALUES (
  'technocore-canonical-message-certification',
  '1',
  'protocol.technocore-canonical-message',
  'technocore-canonical-message-verifier',
  '1',
  'jcs-rfc8785-v1',
  '{"challenge_version":"1","submission_version":"1","challenge_ttl_ms":600000,"case_classes":["WHITESPACE_CONTROL","UNICODE_TEXT","PIPE_TEXT","PLAIN_TEXT"],"certificate_eligible":true,"program_version":"1","capability_version":"1","module_id":"technocore-canonical-message-browser","module_version":"1","sequence":3}'::jsonb
)
ON CONFLICT (trial_id, trial_version) DO NOTHING;

INSERT INTO schema_migrations (id)
VALUES ('0009_capability3_production_certification');

COMMIT;
