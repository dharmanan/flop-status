import { describe, expect, it } from "vitest";
import {
  CapabilityProductError,
  CapabilityProductService,
} from "../../lib/runtime/capability-product-service.js";
import { PRODUCTION_CAPABILITIES } from "../../lib/runtime/capability-registry.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";
import { InMemoryCertificationRepository } from "../helpers/in-memory-certification-repository.js";

const agent = generateTestEd25519Identity();

const [capability1, capability2, capability3, capability4] = PRODUCTION_CAPABILITIES as [
  (typeof PRODUCTION_CAPABILITIES)[number],
  (typeof PRODUCTION_CAPABILITIES)[number],
  (typeof PRODUCTION_CAPABILITIES)[number],
  (typeof PRODUCTION_CAPABILITIES)[number],
];

function service() {
  const repository = new InMemoryCertificationRepository();
  return { repository, service: new CapabilityProductService(repository) };
}

function certifyIn(repository: InMemoryCertificationRepository, capability: (typeof PRODUCTION_CAPABILITIES)[number]) {
  return repository.seedCertificate({
    did: agent.did,
    capabilityId: capability.capabilityId,
    capabilityVersion: capability.capabilityVersion,
    certificateName: capability.certificateName,
    trialId: capability.productionTrialId,
  });
}

describe("sequential capability gating is enforced in the backend", () => {
  it("allows Capability 1 to be acquired first with no prerequisite", async () => {
    const { service: product } = service();
    const installation = await product.acquireCapability(agent.did, capability1.capabilityId);
    expect(installation.status).toBe("INSTALLED");
    expect(installation.moduleId).toBe(capability1.moduleId);
  });

  for (const capability of [capability2, capability3, capability4]) {
    const prerequisite = PRODUCTION_CAPABILITIES.find(
      (item) => item.capabilityId === capability.prerequisiteCapabilityId,
    )!;

    it(`blocks Capability ${capability.ordinal} acquisition without the Capability ${prerequisite.ordinal} certificate`, async () => {
      const { service: product } = service();
      await expect(product.acquireCapability(agent.did, capability.capabilityId)).rejects.toMatchObject({
        code: "PREREQUISITE_CERTIFICATE_REQUIRED",
      });
    });

    it(`blocks Capability ${capability.ordinal} even when the prerequisite is installed but not certified`, async () => {
      const { repository, service: product } = service();
      await product.acquireCapability(agent.did, prerequisite.capabilityId).catch(() => {
        // earlier capabilities may themselves be gated; seed their certificates instead
      });
      for (const earlier of PRODUCTION_CAPABILITIES) {
        if (earlier.ordinal < prerequisite.ordinal) certifyIn(repository, earlier);
      }
      await product.acquireCapability(agent.did, prerequisite.capabilityId);

      await expect(product.acquireCapability(agent.did, capability.capabilityId)).rejects.toMatchObject({
        code: "PREREQUISITE_CERTIFICATE_REQUIRED",
      });
    });

    it(`allows Capability ${capability.ordinal} acquisition once the Capability ${prerequisite.ordinal} certificate exists`, async () => {
      const { repository, service: product } = service();
      for (const earlier of PRODUCTION_CAPABILITIES) {
        if (earlier.ordinal <= prerequisite.ordinal) certifyIn(repository, earlier);
      }
      const installation = await product.acquireCapability(agent.did, capability.capabilityId);
      expect(installation.status).toBe("INSTALLED");
      expect(installation.capabilityId).toBe(capability.capabilityId);
    });
  }

  it("blocks a production certification challenge when the capability is not installed", async () => {
    const { repository, service: product } = service();
    certifyIn(repository, capability1);

    await expect(
      product.requireCapabilityInstalledForProductionTrial(agent.did, capability2.productionTrialId),
    ).rejects.toMatchObject({ code: "CAPABILITY_NOT_INSTALLED" });

    await product.acquireCapability(agent.did, capability2.capabilityId);
    await expect(
      product.requireCapabilityInstalledForProductionTrial(agent.did, capability2.productionTrialId),
    ).resolves.toBeUndefined();
  });

  it("rejects capabilities outside the production registry", async () => {
    const { service: product } = service();
    await expect(product.acquireCapability(agent.did, "data.not-a-capability")).rejects.toBeInstanceOf(
      CapabilityProductError,
    );
    await expect(product.getCapabilityState(agent.did, "data.not-a-capability")).rejects.toMatchObject({
      code: "UNSUPPORTED_CAPABILITY",
    });
  });
});

describe("capability state reporting", () => {
  it("reports LOCKED until the prerequisite certificate exists, then AVAILABLE, then INSTALLED", async () => {
    const { repository, service: product } = service();

    const locked = await product.getCapabilityState(agent.did, capability2.capabilityId);
    expect(locked.installation.status).toBe("LOCKED");
    expect(locked.prerequisite).toMatchObject({
      capability_id: capability1.capabilityId,
      certificate_name: capability1.certificateName,
      satisfied: false,
    });

    certifyIn(repository, capability1);
    const available = await product.getCapabilityState(agent.did, capability2.capabilityId);
    expect(available.installation.status).toBe("AVAILABLE");
    expect(available.prerequisite?.satisfied).toBe(true);
    expect(available.certificate).toBeNull();

    await product.acquireCapability(agent.did, capability2.capabilityId);
    const installed = await product.getCapabilityState(agent.did, capability2.capabilityId);
    expect(installed.installation.status).toBe("INSTALLED");
    expect(installed.production_trial_id).toBe(capability2.productionTrialId);
  });

  it("reports the individual certificate once the capability is certified", async () => {
    const { repository, service: product } = service();
    const certificate = certifyIn(repository, capability1);

    const state = await product.getCapabilityState(agent.did, capability1.capabilityId);
    expect(state.certificate).toMatchObject({
      certificate_id: certificate.id,
      certificate_name: capability1.certificateName,
      status: "ACTIVE",
    });
  });
});

describe("certificate list and derived rank", () => {
  it("counts only active production certificates and derives Rookie at three", async () => {
    const { repository, service: product } = service();

    expect((await product.listCertificates(agent.did)).rank).toBeNull();

    certifyIn(repository, capability1);
    certifyIn(repository, capability2);
    const two = await product.listCertificates(agent.did);
    expect(two.certificate_count).toBe(2);
    expect(two.rank).toBeNull();

    certifyIn(repository, capability3);
    const three = await product.listCertificates(agent.did);
    expect(three.certificate_count).toBe(3);
    expect(three.rank?.rank_name).toBe("Rookie");

    certifyIn(repository, capability4);
    const four = await product.listCertificates(agent.did);
    expect(four.certificate_count).toBe(4);
    expect(four.rank?.rank_name).toBe("Rookie");
    expect(four.certificates.map((item) => item.certificate_name)).toEqual([
      capability1.certificateName,
      capability2.certificateName,
      capability3.certificateName,
      capability4.certificateName,
    ]);
  });

  it("does not count revoked certificates toward rank", async () => {
    const { repository, service: product } = service();
    certifyIn(repository, capability1);
    certifyIn(repository, capability2);
    repository.seedCertificate({
      did: agent.did,
      capabilityId: capability3.capabilityId,
      capabilityVersion: capability3.capabilityVersion,
      certificateName: capability3.certificateName,
      trialId: capability3.productionTrialId,
      status: "REVOKED",
    });

    const listed = await product.listCertificates(agent.did);
    expect(listed.certificate_count).toBe(2);
    expect(listed.rank).toBeNull();
  });
});
