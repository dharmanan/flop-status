import type { TclkMcpClientLike } from "./tclk-mcp-client.js";
import { resolveTechnocoreUrl } from "./tclk-env.js";

const CONTRACT_RE = /^0x[0-9a-f]{64}$/;
const STATEMENT_RE = /^0x[0-9a-f]{64}$/;
const SECRET_RE = /^0x[0-9a-f]{64}$/;
const PAPER_PREFIX = "tclkpaper1";

type FetchLike = typeof fetch;

export type PaperStatus = "locked" | "claimed" | "refunded";

export interface PaperRecord {
  status: PaperStatus;
  lock: "hash";
  statement: string;
  refundAfterMs: number;
  secret?: string;
}

export interface PaperTerms {
  contract: string;
  statement: string;
  refundAfterMs: number;
}

function paperPath(contract: string): { ns: string; key: string } {
  if (!CONTRACT_RE.test(contract)) throw new Error("malformed TCLK contract id");
  return { ns: `tclk-paper-${contract.slice(2, 4)}`, key: contract.slice(4, 18) };
}

function encode(record: PaperRecord): string {
  const head = `${PAPER_PREFIX} ${record.status} ${record.lock} ${record.statement} ${record.refundAfterMs}`;
  return record.secret ? `${head} ${record.secret}` : head;
}

function decode(value: string): PaperRecord | null {
  const parts = value.trim().split(" ");
  if (parts.length < 5 || parts.length > 6) return null;
  const [prefix, status, lock, statement, refundAfterRaw, secret] = parts;
  if (prefix !== PAPER_PREFIX) return null;
  if (status !== "locked" && status !== "claimed" && status !== "refunded") return null;
  if (lock !== "hash" || !statement || !STATEMENT_RE.test(statement)) return null;
  const refundAfterMs = Number(refundAfterRaw);
  if (!Number.isSafeInteger(refundAfterMs) || refundAfterMs <= 0) return null;
  if ((status === "claimed") !== (secret !== undefined)) return null;
  if (secret !== undefined && !SECRET_RE.test(secret)) return null;
  return { status, lock, statement, refundAfterMs, ...(secret ? { secret } : {}) };
}

function stripUntrustedBanner(body: string): string {
  return body
    .split("\n")
    .filter((line) => !line.startsWith("!!") && line.trim() !== "")
    .join("\n")
    .trimEnd();
}

export class TclkPaperRailAdapter {
  constructor(
    private readonly mcp: TclkMcpClientLike,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = resolveTechnocoreUrl(),
    private readonly clock: () => number = Date.now,
  ) {}

  async read(contract: string): Promise<PaperRecord | null> {
    const { ns, key } = paperPath(contract);
    const response = await this.fetchImpl(`${this.baseUrl}/kv/${ns}/${key}`, { headers: { accept: "text/plain" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Technocore paper note read failed: HTTP ${response.status}`);
    const value = stripUntrustedBanner(await response.text());
    return value ? decode(value) : null;
  }

  async lock(terms: PaperTerms): Promise<{ ref: string; record: PaperRecord }> {
    if (!CONTRACT_RE.test(terms.contract) || !STATEMENT_RE.test(terms.statement)) throw new Error("invalid paper lock terms");
    if (!Number.isSafeInteger(terms.refundAfterMs) || this.clock() >= terms.refundAfterMs) {
      throw new Error("refusing paper lock in an open refund window");
    }
    const record: PaperRecord = { status: "locked", lock: "hash", statement: terms.statement, refundAfterMs: terms.refundAfterMs };
    const { ns, key } = paperPath(terms.contract);
    const response = await this.fetchImpl(
      `${this.baseUrl}/kv/${ns}/${key}/set/${encodeURIComponent(encode(record))}?if_absent=1`,
      { headers: { accept: "text/plain" } },
    );
    if (response.status === 409) {
      throw Object.assign(new Error("paper rail already has a record for this contract"), {
        status: 409,
        code: "PAPER_RECORD_EXISTS",
      });
    }
    if (!response.ok) throw new Error(`Technocore paper lock failed: HTTP ${response.status}`);
    return { ref: terms.contract, record };
  }

  async claim(contract: string, secret: string): Promise<PaperRecord> {
    if (!SECRET_RE.test(secret)) throw new Error("paper claim secret must be 32-byte lowercase hex");
    const current = await this.requireLocked(contract, "claim");
    if (this.clock() >= current.record.refundAfterMs) throw new Error("paper claim after refundAfterMs");
    const verified = await this.mcp.call<{ valid: boolean }>("tclk_verify_secret", {
      lock: "hash",
      statement: current.record.statement,
      secret,
    });
    if (verified.valid !== true) throw new Error("secret does not open the paper statement");
    const next: PaperRecord = { ...current.record, status: "claimed", secret };
    await this.compareAndSet(contract, current.raw, next);
    return next;
  }

  async refund(contract: string): Promise<PaperRecord> {
    const current = await this.requireLocked(contract, "refund");
    if (this.clock() < current.record.refundAfterMs) throw new Error("paper refund before refundAfterMs");
    const next: PaperRecord = { ...current.record, status: "refunded" };
    await this.compareAndSet(contract, current.raw, next);
    return next;
  }

  private async requireLocked(contract: string, op: string): Promise<{ raw: string; record: PaperRecord }> {
    const { ns, key } = paperPath(contract);
    const response = await this.fetchImpl(`${this.baseUrl}/kv/${ns}/${key}`, { headers: { accept: "text/plain" } });
    if (response.status === 404) throw new Error(`paper ${op} on unknown contract`);
    if (!response.ok) throw new Error(`Technocore paper note read failed: HTTP ${response.status}`);
    const raw = stripUntrustedBanner(await response.text());
    const record = decode(raw);
    if (!record) throw new Error(`paper ${op} on unreadable record`);
    if (record.status !== "locked") throw new Error(`paper ${op} on ${record.status} record`);
    return { raw, record };
  }

  private async compareAndSet(contract: string, expected: string, next: PaperRecord): Promise<void> {
    const { ns, key } = paperPath(contract);
    const response = await this.fetchImpl(
      `${this.baseUrl}/kv/${ns}/${key}/set/${encodeURIComponent(encode(next))}?if=${encodeURIComponent(expected)}`,
      { headers: { accept: "text/plain" } },
    );
    if (response.status === 409) throw new Error("paper record changed during update");
    if (!response.ok) throw new Error(`Technocore paper update failed: HTTP ${response.status}`);
  }
}
