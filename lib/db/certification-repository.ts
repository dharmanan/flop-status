import type { Pool } from "pg";

export interface CapabilityInstallation {
  did: string;
  capabilityId: string;
  capabilityVersion: string;
  moduleId: string;
  moduleVersion: string;
  status: "INSTALLED" | "REMOVED";
  installedAt: string;
}

export interface CapabilityCertificate {
  id: string;
  did: string;
  certificateName: string;
  capabilityId: string;
  capabilityVersion: string;
  programVersion: string;
  trialId: string;
  trialVersion: string;
  verifierId: string;
  verifierVersion: string;
  receiptId: string;
  status: "ACTIVE" | "SUPERSEDED" | "REVOKED";
  issuedAt: string;
}

export interface CertificationRepository {
  acquireCapability(input: {
    did: string;
    didMethod: string;
    keyType: string;
    capabilityId: string;
    capabilityVersion: string;
    moduleId: string;
    moduleVersion: string;
    installedAt: string;
  }): Promise<CapabilityInstallation>;
  getInstallation(did: string, capabilityId: string, capabilityVersion: string): Promise<CapabilityInstallation | null>;
  listCertificates(did: string): Promise<CapabilityCertificate[]>;
  getCertificate(certificateId: string): Promise<CapabilityCertificate | null>;
}

interface InstallationRow {
  did: string;
  capability_id: string;
  capability_version: string;
  module_id: string;
  module_version: string;
  status: "INSTALLED" | "REMOVED";
  installed_at: Date | string;
}

interface CertificateRow {
  id: string;
  did: string;
  certificate_name: string;
  capability_id: string;
  capability_version: string;
  program_version: string;
  trial_id: string;
  trial_version: string;
  verifier_id: string;
  verifier_version: string;
  receipt_id: string;
  status: "ACTIVE" | "SUPERSEDED" | "REVOKED";
  issued_at: Date | string;
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapInstallation(row: InstallationRow): CapabilityInstallation {
  return {
    did: row.did,
    capabilityId: row.capability_id,
    capabilityVersion: row.capability_version,
    moduleId: row.module_id,
    moduleVersion: row.module_version,
    status: row.status,
    installedAt: asIso(row.installed_at),
  };
}

function mapCertificate(row: CertificateRow): CapabilityCertificate {
  return {
    id: row.id,
    did: row.did,
    certificateName: row.certificate_name,
    capabilityId: row.capability_id,
    capabilityVersion: row.capability_version,
    programVersion: row.program_version,
    trialId: row.trial_id,
    trialVersion: row.trial_version,
    verifierId: row.verifier_id,
    verifierVersion: row.verifier_version,
    receiptId: row.receipt_id,
    status: row.status,
    issuedAt: asIso(row.issued_at),
  };
}

export class PgCertificationRepository implements CertificationRepository {
  constructor(private readonly pool: Pool) {}

  async acquireCapability(input: {
    did: string;
    didMethod: string;
    keyType: string;
    capabilityId: string;
    capabilityVersion: string;
    moduleId: string;
    moduleVersion: string;
    installedAt: string;
  }): Promise<CapabilityInstallation> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const agent = await client.query<{ id: string }>(
        `INSERT INTO agents (did, did_method, key_type)
         VALUES ($1,$2,$3)
         ON CONFLICT (did) DO UPDATE SET last_seen_at = now()
         RETURNING id`,
        [input.did, input.didMethod, input.keyType],
      );
      const agentId = agent.rows[0]?.id;
      if (!agentId) throw new Error("agent upsert did not return id");

      const module = await client.query(
        `SELECT 1 FROM capability_modules
         WHERE module_id = $1 AND module_version = $2 AND capability_id = $3
           AND capability_version = $4 AND active = true`,
        [input.moduleId, input.moduleVersion, input.capabilityId, input.capabilityVersion],
      );
      if (module.rowCount !== 1) throw new Error("active capability module not found");

      const result = await client.query<InstallationRow>(
        `INSERT INTO agent_capability_installations (
           agent_id, capability_id, capability_version, module_id, module_version,
           status, installed_at
         ) VALUES ($1,$2,$3,$4,$5,'INSTALLED',$6)
         ON CONFLICT (agent_id, capability_id, capability_version) DO UPDATE SET
           module_id = EXCLUDED.module_id,
           module_version = EXCLUDED.module_version,
           status = 'INSTALLED',
           updated_at = now()
         RETURNING $7::text AS did, capability_id, capability_version, module_id,
                   module_version, status, installed_at`,
        [
          agentId,
          input.capabilityId,
          input.capabilityVersion,
          input.moduleId,
          input.moduleVersion,
          input.installedAt,
          input.did,
        ],
      );
      await client.query("COMMIT");
      const row = result.rows[0];
      if (!row) throw new Error("capability installation upsert did not return row");
      return mapInstallation(row);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getInstallation(did: string, capabilityId: string, capabilityVersion: string): Promise<CapabilityInstallation | null> {
    const result = await this.pool.query<InstallationRow>(
      `SELECT a.did, i.capability_id, i.capability_version, i.module_id,
              i.module_version, i.status, i.installed_at
       FROM agent_capability_installations i
       JOIN agents a ON a.id = i.agent_id
       WHERE a.did = $1 AND i.capability_id = $2 AND i.capability_version = $3`,
      [did, capabilityId, capabilityVersion],
    );
    return result.rows[0] ? mapInstallation(result.rows[0]) : null;
  }

  async listCertificates(did: string): Promise<CapabilityCertificate[]> {
    const result = await this.pool.query<CertificateRow>(
      `SELECT c.id, a.did, c.certificate_name, c.capability_id, c.capability_version,
              c.program_version, c.trial_id, c.trial_version, c.verifier_id,
              c.verifier_version, c.receipt_id, c.status, c.issued_at
       FROM capability_certificates c
       JOIN agents a ON a.id = c.agent_id
       WHERE a.did = $1
       ORDER BY c.issued_at ASC`,
      [did],
    );
    return result.rows.map(mapCertificate);
  }

  async getCertificate(certificateId: string): Promise<CapabilityCertificate | null> {
    const result = await this.pool.query<CertificateRow>(
      `SELECT c.id, a.did, c.certificate_name, c.capability_id, c.capability_version,
              c.program_version, c.trial_id, c.trial_version, c.verifier_id,
              c.verifier_version, c.receipt_id, c.status, c.issued_at
       FROM capability_certificates c
       JOIN agents a ON a.id = c.agent_id
       WHERE c.id = $1`,
      [certificateId],
    );
    return result.rows[0] ? mapCertificate(result.rows[0]) : null;
  }
}
