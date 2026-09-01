-- Migration 0010: production Capability 4 certification.
-- Historical Trial 4 receipts remain protocol acceptance evidence and are not
-- inferred into production capability certificates. UNKNOWN remains a
-- distinct expected status and is not collapsed into FAIL.

BEGIN;

INSERT INTO capability_modules (
  module_id, module_version, capability_id, capability_version, runtime_type, metadata
)
VALUES (
  'signed-receipt-verification-browser',
  '1',
  'evidence.signed-receipt-verification',
  '1',
  'BROWSER_DETERMINISTIC',
  '{"llm_required":false,"certificate_eligible":true,"program_version":"1","sequence":4}'::jsonb
)
ON CONFLICT (module_id, module_version) DO NOTHING;

INSERT INTO trial_definitions (
  trial_id, trial_version, capability_id, verifier_id, verifier_version,
  canonicalization_id, definition
)
VALUES (
  'signed-receipt-verification-certification',
  '1',
  'evidence.signed-receipt-verification',
  'signed-receipt-verification-verifier',
  '1',
  'jcs-rfc8785-v1',
  '{"challenge_version":"1","submission_version":"1","challenge_ttl_ms":600000,"case_classes":["VALID","TAMPERED_FIELD","KEY_ID_MISMATCH","UNKNOWN_KEY"],"certificate_eligible":true,"program_version":"1","capability_version":"1","module_id":"signed-receipt-verification-browser","module_version":"1","sequence":4}'::jsonb
)
ON CONFLICT (trial_id, trial_version) DO NOTHING;

INSERT INTO schema_migrations (id)
VALUES ('0010_capability4_production_certification');

COMMIT;
