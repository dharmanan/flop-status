import * as trial2 from "../trials/canonical-json-sha256/constants.js";
import * as trial6 from "../trials/constraint-policy-compliance/constants.js";
import * as trial1 from "../trials/ed25519-signature-verification/constants.js";
import * as trial7 from "../trials/failure-recovery-idempotency/constants.js";
import * as trial4 from "../trials/signed-receipt-verification/constants.js";
import * as trial5 from "../trials/structured-data-transformation/constants.js";
import * as trial3 from "../trials/technocore-canonical-message/constants.js";

/**
 * One bounded production definition per certificate-eligible capability.
 *
 * `historicalTrialId` is recorded so the separation stays explicit: historical
 * development acceptance receipts use that trial id and never create a
 * certificate. Only `productionTrialId` PASSes are certificate eligible.
 */
export interface ProductionCapabilityDefinition {
  ordinal: number;
  capabilityId: string;
  capabilityVersion: string;
  moduleId: string;
  moduleVersion: string;
  productionTrialId: string;
  productionTrialVersion: string;
  historicalTrialId: string;
  verifierId: string;
  verifierVersion: string;
  certificateName: string;
  programVersion: string;
  prerequisiteCapabilityId: string | null;
}

export const PRODUCTION_CAPABILITIES: readonly ProductionCapabilityDefinition[] = [
  {
    ordinal: 1,
    capabilityId: trial1.CAPABILITY_ID,
    capabilityVersion: trial1.CAPABILITY_VERSION,
    moduleId: trial1.MODULE_ID,
    moduleVersion: trial1.MODULE_VERSION,
    productionTrialId: trial1.PRODUCTION_TRIAL_ID,
    productionTrialVersion: trial1.TRIAL_VERSION,
    historicalTrialId: trial1.TRIAL_ID,
    verifierId: trial1.VERIFIER_ID,
    verifierVersion: trial1.VERIFIER_VERSION,
    certificateName: trial1.CERTIFICATE_NAME,
    programVersion: trial1.PROGRAM_VERSION,
    prerequisiteCapabilityId: null,
  },
  {
    ordinal: 2,
    capabilityId: trial2.CAPABILITY_ID,
    capabilityVersion: trial2.CAPABILITY_VERSION,
    moduleId: trial2.MODULE_ID,
    moduleVersion: trial2.MODULE_VERSION,
    productionTrialId: trial2.PRODUCTION_TRIAL_ID,
    productionTrialVersion: trial2.TRIAL_VERSION,
    historicalTrialId: trial2.TRIAL_ID,
    verifierId: trial2.VERIFIER_ID,
    verifierVersion: trial2.VERIFIER_VERSION,
    certificateName: trial2.CERTIFICATE_NAME,
    programVersion: trial2.PROGRAM_VERSION,
    prerequisiteCapabilityId: trial1.CAPABILITY_ID,
  },
  {
    ordinal: 3,
    capabilityId: trial3.CAPABILITY_ID,
    capabilityVersion: trial3.CAPABILITY_VERSION,
    moduleId: trial3.MODULE_ID,
    moduleVersion: trial3.MODULE_VERSION,
    productionTrialId: trial3.PRODUCTION_TRIAL_ID,
    productionTrialVersion: trial3.TRIAL_VERSION,
    historicalTrialId: trial3.TRIAL_ID,
    verifierId: trial3.VERIFIER_ID,
    verifierVersion: trial3.VERIFIER_VERSION,
    certificateName: trial3.CERTIFICATE_NAME,
    programVersion: trial3.PROGRAM_VERSION,
    prerequisiteCapabilityId: trial2.CAPABILITY_ID,
  },
  {
    ordinal: 4,
    capabilityId: trial4.CAPABILITY_ID,
    capabilityVersion: trial4.CAPABILITY_VERSION,
    moduleId: trial4.MODULE_ID,
    moduleVersion: trial4.MODULE_VERSION,
    productionTrialId: trial4.PRODUCTION_TRIAL_ID,
    productionTrialVersion: trial4.TRIAL_VERSION,
    historicalTrialId: trial4.TRIAL_ID,
    verifierId: trial4.VERIFIER_ID,
    verifierVersion: trial4.VERIFIER_VERSION,
    certificateName: trial4.CERTIFICATE_NAME,
    programVersion: trial4.PROGRAM_VERSION,
    prerequisiteCapabilityId: trial3.CAPABILITY_ID,
  },
  {
    ordinal: 5,
    capabilityId: trial5.CAPABILITY_ID,
    capabilityVersion: trial5.CAPABILITY_VERSION,
    moduleId: trial5.MODULE_ID,
    moduleVersion: trial5.MODULE_VERSION,
    productionTrialId: trial5.PRODUCTION_TRIAL_ID,
    productionTrialVersion: trial5.TRIAL_VERSION,
    historicalTrialId: trial5.TRIAL_ID,
    verifierId: trial5.VERIFIER_ID,
    verifierVersion: trial5.VERIFIER_VERSION,
    certificateName: trial5.CERTIFICATE_NAME,
    programVersion: trial5.PROGRAM_VERSION,
    prerequisiteCapabilityId: trial4.CAPABILITY_ID,
  },
  {
    ordinal: 6,
    capabilityId: trial6.CAPABILITY_ID,
    capabilityVersion: trial6.CAPABILITY_VERSION,
    moduleId: trial6.MODULE_ID,
    moduleVersion: trial6.MODULE_VERSION,
    productionTrialId: trial6.PRODUCTION_TRIAL_ID,
    productionTrialVersion: trial6.TRIAL_VERSION,
    historicalTrialId: trial6.TRIAL_ID,
    verifierId: trial6.VERIFIER_ID,
    verifierVersion: trial6.VERIFIER_VERSION,
    certificateName: trial6.CERTIFICATE_NAME,
    programVersion: trial6.PROGRAM_VERSION,
    prerequisiteCapabilityId: trial5.CAPABILITY_ID,
  },
  {
    ordinal: 7,
    capabilityId: trial7.CAPABILITY_ID,
    capabilityVersion: trial7.CAPABILITY_VERSION,
    moduleId: trial7.MODULE_ID,
    moduleVersion: trial7.MODULE_VERSION,
    productionTrialId: trial7.PRODUCTION_TRIAL_ID,
    productionTrialVersion: trial7.TRIAL_VERSION,
    historicalTrialId: trial7.TRIAL_ID,
    verifierId: trial7.VERIFIER_ID,
    verifierVersion: trial7.VERIFIER_VERSION,
    certificateName: trial7.CERTIFICATE_NAME,
    programVersion: trial7.PROGRAM_VERSION,
    prerequisiteCapabilityId: trial6.CAPABILITY_ID,
  },
];

export const PRODUCTION_TRIAL_IDS: readonly string[] = PRODUCTION_CAPABILITIES.map(
  (capability) => capability.productionTrialId,
);

export function findProductionCapability(capabilityId: string): ProductionCapabilityDefinition | null {
  return PRODUCTION_CAPABILITIES.find((capability) => capability.capabilityId === capabilityId) ?? null;
}

export function findProductionCapabilityByTrialId(trialId: string): ProductionCapabilityDefinition | null {
  return PRODUCTION_CAPABILITIES.find((capability) => capability.productionTrialId === trialId) ?? null;
}

export function isProductionTrialId(trialId: string): boolean {
  return findProductionCapabilityByTrialId(trialId) !== null;
}
