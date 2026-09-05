import { afterEach, describe, expect, it, vi } from "vitest";
import certificatePage from "../../api/certificate-page.js";

const certificateId = "8e09b742-0e18-4668-a000-f09f3144";
const did = "did:key:z6Mkn7LCcVgptpXz141Fk58UUhfho77Toer96cfqf3wVVxE4";

function captureResponse() {
  const headers: Record<string, string> = {};
  let status = 0;
  let html = "";
  return {
    headers,
    get statusCode() { return status; },
    get html() { return html; },
    response: {
      setHeader(name: string, value: string) { headers[name] = value; },
      status(value: number) { status = value; return this; },
      send(value: string) { html = value; return this; },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shareable certificate Vercel page", () => {
  it("renders compact crawler-visible metadata from public proof/profile data", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes(`/certificates/${certificateId}`)) {
        return new Response(JSON.stringify({
          certificate: {
            certificate_id: certificateId,
            agent_did: did,
            capability_id: "runtime.failure-recovery-idempotency",
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/agent-profiles/")) {
        return new Response(JSON.stringify({ profile: { display_name: "kohen", handle: "koheneric" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/certificates")) {
        return new Response(JSON.stringify({
          certificate_count: 7,
          rank: { rank_id: "core-verified", rank_name: "Core Verified", min_certificates: 7 },
          certificates: [],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    }));

    const capture = captureResponse();
    await certificatePage({ query: { certificateId } }, capture.response);

    expect(capture.statusCode).toBe(200);
    expect(capture.headers["content-type"]).toContain("text/html");
    expect(capture.html).toContain('twitter:card" content="summary"');
    expect(capture.html).not.toContain("summary_large_image");
    expect(capture.html).not.toContain("og:image");
    expect(capture.html).not.toContain("twitter:image");
    expect(capture.html).toContain("C7 · Failure Recovery &amp; Idempotency · Flop Proof");
    expect(capture.html).toContain("kohen");
    expect(capture.html).toContain("Flop Proof: koheneric");
    expect(capture.html).toContain("Core Verified");
    expect(capture.html).not.toContain("[object Object]");
    expect(capture.html).toContain(`/certificate/${certificateId}`);
  });

  it("fails closed when the certificate lookup is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const capture = captureResponse();
    await certificatePage({ query: { certificateId } }, capture.response);

    expect(capture.statusCode).toBe(200);
    expect(capture.html).toContain("Flop Proof Certificate");
    expect(capture.html).toContain("current verification state");
    expect(capture.html).not.toContain("Verified Working Capability");
    expect(capture.html).not.toContain("summary_large_image");
  });
});
