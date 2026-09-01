import type { CapabilityCertificate, CertificationRepository } from "../db/certification-repository.js";
import { parseEd25519DidKey } from "../identity/did-key.js";
import { rankForCertificateCount } from "./agent-rank.js";
import {
  findProductionCapability,
  findProductionCapabilityByTrialId,
  type ProductionCapabilityDefinition,
} from "./capability-registry.js";

export class CapabilityProductError extends Error {
  constructor(
    readonly code: "UNSUPPORTED_CAPABILITY" | "CAPABILITY_NOT_INSTALLED" | "PREREQUISITE_CERTIFICATE_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "CapabilityProductError";
  }
}

function requireDefinition(capabilityId: string): ProductionCapabilityDefinition {
  const definition = findProductionCapability(capabilityId);
  if (!definition) {
    throw new CapabilityProductError("UNSUPPORTED_CAPABILITY", `unsupported production capability: ${capabilityId}`);
  }
  return definition;
}

function activeCertificateFor(
  certificates: readonly CapabilityCertificate[],
  definition: ProductionCapabilityDefinition,
): CapabilityCertificate | null {
  return (
    certificates.find(
      (item) =>
        item.capabilityId === definition.capabilityId &&
        item.capabilityVersion === definition.capabilityVersion &&
        item.status === "ACTIVE",
    ) ?? null
  );
}

export class CapabilityProductService {
  constructor(private readonly repository: CertificationRepository) {}

  async acquireCapability(did: string, capabilityId: string) {
    parseEd25519DidKey(did);
    const definition = requireDefinition(capabilityId);
    await this.requirePrerequisiteCertificate(did, definition);
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

  /**
   * Sequential gating is enforced server side, not by hiding buttons: a
   * capability can only be installed once the previous capability holds an
   * ACTIVE production certificate.
   */
  private async requirePrerequisiteCertificate(
    did: string,
    definition: ProductionCapabilityDefinition,
  ): Promise<void> {
    if (!definition.prerequisiteCapabilityId) return;
    const prerequisite = requireDefinition(definition.prerequisiteCapabilityId);
    const certificates = await this.repository.listCertificates(did);
    if (!activeCertificateFor(certificates, prerequisite)) {
      throw new CapabilityProductError(
        "PREREQUISITE_CERTIFICATE_REQUIRED",
        `${prerequisite.certificateName} is required before acquiring Capability ${definition.ordinal}.`,
      );
    }
  }

  async requireCapabilityInstalled(did: string, capabilityId: string): Promise<void> {
    const definition = requireDefinition(capabilityId);
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

  async requireCapabilityInstalledForProductionTrial(did: string, trialId: string): Promise<void> {
    const definition = findProductionCapabilityByTrialId(trialId);
    if (!definition) {
      throw new CapabilityProductError("UNSUPPORTED_CAPABILITY", `unsupported production trial: ${trialId}`);
    }
    await this.requireCapabilityInstalled(did, definition.capabilityId);
  }

  async getCapabilityState(did: string, capabilityId: string) {
    parseEd25519DidKey(did);
    const definition = requireDefinition(capabilityId);
    const [installation, certificates] = await Promise.all([
      this.repository.getInstallation(did, definition.capabilityId, definition.capabilityVersion),
      this.repository.listCertificates(did),
    ]);
    const certificate = activeCertificateFor(certificates, definition);
    const prerequisite = definition.prerequisiteCapabilityId
      ? requireDefinition(definition.prerequisiteCapabilityId)
      : null;
    const prerequisiteSatisfied = prerequisite ? Boolean(activeCertificateFor(certificates, prerequisite)) : true;

    return {
      ordinal: definition.ordinal,
      capability_id: definition.capabilityId,
      capability_version: definition.capabilityVersion,
      module_id: definition.moduleId,
      module_version: definition.moduleVersion,
      production_trial_id: definition.productionTrialId,
      certificate_name: definition.certificateName,
      prerequisite: prerequisite
        ? {
            capability_id: prerequisite.capabilityId,
            certificate_name: prerequisite.certificateName,
            satisfied: prerequisiteSatisfied,
          }
        : null,
      installation: installation
        ? { status: installation.status, installed_at: installation.installedAt }
        : { status: prerequisiteSatisfied ? ("AVAILABLE" as const) : ("LOCKED" as const), installed_at: null },
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
    const certificateCount = certificates.filter((item) => item.status === "ACTIVE").length;
    return {
      did,
      certificate_count: certificateCount,
      rank: rankForCertificateCount(certificateCount),
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
