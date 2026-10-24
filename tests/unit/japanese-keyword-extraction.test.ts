import { afterEach, describe, expect, it, vi } from "vitest";
import {
  translateToJapaneseKeywords,
  translateToJapaneseKeywordsFromDictionary,
  isValidJapaneseSearchKeyword,
  buildMarketplaceSearchLinks,
  extractKeywordsWithGemini,
} from "@/features/ai/customer/japanese-translator";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("BƯỚC 2: Từ khóa tìm sàn Nhật phải là tiếng Nhật thật", () => {
  describe("isValidJapaneseSearchKeyword", () => {
    it("chấp nhận từ khóa chứa chữ Nhật (Kanji, Katakana, Hiragana)", () => {
      expect(isValidJapaneseSearchKeyword("炊飯器")).toBe(true);
      expect(isValidJapaneseSearchKeyword("象印 ZOJIRUSHI 炊飯器")).toBe(true);
      expect(isValidJapaneseSearchKeyword("グッチ GUCCI")).toBe(true);
      expect(isValidJapaneseSearchKeyword("ノイズキャンセリング ヘッドホン")).toBe(true);
    });

    it("chấp nhận thương hiệu quốc tế hợp lệ", () => {
      expect(isValidJapaneseSearchKeyword("Sony")).toBe(true);
      expect(isValidJapaneseSearchKeyword("Uniqlo")).toBe(true);
      expect(isValidJapaneseSearchKeyword("PlayStation 5")).toBe(true);
    });

    it("từ chối từ khóa chứa dấu tiếng Việt", () => {
      expect(isValidJapaneseSearchKeyword("tìm nồi cơm điện")).toBe(false);
      expect(isValidJapaneseSearchKeyword("áo khoác ấm")).toBe(false);
      expect(isValidJapaneseSearchKeyword("giày thể thao nam")).toBe(false);
    });

    it("từ chối chuỗi chỉ gồm các từ tiếng Việt không dấu cắt từ câu", () => {
      expect(isValidJapaneseSearchKeyword("tim giup toi ao khoac")).toBe(false);
      expect(isValidJapaneseSearchKeyword("muon mua cai gi do")).toBe(false);
      expect(isValidJapaneseSearchKeyword("xin chao shop")).toBe(false);
      expect(isValidJapaneseSearchKeyword("")).toBe(false);
      expect(isValidJapaneseSearchKeyword("a")).toBe(false);
    });
  });

  describe("buildMarketplaceSearchLinks", () => {
    it("tạo link tìm kiếm khi có từ khóa tiếng Nhật hợp lệ", () => {
      const links = buildMarketplaceSearchLinks("象印 炊飯器", 5000, 20000);
      expect(links).not.toBeNull();
      expect(links!.amazon.url).toContain("https://www.amazon.co.jp/s?k=");
      expect(links!.mercari.url).toContain("https://jp.mercari.com/search?keyword=");
      expect(links!.rakuten.url).toContain("https://search.rakuten.co.jp/search/mall/");
    });

    it("trả về null và KHÔNG tạo link khi từ khóa là tiếng Việt hoặc rỗng", () => {
      expect(buildMarketplaceSearchLinks("")).toBeNull();
      expect(buildMarketplaceSearchLinks("tìm giúp tôi áo khoác")).toBeNull();
      expect(buildMarketplaceSearchLinks("tim giup toi ao khoac")).toBeNull();
    });
  });

  describe("translateToJapaneseKeywordsFromDictionary", () => {
    it("khớp từ điển thì trả về từ khóa tiếng Nhật chuẩn", () => {
      const res = translateToJapaneseKeywordsFromDictionary("mua nồi cơm zojirushi");
      expect(res.matched).toBe(true);
      expect(res.keywordsJa).toContain("象印 ZOJIRUSHI");
      expect(res.keywordsJa).toContain("炊飯器");
    });

    it("không khớp từ điển thì không dùng regex cắt dấu và keywordsJa là rỗng", () => {
      const res = translateToJapaneseKeywordsFromDictionary("tôi cần mua một chiếc áo ấm");
      expect(res.matched).toBe(false);
      expect(res.keywordsJa).toBe("");
    });
  });

  describe("translateToJapaneseKeywords với Gemini", () => {
    it("khi từ điển đã khớp thì KHÔNG gọi Gemini", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const res = await translateToJapaneseKeywords("nồi cơm zojirushi");
      expect(res.keywordsJa).toContain("象印");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("khi từ điển không khớp thì gọi Gemini trích xuất từ khóa tiếng Nhật chuẩn", async () => {
      vi.stubEnv("GEMINI_CHAT_KEYS", "test-chat-key");
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        keywordsJa: "メカニカル キーボード ワイヤレス",
                        keywordsVi: "bàn phím cơ không dây",
                        category: "gadgets",
                        brand: "Keychron",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await translateToJapaneseKeywords("cần mua bàn phím cơ không dây");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callUrl = fetchMock.mock.calls[0][0];
      expect(callUrl).toContain("/gemini-3.5-flash-lite:generateContent");
      expect(res.keywordsJa).toBe("メカニカル キーボード ワイヤレス");
      expect(res.category).toBe("gadgets");
    });

    it("khi Gemini lỗi thì dùng từ điển (fallback) và không văng exception", async () => {
      vi.stubEnv("GEMINI_CHAT_KEYS", "test-chat-key");
      const fetchMock = vi.fn().mockResolvedValue(new Response("error 500", { status: 500 }));
      vi.stubGlobal("fetch", fetchMock);

      const res = await translateToJapaneseKeywords("cần tìm sản phẩm lạ chưa có trong từ điển");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(res.keywordsJa).toBe("");
    });
  });
});
