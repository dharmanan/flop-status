import type { CertificationRepository } from "../db/certification-repository.js";
import { parseEd25519DidKey } from "../identity/did-key.js";
import {
  CAPABILITY_ID,
  CAPABILITY_VERSION,
  MODULE_ID,
  MODULE_VERSION,
} from "../trials/ed25519-signature-verification/constants.js";

export class CapabilityProductError extends Error {
  constructor(
    readonly code: "UNSUPPORTED_CAPABILITY" | "CAPABILITY_NOT_INSTALLED",
    message: string,
  ) {
    super(message);
    this.name = "CapabilityProductError";
  }
}

export class CapabilityProductService {
  constructor(private readonly repository: CertificationRepository) {}

  async acquireCapability(did: string, capabilityId: string) {
    parseEd25519DidKey(did);
    if (capabilityId !== CAPABILITY_ID) {
      throw new CapabilityProductError("UNSUPPORTED_CAPABILITY", `unsupported production capability: ${capabilityId}`);
    }
    return this.repository.acquireCapability({
      did,
      didMethod: "key",
      keyType: "Ed25519",
      capabilityId: CAPABILITY_ID,
      capabilityVersion: CAPABILITY_VERSION,
      moduleId: MODULE_ID,
      moduleVersion: MODULE_VERSION,
      installedAt: new Date().toISOString(),
    });
  }

  async requireCapability1Installed(did: string): Promise<void> {
    const installation = await this.repository.getInstallation(did, CAPABILITY_ID, CAPABILITY_VERSION);
    if (!installation || installation.status !== "INSTALLED") {
      throw new CapabilityProductError(
        "CAPABILITY_NOT_INSTALLED",
        "Capability 1 must be acquired before production verification.",
      );
    }
  }

  async getCapability1State(did: string) {
    parseEd25519DidKey(did);
    const [installation, certificates] = await Promise.all([
      this.repository.getInstallation(did, CAPABILITY_ID, CAPABILITY_VERSION),
      this.repository.listCertificates(did),
    ]);
    const certificate = certificates.find(
      (item) => item.capabilityId === CAPABILITY_ID && item.capabilityVersion === CAPABILITY_VERSION && item.status === "ACTIVE",
    ) ?? null;
    return {
      capability_id: CAPABILITY_ID,
      capability_version: CAPABILITY_VERSION,
      module_id: MODULE_ID,
      module_version: MODULE_VERSION,
      installation: installation
        ? {
            status: installation.status,
            installed_at: installation.installedAt,
          }
        : { status: "AVAILABLE" as const, installed_at: null },
      certificate: certificate
        ? {
            certificate_id: certificate.id,
            certificate_name: certificate.certificateName,
            receipt_id: certificate.receiptId,
            issued_at: certificate.issuedAt,
            status: certificate.status,
          }
        : null,
    };
  }

  async listCertificates(did: string) {
    parseEd25519DidKey(did);
    const certificates = await this.repository.listCertificates(did);
    return {
      did,
      certificate_count: certificates.filter((item) => item.status === "ACTIVE").length,
      certificates: certificates.map((item) => ({
        certificate_id: item.id,
        certificate_name: item.certificateName,
        capability_id: item.capabilityId,
        capability_version: item.capabilityVersion,
        program_version: item.programVersion,
        trial_id: item.trialId,
        trial_version: item.trialVersion,
        verifier_id: item.verifierId,
        verifier_version: item.verifierVersion,
        receipt_id: item.receiptId,
        status: item.status,
        issued_at: item.issuedAt,
      })),
    };
  }

  async getCertificate(certificateId: string) {
    return this.repository.getCertificate(certificateId);
  }
}
