import { afterEach, describe, expect, it, vi } from "vitest";
import certificatePage from "../../api/certificate-page.js";

const certificateId = "8e09b742-0e18-4668-a000-f09f3144";
const did = "did:key:z6Mkn7LCcVgptpXz141Fk58UUhfho77Toer96cfqf3wVVxE4";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shareable certificate Vercel page", () => {
  it("renders crawler-visible dynamic metadata from public proof/profile data", async () => {
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
        return new Response(JSON.stringify({ certificate_count: 7, rank: "Core Verified", certificates: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    }));

    const headers: Record<string, string> = {};
    let status = 0;
    let html = "";
    const response = {
      setHeader(name: string, value: string) { headers[name] = value; },
      status(value: number) { status = value; return this; },
      send(value: string) { html = value; return this; },
    };

    await certificatePage({ query: { certificateId } }, response);

    expect(status).toBe(200);
    expect(headers["content-type"]).toContain("text/html");
    expect(html).toContain("twitter:card");
    expect(html).toContain("summary_large_image");
    expect(html).toContain("certificate-card/c7.png");
    expect(html).toContain("kohen");
    expect(html).toContain("@koheneric");
    expect(html).toContain("Core Verified");
    expect(html).toContain(`/certificate/${certificateId}`);
  });
});
