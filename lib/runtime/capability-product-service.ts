import type { CertificationRepository } from "../db/certification-repository.js";
import { parseEd25519DidKey } from "../identity/did-key.js";
import {
  CAPABILITY_ID as CAPABILITY1_ID,
  CAPABILITY_VERSION as CAPABILITY1_VERSION,
  MODULE_ID as CAPABILITY1_MODULE_ID,
  MODULE_VERSION as CAPABILITY1_MODULE_VERSION,
} from "../trials/ed25519-signature-verification/constants.js";
import {
  CAPABILITY_ID as CAPABILITY2_ID,
  CAPABILITY_VERSION as CAPABILITY2_VERSION,
  MODULE_ID as CAPABILITY2_MODULE_ID,
  MODULE_VERSION as CAPABILITY2_MODULE_VERSION,
} from "../trials/canonical-json-sha256/constants.js";

interface ProductCapabilityDefinition {
  capabilityId: string;
  capabilityVersion: string;
  moduleId: string;
  moduleVersion: string;
}

const PRODUCT_CAPABILITIES: Record<string, ProductCapabilityDefinition> = {
  [CAPABILITY1_ID]: {
    capabilityId: CAPABILITY1_ID,
    capabilityVersion: CAPABILITY1_VERSION,
    moduleId: CAPABILITY1_MODULE_ID,
    moduleVersion: CAPABILITY1_MODULE_VERSION,
  },
  [CAPABILITY2_ID]: {
    capabilityId: CAPABILITY2_ID,
    capabilityVersion: CAPABILITY2_VERSION,
    moduleId: CAPABILITY2_MODULE_ID,
    moduleVersion: CAPABILITY2_MODULE_VERSION,
  },
};

export class CapabilityProductError extends Error {
  constructor(
    readonly code: "UNSUPPORTED_CAPABILITY" | "CAPABILITY_NOT_INSTALLED" | "PREREQUISITE_CERTIFICATE_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "CapabilityProductError";
  }
}

export class CapabilityProductService {
  constructor(private readonly repository: CertificationRepository) {}

  private definition(capabilityId: string): ProductCapabilityDefinition {
    const definition = PRODUCT_CAPABILITIES[capabilityId];
    if (!definition) {
      throw new CapabilityProductError("UNSUPPORTED_CAPABILITY", `unsupported production capability: ${capabilityId}`);
    }
    return definition;
  }

  async acquireCapability(did: string, capabilityId: string) {
    parseEd25519DidKey(did);
    const definition = this.definition(capabilityId);

    if (capabilityId === CAPABILITY2_ID) {
      const certificates = await this.repository.listCertificates(did);
      const hasCapability1Certificate = certificates.some(
        (item) => item.capabilityId === CAPABILITY1_ID && item.capabilityVersion === CAPABILITY1_VERSION && item.status === "ACTIVE",
      );
      if (!hasCapability1Certificate) {
        throw new CapabilityProductError(
          "PREREQUISITE_CERTIFICATE_REQUIRED",
          "Capability 1 certificate is required before acquiring Capability 2.",
        );
      }
    }

    return this.repository.acquireCapability({
      did,
      didMethod: "key",
      keyType: "Ed25519",
      capabilityId: definition.capabilityId,
      capabilityVersion: definition.capabilityVersion,
      moduleId: definition.moduleId,
      moduleVersion: definition.moduleVersion,
      installedAt: new Date().toISOString(),
    });
  }

  async requireCapabilityInstalled(did: string, capabilityId: string): Promise<void> {
    const definition = this.definition(capabilityId);
    const installation = await this.repository.getInstallation(
      did,
      definition.capabilityId,
      definition.capabilityVersion,
    );
    if (!installation || installation.status !== "INSTALLED") {
      throw new CapabilityProductError(
        "CAPABILITY_NOT_INSTALLED",
        `${capabilityId} must be acquired before production verification.`,
      );
    }
  }

  async requireCapability1Installed(did: string): Promise<void> {
    return this.requireCapabilityInstalled(did, CAPABILITY1_ID);
  }

  async getCapabilityState(did: string, capabilityId: string) {
    parseEd25519DidKey(did);
    const definition = this.definition(capabilityId);
    const [installation, certificates] = await Promise.all([
      this.repository.getInstallation(did, definition.capabilityId, definition.capabilityVersion),
      this.repository.listCertificates(did),
    ]);
    const certificate = certificates.find(
      (item) => item.capabilityId === definition.capabilityId && item.capabilityVersion === definition.capabilityVersion && item.status === "ACTIVE",
    ) ?? null;
    return {
      capability_id: definition.capabilityId,
      capability_version: definition.capabilityVersion,
      module_id: definition.moduleId,
      module_version: definition.moduleVersion,
      installation: installation
        ? { status: installation.status, installed_at: installation.installedAt }
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

  async getCapability1State(did: string) {
    return this.getCapabilityState(did, CAPABILITY1_ID);
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
