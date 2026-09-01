import type {
  CapabilityCertificate,
  CapabilityInstallation,
  CertificationRepository,
} from "../../lib/db/certification-repository.js";

/**
 * In-memory CertificationRepository for unit-testing production capability
 * acquisition, sequential gating and certificate listing without PostgreSQL.
 */
export class InMemoryCertificationRepository implements CertificationRepository {
  private installations = new Map<string, CapabilityInstallation>();
  private certificates: CapabilityCertificate[] = [];
  private nextCertificateId = 1;

  private key(did: string, capabilityId: string, capabilityVersion: string): string {
    return `${did}::${capabilityId}::${capabilityVersion}`;
  }

  /** Seeds a production certificate the way a production PASS would create one. */
  seedCertificate(input: {
    did: string;
    capabilityId: string;
    capabilityVersion: string;
    certificateName: string;
    trialId: string;
    status?: CapabilityCertificate["status"];
  }): CapabilityCertificate {
    const certificate: CapabilityCertificate = {
      id: `certificate-${this.nextCertificateId++}`,
      did: input.did,
      certificateName: input.certificateName,
      capabilityId: input.capabilityId,
      capabilityVersion: input.capabilityVersion,
      programVersion: "1",
      trialId: input.trialId,
      trialVersion: "1",
      verifierId: `${input.capabilityId}-verifier`,
      verifierVersion: "1",
      receiptId: `receipt-${this.certificates.length + 1}`,
      status: input.status ?? "ACTIVE",
      issuedAt: new Date(1_800_000_000_000 + this.certificates.length).toISOString(),
    };
    this.certificates.push(certificate);
    return certificate;
  }

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
    const installation: CapabilityInstallation = {
      did: input.did,
      capabilityId: input.capabilityId,
      capabilityVersion: input.capabilityVersion,
      moduleId: input.moduleId,
      moduleVersion: input.moduleVersion,
      status: "INSTALLED",
      installedAt: input.installedAt,
    };
    this.installations.set(this.key(input.did, input.capabilityId, input.capabilityVersion), installation);
    return installation;
  }

  async getInstallation(
    did: string,
    capabilityId: string,
    capabilityVersion: string,
  ): Promise<CapabilityInstallation | null> {
    return this.installations.get(this.key(did, capabilityId, capabilityVersion)) ?? null;
  }

  async listCertificates(did: string): Promise<CapabilityCertificate[]> {
    return this.certificates.filter((certificate) => certificate.did === did);
  }

  async getCertificate(certificateId: string): Promise<CapabilityCertificate | null> {
    return this.certificates.find((certificate) => certificate.id === certificateId) ?? null;
  }
}
