import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const deals = readFileSync(new URL("../../web/tclk-deals.js", import.meta.url), "utf8");
const network = readFileSync(new URL("../../web/communication-nav.js", import.meta.url), "utf8");
const profileHint = readFileSync(new URL("../../web/tclk-profile-hint.js", import.meta.url), "utf8");
const transport = readFileSync(new URL("../../web/tclk-transport.js", import.meta.url), "utf8");

describe("TCLK Deals browser surface", () => {
  it("loads Deals as a network primitive, not a capability", () => {
    expect(network).toContain('import("/tclk-deals.js?v=tclk-deals-v1")');
    expect(network).toContain('import("/tclk-profile-hint.js?v=tclk-deals-v1")');
    expect(deals).toContain('copy("Deals", "Anlaşmalar")');
    expect(deals).toContain("tclk-workspace");
    expect(deals).not.toContain("Capability 8");
  });

  it("keeps protocol metadata in the Deals header, not the Agent Status card", () => {
    expect(profileHint).toContain('protocol.textContent = "TCLK 1"');
    expect(profileHint).toContain('rail.textContent = "PAPERRAIL"');
    expect(profileHint).toContain('alpha.textContent = "ALPHA"');
    expect(profileHint).toContain('lock.textContent = copy("HASH LOCK", "HASH KİLİDİ")');
    expect(profileHint).not.toContain("agent-protocol-hint");
    expect(profileHint).not.toContain("agent-status-card");
  });

  it("uses official rooms and replays board records through the official state machine", () => {
    expect(deals).toContain('const OFFER_ROOM = "tclk-offers"');
    expect(deals).toContain('tool("tclk_apply_transcript"');
    expect(deals).toContain('`mb-p-tclk-${contract.slice(2, 18)}`');
    expect(deals).toContain("boardRecords.map((record) => record.line)");
  });

  it("signs the official transport challenge locally and re-verifies raw Technocore signatures", () => {
    expect(deals).toContain("challenge.canonical");
    expect(deals).toContain("crypto.subtle.sign");
    expect(deals).toContain('import { evaluateFrameTrust, verifyTransport } from "/tclk-transport.js"');
    expect(transport).toContain('encoder.encode(`${room}|${message.nonce}|${message.text}`)');
    expect(transport).toContain("fromMatches = item?.frame?.from === item?.from && item?.from === message.from");
    expect(transport).toContain("trusted: Boolean(transportValid) && fromMatches");
    expect(deals).not.toContain("TECHNOCORE_SIGNING_KEY");
    expect(deals).not.toContain("TCLK_PAYMENT_KEY");
  });

  it("keeps acceptance secrets browser-local and PaperRail explicitly no-value", () => {
    expect(deals).toContain('const SECRET_DB = "flop-tclk-deals-v1"');
    expect(deals).toContain("await saveSecret(accepted.contract, accepted.secret)");
    expect(deals).toContain('copy("No real funds", "Gerçek para yok")');
    expect(deals).toContain('lock: "hash"');
    expect(deals).toContain('rails: ["paper"]');
    expect(deals).not.toContain("schnorrAdaptor");
  });

  it("resumes a matching PaperRail lock after a lost LOCK-frame post", () => {
    expect(deals).toContain("async function ensurePaperLock(terms)");
    expect(deals).toContain('error.code !== "PAPER_RECORD_EXISTS"');
    expect(deals).toContain("await readPaper(terms.contract)");
    expect(deals).toContain("existing.statement !== terms.statement");
    expect(deals).toContain("await ensurePaperLock({ contract: accept.contract");
  });

  function functionSource(text: string, name: string): string {
    const start = text.indexOf(name);
    expect(start, `expected to find ${name}`).toBeGreaterThanOrEqual(0);
    const nextFunction = text.indexOf("\nasync function ", start + name.length);
    const nextPlainFunction = text.indexOf("\nfunction ", start + name.length);
    const candidates = [nextFunction, nextPlainFunction].filter((index) => index >= 0);
    const end = candidates.length ? Math.min(...candidates) : text.length;
    return text.slice(start, end);
  }

  // G. An archived deal recovered from durable history must fail closed on an
  // incomplete historical replay instead of silently running the old
  // Date.now transcript replay: recoverArchivedDeal() must not call
  // tclk_apply_transcript at all.
  it("recoverArchivedDeal never calls tclk_apply_transcript (fails closed on incomplete history instead)", () => {
    const body = functionSource(deals, "async function recoverArchivedDeal(offerId)");
    expect(body).not.toContain("tclk_apply_transcript");
    expect(body).toContain("detail?.historicalReplay");
    expect(body).toContain("if (!replay?.complete)");
    expect(body).toContain("buildHistoricalBoardState(offerRecord.frame.from, replay.result)");
    expect(body).toContain("findAcceptForContract(related, boardState.contract)");
  });

  // F. dealTranscript() must not re-run the hosted tclk_apply_transcript
  // (which folds against Date.now) for a deal already carrying a durable
  // historical replay result — only for an ordinary live deal.
  it("dealTranscript distinguishes ARCHIVED HISTORICAL REPLAY from LIVE CURRENT REPLAY", () => {
    const body = functionSource(deals, "async function dealTranscript(deal)");
    expect(body).toContain("deal.historical");
    expect(body).toContain("? deal.boardState");
    expect(body).toContain('await tool("tclk_apply_transcript", { lines, nowMs: Date.now() })');
  });

  // J. Live current deals (buildDealIndex) keep replaying through the
  // official hosted MCP exactly as before — this fix must not touch that path.
  it("buildDealIndex (live offer board) still replays through the hosted tclk_apply_transcript with the live clock", () => {
    const body = functionSource(deals, "async function buildDealIndex(records, onProgress)");
    expect(body).toContain('tool("tclk_apply_transcript", { lines: related.map((record) => record.line), nowMs: Date.now() })');
  });

  // H. "My deals" must let a complete durable historical reconstruction win
  // over a stale live-room replay for the same offer id, not skip recovery
  // just because that id is already present in the current room window, and
  // must delegate the actual merge (including the fail-closed removal of a
  // stale live entry when recovery is incomplete — see
  // reconcileMyDeals in tclk-deal-recovery.test.ts) to the one shared,
  // independently-tested implementation rather than a second, ad hoc one.
  it("renderDealCards recovers every known archived offer id and merges via the shared reconcileMyDeals helper", () => {
    const body = functionSource(deals, "async function renderDealCards(filter)");
    expect(body).not.toContain("known.has(summary.offerId)) continue");
    expect(body).not.toContain("else if (!byOfferId.has(summary.offerId))");
    expect(body).toContain("recoveryResults.push(recovered)");
    expect(body).toContain("reconcileMyDeals(deals, recoveryResults)");
  });

  it("imports the pure historical-recovery helpers used by recoverArchivedDeal and renderDealCards", () => {
    expect(deals).toContain('import { buildHistoricalBoardState, findAcceptForContract, reconcileMyDeals } from "/tclk-deal-recovery.js"');
  });

  // UI clarity fix: a rejected signed record (e.g. a cancel attempt after the
  // agreement already reached a terminal state) must not appear as a numbered
  // step in the main "Agreement steps" flow, and must not show raw protocol
  // text ("cancel in status claimed") as its primary explanation.
  it("imports the pure step-presentation helpers", () => {
    expect(deals).toContain('import { splitTimelineSteps, rejectedRecordCategory } from "/tclk-step-presentation.js"');
  });

  it("openDeal renders only the applied flow as numbered agreement steps", () => {
    const body = functionSource(deals, "async function openDeal(deal)");
    expect(body).toContain("splitTimelineSteps(state.steps)");
    expect(body).toContain('applied.forEach((step, position) =>');
    expect(body).toContain('node("span", "", `${position + 1}`)');
    // The old inline-reason row is gone: a rejected record's raw reason is no
    // longer concatenated into the primary REJECTED label in the main timeline.
    expect(body).not.toContain('copy("REJECTED", "REDDEDİLDİ")} · ${step.reason');
  });

  it("openDeal shows a separate Rejected records section, only when rejected records exist, with a friendly explanation and the raw reason kept as evidence", () => {
    const body = functionSource(deals, "async function openDeal(deal)");
    expect(body).toContain('copy("Rejected records", "Reddedilen kayıtlar")');
    expect(body).toContain("if (rejected.length)");
    // Categorized per rejected step (from its own reason), not once from the
    // deal's final status — see the rejectedRecordCategory(step) regression.
    expect(body).toContain("rejectedRecordCategory(step)");
    expect(body).not.toContain("rejectedRecordCategory(state.status)");
    expect(body).toContain("rejectedAttemptLabel(step.type)");
    expect(body).toContain("rejectedRecordExplanation(category)");
    // The signed record is not hidden: its raw reason is still rendered.
    expect(body).toContain('if (step.reason) record.appendChild(node("small", "", step.reason))');
    expect(body).toContain("...(rejectedRecords ? [rejectedRecords] : [])");
  });

  it("gives the rejected-record explanation as user-facing copy, not raw protocol text, for an already-terminal deal", () => {
    expect(deals).toContain(
      '"The agreement was already completed, so this record was not applied."',
    );
    expect(deals).toContain('"Anlaşma zaten tamamlandığı için uygulanmadı."');
  });

  it("labels a rejected record as an ATTEMPT, distinct from an applied step", () => {
    expect(deals).toContain('function rejectedAttemptLabel(type)');
    expect(deals).toContain('copy("ATTEMPT", "GİRİŞİMİ")');
  });

  // Browser-direct Technocore write transport experiment, narrowed to the
  // single write actually under investigation: LOCK, the first write that
  // must create the derived mb-p-tclk-* deal room. The hosted MCP's first
  // tclk_post_frame call stays the validation/challenge authority for every
  // write, and browser signing is unchanged. Transport choice is explicit at
  // the call site (a directTechnocore option), never inferred by parsing the
  // room or the frame — every call site except LOCK keeps the default,
  // original hosted-MCP transport regardless of which room it targets.
  const POST_LINE_SIGNATURE = "async function postLine(room, line, { directTechnocore = false } = {})";

  function postLineCallAfter(marker: string): string {
    const markerIndex = deals.indexOf(marker);
    expect(markerIndex, `expected to find ${JSON.stringify(marker)}`).toBeGreaterThanOrEqual(0);
    const postLineIndex = deals.indexOf("postLine(", markerIndex);
    expect(postLineIndex, `expected a postLine( call after ${JSON.stringify(marker)}`).toBeGreaterThan(markerIndex);
    const semicolonIndex = deals.indexOf(";", postLineIndex);
    return deals.slice(postLineIndex, semicolonIndex + 1);
  }

  it("imports the direct Technocore post transport helper", () => {
    expect(deals).toContain('import { postSignedRecordDirect } from "/technocore-direct-post.js"');
  });

  it("postLine takes an explicit directTechnocore option, defaulting to false", () => {
    expect(deals).toContain(POST_LINE_SIGNATURE);
  });

  it("postLine performs the hosted-MCP challenge call and browser signing unchanged, before choosing a transport", () => {
    const body = functionSource(deals, POST_LINE_SIGNATURE);
    expect(body).toContain('await tool("tclk_post_frame", { room, line })');
    expect(body).toContain("const signed = await signCanonical(challenge.canonical)");
  });

  // 10. challenge.posted === true returns before either second transport.
  it("postLine exits on challenge.posted === true before either second-leg transport is chosen", () => {
    const body = functionSource(deals, POST_LINE_SIGNATURE);
    const earlyReturnIndex = body.indexOf("if (challenge?.posted === true) return challenge;");
    const defaultBranchIndex = body.indexOf("if (!directTechnocore)");
    const directBranchIndex = body.indexOf("if (!DEAL_ROOM_RE.test(room))");
    expect(earlyReturnIndex).toBeGreaterThanOrEqual(0);
    expect(defaultBranchIndex).toBeGreaterThan(earlyReturnIndex);
    expect(directBranchIndex).toBeGreaterThan(earlyReturnIndex);
  });

  // 1/2. Default (directTechnocore omitted/false) always performs the
  // ORIGINAL second hosted-MCP call, for tclk-offers and for a deal room.
  it("the default (directTechnocore: false) transport is the ORIGINAL second hosted-MCP write call, and never postSignedRecordDirect", () => {
    const body = functionSource(deals, POST_LINE_SIGNATURE);
    const defaultBranchStart = body.indexOf("if (!directTechnocore)");
    const directBranchStart = body.indexOf("if (!DEAL_ROOM_RE.test(room))");
    expect(defaultBranchStart).toBeGreaterThanOrEqual(0);
    expect(directBranchStart).toBeGreaterThan(defaultBranchStart);
    const defaultBranchBody = body.slice(defaultBranchStart, directBranchStart);
    expect(defaultBranchBody).toContain('return tool("tclk_post_frame", {');
    expect(defaultBranchBody).toContain("line: challenge.text,");
    expect(defaultBranchBody).toContain("did: signed.did,");
    expect(defaultBranchBody).toContain("sig: signed.signature,");
    expect(defaultBranchBody).toContain("nonce: challenge.nonce,");
    expect(defaultBranchBody).not.toContain("postSignedRecordDirect");
  });

  // 9. directTechnocore: true with a non-derived room fails closed.
  it("directTechnocore: true requires a derived deal room and fails closed otherwise, using postSignedRecordDirect only when it matches", () => {
    const body = functionSource(deals, POST_LINE_SIGNATURE);
    const directBranchStart = body.indexOf("if (!DEAL_ROOM_RE.test(room))");
    expect(directBranchStart).toBeGreaterThanOrEqual(0);
    const directBranchBody = body.slice(directBranchStart);
    expect(directBranchBody).toContain("throw new Error(`Refusing to post: directTechnocore requires a derived TCLK deal room");
    expect(directBranchBody).toContain("return postSignedRecordDirect(room, challenge, signed);");
  });

  it("routes exactly dealRoom()'s own derived room shape (mb-p-tclk- + 16 hex chars)", () => {
    expect(deals).toContain("const DEAL_ROOM_RE = /^mb-p-tclk-[0-9a-f]{16}$/;");
    expect(deals).toContain('return `mb-p-tclk-${contract.slice(2, 18)}`;');
  });

  // 11. challenge canonical/text/nonce (and signed.did/signature) are not
  // reconstructed — passed through as the whole objects produced above.
  it("passes challenge.canonical/text/nonce and the signed did/signature through unmodified", () => {
    const body = functionSource(deals, POST_LINE_SIGNATURE);
    expect(body).toContain("signCanonical(challenge.canonical)");
    expect(body).toContain("postSignedRecordDirect(room, challenge, signed)");
  });

  // 1,2,3,4,5,6,7,8. Every postLine call site, checked individually: LOCK is
  // the only one that passes directTechnocore: true (deliberately proved by
  // inspecting every known write call site, not by counting a whole-file
  // regex match — this file's own explanatory comments also contain the
  // literal text "directTechnocore: true", so a blunt count would false-fail).
  it("only the LOCK call site passes directTechnocore: true; every other write keeps the default hosted-MCP transport", () => {
    const sites = {
      OFFER: postLineCallAfter('tool("tclk_make_offer"'),
      ACCEPT: postLineCallAfter('tool("tclk_accept_offer"'),
      "CANCEL (proposed offer)": postLineCallAfter('"cancelled by offer owner"'),
      LOCK: postLineCallAfter('tool("tclk_make_lock"'),
      "CANCEL (accepted agreement, deal room)": postLineCallAfter('"cancelled by party"'),
      REVEAL: postLineCallAfter('tool("tclk_make_reveal"'),
      REFUND: postLineCallAfter('tool("tclk_make_refund"'),
      RECEIPT: postLineCallAfter('tool("tclk_make_receipt"'),
    };

    const sitesUsingDirect = Object.entries(sites)
      .filter(([, call]) => call.includes("directTechnocore"))
      .map(([name]) => name);
    expect(sitesUsingDirect).toEqual(["LOCK"]);
    expect(sites.LOCK).toContain("directTechnocore: true");

    for (const [name, call] of Object.entries(sites)) {
      if (name === "LOCK") continue;
      expect(call, `${name} must not pass directTechnocore`).not.toContain("directTechnocore");
    }
  });
});
