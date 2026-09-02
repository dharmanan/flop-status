import { describe, expect, it } from "vitest";
import { friendlyErrorMessage } from "../../web/error-copy.js";

describe("friendlyErrorMessage (readable errors without hiding diagnostics)", () => {
  it("returns a clear sentence with the code kept alongside for a known code", () => {
    const message = friendlyErrorMessage("AGENT_HANDLE_TAKEN", "agent handle is already in use", "en");
    expect(message).toContain("already in use");
    expect(message).toContain("AGENT_HANDLE_TAKEN");
  });

  it("returns the Turkish sentence for the same code when lang is tr", () => {
    const message = friendlyErrorMessage("AGENT_HANDLE_TAKEN", "agent handle is already in use", "tr");
    expect(message).toContain("kullanılıyor");
    expect(message).toContain("AGENT_HANDLE_TAKEN");
  });

  it("falls back to the given fallback text for an unmapped code, without hiding it", () => {
    const message = friendlyErrorMessage("SOME_UNMAPPED_CODE", "raw server message", "en");
    expect(message).toBe("raw server message");
  });

  it("falls back cleanly when no code is available at all", () => {
    const message = friendlyErrorMessage(undefined, "HTTP_500", "en");
    expect(message).toBe("HTTP_500");
  });
});
