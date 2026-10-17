import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Neo model routing", () => {
  it("uses the free primary model and falls back after a quota response", async () => {
    vi.resetModules();
    vi.stubEnv("GEMINI_CHAT_KEYS", "test-chat-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("quota exceeded", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Neo trả lời" }] } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { askGeminiAgent } = await import("@/features/ai/customer/assistant");
    const reply = await askGeminiAgent("Tư vấn giúp tôi", "vietnamese");
    const urls = fetchMock.mock.calls.map(([url]) => String(url));

    expect(reply).toBe("Neo trả lời");
    expect(urls[0]).toContain("/gemini-3.8-flash:generateContent");
    expect(urls[1]).toContain("/gemini-3.6-flash:generateContent");
  });
});
