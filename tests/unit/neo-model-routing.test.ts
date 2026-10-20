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
    expect(urls[0]).toContain("/gemini-2.5-flash:generateContent");
    expect(urls[1]).toContain("/gemini-2.0-flash:generateContent");
  });

  it("builds offline reply with voltage compatibility and general safety note", async () => {
    const { buildOfflineEvidenceReply } = await import("@/features/ai/customer/assistant");
    const testEvidence = [
      {
        toolId: "product_compatibility" as const,
        status: "ok" as const,
        source: { label: "test", observedAt: "2026-10-19T00:00:00Z" },
        unknown: [],
        links: [],
        known: {
          matchedProducts: [
            { name: "Nồi cơm Zojirushi", voltageNote: "Chỉ dùng 100V, cần biến áp tối thiểu 1500W" },
          ],
          generalSafety: "Nếu nhãn ghi chỉ dùng 100V, không cắm trực tiếp vào nguồn 220V.",
        },
      },
    ];

    const reply = buildOfflineEvidenceReply("nồi cơm", testEvidence, false);
    expect(reply).toContain("Lưu ý tương thích điện áp Nhật Bản (100V)");
    expect(reply).toContain("Nồi cơm Zojirushi");
    expect(reply).toContain("Chỉ dùng 100V, cần biến áp tối thiểu 1500W");
    expect(reply).toContain("Khuyến cáo an toàn điện áp");
    expect(reply).toContain("không cắm trực tiếp vào nguồn 220V");
  });
});
