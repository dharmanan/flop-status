/**
 * Cumulative rank is derived from the number of valid individual production
 * certificates. It is never stored on a certificate and never replaces one.
 *
 * Thresholds come from docs/certification-model-v1.md.
 */
export interface AgentRank {
  rank_id: string;
  rank_name: string;
  min_certificates: number;
}

const RANKS: readonly AgentRank[] = [
  { rank_id: "rookie", rank_name: "Rookie", min_certificates: 3 },
  { rank_id: "regular", rank_name: "Regular", min_certificates: 5 },
  { rank_id: "core-verified", rank_name: "Core Verified", min_certificates: 7 },
  { rank_id: "advanced", rank_name: "Advanced", min_certificates: 8 },
  { rank_id: "agentic-verified", rank_name: "Agentic Verified", min_certificates: 10 },
];

/**
 * Returns null below three certificates: those agents hold individually valid
 * certificates but have not unlocked a named cumulative rank yet.
 */
export function rankForCertificateCount(certificateCount: number): AgentRank | null {
  let current: AgentRank | null = null;
  for (const rank of RANKS) {
    if (certificateCount >= rank.min_certificates) current = rank;
  }
  return current;
}
