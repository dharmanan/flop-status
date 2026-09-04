// Shared, fail-closed resolution for the two external TCLK/Technocore
// endpoints. Every raw TCLK room read and every PaperRail read/write must
// resolve the venue through resolveTechnocoreUrl() so they can never split
// onto different Technocore hosts. Neither resolver has a built-in default:
// this test environment must never silently talk to a remote hosted service.

export class TclkConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TclkConfigError";
  }
}

export function resolveTechnocoreUrl(): string {
  const value = process.env.TECHNOCORE_URL?.trim();
  if (!value) {
    throw new TclkConfigError(
      "TECHNOCORE_URL is not configured. This environment has no default Technocore venue; set TECHNOCORE_URL explicitly before using TCLK raw-room or PaperRail paths.",
    );
  }
  return value;
}

export function resolveTclkMcpUrl(): string {
  const value = process.env.TCLK_MCP_URL?.trim();
  if (!value) {
    throw new TclkConfigError(
      "TCLK_MCP_URL is not configured. This environment has no default TCLK MCP endpoint; set TCLK_MCP_URL explicitly before using TCLK MCP-backed paths.",
    );
  }
  return value;
}
