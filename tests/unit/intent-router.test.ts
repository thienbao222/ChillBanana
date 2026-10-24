import { afterEach, describe, expect, it, vi } from "vitest";

const { getNextKey, markError } = vi.hoisted(() => ({
  getNextKey: vi.fn(() => "test-key"),
  markError: vi.fn(),
}));

vi.mock("@/lib/api-key-manager", () => ({
  chatKeyPool: { getNextKey, markError },
}));

vi.mock("@/lib/gemini-models", () => ({
  GEMINI_MODELS: {
    lightweight: "gemini-lightweight",
    neoFallback: "gemini-fallback",
  },
}));

import { routeSupportIntent } from "@/features/ai/customer/intent-router";

function responseWithText(text: string) {
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
}

describe("routeSupportIntent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses Gemini JSON output and sanitizes the routed product terms", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseWithText(JSON.stringify({
      intents: { catalog: true, quote: false, orderStatus: false, shipping: false, compatibility: false, addToCart: false },
      searchTerms: ["Sữa rửa mặt Hada", "có", "Hada", "Sữa rửa mặt Hada Labo", "dư thừa", "sáu", "bảy"],
      keywordsJa: ["肌ラボ Hada Labo", "###"],
      category: "cosmetics",
      referencesPreviousProduct: false,
    }))));

    const route = await routeSupportIntent("sữa rửa mặt hada còn hàng sẵn không", [
      { role: "user", text: "Tìm Hada Labo giúp mình" },
    ]);

    expect(route).toMatchObject({
      intents: { catalog: true, quote: false },
      searchTerms: ["Sữa rửa mặt Hada", "Hada", "Sữa rửa mặt Hada Labo", "dư thừa", "sáu", "bảy"],
      keywordsJa: ["肌ラボ Hada Labo"],
      category: "cosmetics",
      referencesPreviousProduct: false,
    });
    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("gemini-lightweight");
    expect(JSON.parse(String(request?.body)).generationConfig).toMatchObject({
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "low" },
    });
  });

  it("tries neoFallback when the lightweight model returns invalid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(responseWithText("not json"))
      .mockResolvedValueOnce(responseWithText(JSON.stringify({
        intents: { catalog: true }, searchTerms: ["Zojirushi"], keywordsJa: [], category: "gadgets",
      }))));

    const route = await routeSupportIntent("bình giữ nhiệt Zojirushi có sẵn không");

    expect(route?.searchTerms).toEqual(["Zojirushi"]);
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain("gemini-fallback");
  });

  it("returns null when no API key or valid model response is available", async () => {
    getNextKey.mockReturnValue(null);
    expect(await routeSupportIntent("sữa rửa mặt Hada")).toBeNull();

    getNextKey.mockReturnValue("test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseWithText("{}")));
    expect(await routeSupportIntent("sữa rửa mặt Hada")).toBeNull();
  });

  it("returns null after router request timeouts so the catalog safety net can take over", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    expect(await routeSupportIntent("sữa rửa mặt Hada")).toBeNull();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
