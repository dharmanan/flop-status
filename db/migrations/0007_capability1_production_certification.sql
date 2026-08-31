-- Migration 0007: production Capability 1 acquisition and certification state.
--
-- Historical Trial 1-4 receipts remain immutable protocol evidence. Production
-- certificates are explicit records and are never inferred from capability_records.

BEGIN;

CREATE TABLE capability_modules (
  module_id text NOT NULL,
  module_version text NOT NULL,
  capability_id text NOT NULL REFERENCES capabilities(id),
  capability_version text NOT NULL,
  runtime_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (module_id, module_version)
);

CREATE TABLE agent_capability_installations (
  agent_id uuid NOT NULL REFERENCES agents(id),
  capability_id text NOT NULL REFERENCES capabilities(id),
  capability_version text NOT NULL,
  module_id text NOT NULL,
  module_version text NOT NULL,
  status text NOT NULL DEFAULT 'INSTALLED',
  installed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, capability_id, capability_version),
  FOREIGN KEY (module_id, module_version)
    REFERENCES capability_modules(module_id, module_version),
  CHECK (status IN ('INSTALLED', 'REMOVED'))
);

CREATE TABLE capability_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id),
  capability_id text NOT NULL REFERENCES capabilities(id),
  certificate_name text NOT NULL,
  capability_version text NOT NULL,
  program_version text NOT NULL,
  trial_id text NOT NULL,
  trial_version text NOT NULL,
  verifier_id text NOT NULL,
  verifier_version text NOT NULL,
  receipt_id uuid NOT NULL UNIQUE REFERENCES receipts(id),
  status text NOT NULL DEFAULT 'ACTIVE',
  issued_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, capability_id, capability_version, program_version),
  CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'REVOKED'))
);

CREATE INDEX idx_capability_certificates_agent
  ON capability_certificates(agent_id, issued_at ASC);

INSERT INTO capability_modules (
  module_id, module_version, capability_id, capability_version, runtime_type, metadata
)
VALUES (
  'ed25519-signature-verification-browser',
  '1',
  'cryptography.signature-verification',
  '1',
  'BROWSER_DETERMINISTIC',
  '{"llm_required":false,"certificate_eligible":true,"program_version":"1"}'::jsonb
)
ON CONFLICT (module_id, module_version) DO NOTHING;

INSERT INTO trial_definitions (
  trial_id, trial_version, capability_id, verifier_id, verifier_version,
  canonicalization_id, definition
)
VALUES (
  'ed25519-signature-verification-certification',
  '1',
  'cryptography.signature-verification',
  'ed25519-signature-verifier',
  '1',
  'jcs-rfc8785-v1',
  '{"challenge_version":"1","submission_version":"1","challenge_ttl_ms":600000,"case_classes":["VALID_SIGNATURE","INVALID_SIGNATURE"],"certificate_eligible":true,"program_version":"1","capability_version":"1","module_id":"ed25519-signature-verification-browser","module_version":"1"}'::jsonb
)
ON CONFLICT (trial_id, trial_version) DO NOTHING;

INSERT INTO schema_migrations (id)
VALUES ('0007_capability1_production_certification');

COMMIT;
