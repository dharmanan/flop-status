import { describe, expect, it } from "vitest";
import type {
  CapabilityCertificate,
  CapabilityInstallation,
  CertificationRepository,
} from "../../lib/db/certification-repository.js";
import {
  CapabilityProductError,
  CapabilityProductService,
} from "../../lib/runtime/capability-product-service.js";
import { CAPABILITY_ID as CAPABILITY1_ID } from "../../lib/trials/ed25519-signature-verification/constants.js";
import { CAPABILITY_ID as CAPABILITY2_ID } from "../../lib/trials/canonical-json-sha256/constants.js";

const did = "did:key:z6MkexNw89yy5PLxTLV5zqJmNgsmM5PoCi9gzBAqLfqHF5Ny";

class FakeRepository implements CertificationRepository {
  certificates: CapabilityCertificate[] = [];
  installations: CapabilityInstallation[] = [];

  async acquireCapability(input: Parameters<CertificationRepository["acquireCapability"]>[0]) {
    const installation: CapabilityInstallation = {
      did: input.did,
      capabilityId: input.capabilityId,
      capabilityVersion: input.capabilityVersion,
      moduleId: input.moduleId,
      moduleVersion: input.moduleVersion,
      status: "INSTALLED",
      installedAt: input.installedAt,
    };
    this.installations.push(installation);
    return installation;
  }

  async getInstallation(targetDid: string, capabilityId: string, capabilityVersion: string) {
    return this.installations.find(
      (item) => item.did === targetDid && item.capabilityId === capabilityId && item.capabilityVersion === capabilityVersion,
    ) ?? null;
  }

  async listCertificates(targetDid: string) {
    return this.certificates.filter((item) => item.did === targetDid);
  }

  async getCertificate(certificateId: string) {
    return this.certificates.find((item) => item.id === certificateId) ?? null;
  }
}

function capability1Certificate(): CapabilityCertificate {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    did,
    certificateName: "Ed25519 Signature Verification Certificate",
    capabilityId: CAPABILITY1_ID,
    capabilityVersion: "1",
    programVersion: "1",
    trialId: "ed25519-signature-verification-certification",
    trialVersion: "1",
    verifierId: "ed25519-signature-verifier",
    verifierVersion: "1",
    receiptId: "22222222-2222-4222-8222-222222222222",
    status: "ACTIVE",
    issuedAt: "2026-09-01T09:00:00.000Z",
  };
}

describe("CapabilityProductService sequential production certification", () => {
  it("blocks Capability 2 acquisition until Capability 1 has an active certificate", async () => {
    const service = new CapabilityProductService(new FakeRepository());
    await expect(service.acquireCapability(did, CAPABILITY2_ID)).rejects.toMatchObject({
      code: "PREREQUISITE_CERTIFICATE_REQUIRED",
    });
  });

  it("allows Capability 2 acquisition after Capability 1 certification", async () => {
    const repository = new FakeRepository();
    repository.certificates.push(capability1Certificate());
    const service = new CapabilityProductService(repository);

    const installation = await service.acquireCapability(did, CAPABILITY2_ID);
    expect(installation.capabilityId).toBe(CAPABILITY2_ID);
    expect(installation.moduleId).toBe("canonical-json-sha256-browser");
  });

  it("keeps historical evidence irrelevant because prerequisite checks certificates only", async () => {
    const repository = new FakeRepository();
    const service = new CapabilityProductService(repository);

    await expect(service.acquireCapability(did, CAPABILITY2_ID)).rejects.toBeInstanceOf(CapabilityProductError);
    expect(repository.installations).toHaveLength(0);
  });
});
