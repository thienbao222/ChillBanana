import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchRakuten } from "@/features/purchasing/sources/rakuten";
import { searchYahooShopping } from "@/features/purchasing/sources/yahoo-shopping";

describe("WP4.2 — Khung kết nối API chính thống (Rakuten & Yahoo Shopping)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Rakuten Ichiba Item Search Client", () => {
    it("trả về lỗi mềm và hướng dẫn khách dán link khi thiếu RAKUTEN_APP_ID", async () => {
      delete process.env.RAKUTEN_APP_ID;
      const res = await searchRakuten("matcha");

      expect(res.success).toBe(false);
      expect(res.items).toHaveLength(0);
      expect(res.error).toContain("Rakuten API Key chưa được thiết lập");
    });

    it("xử lý lỗi HTTP 429 mà không làm sập hệ thống (isRateLimited: true)", async () => {
      process.env.RAKUTEN_APP_ID = "mock-app-id";
      const mockFetch = vi.fn().mockResolvedValue({
        status: 429,
        ok: false,
      } as any);

      const res = await searchRakuten("matcha", 10, mockFetch);
      expect(res.success).toBe(false);
      expect(res.isRateLimited).toBe(true);
      expect(res.error).toContain("giới hạn tần suất");
    });

    it("chuẩn hóa kết quả tìm kiếm hợp lệ từ Rakuten với quoteSource = API_RAKUTEN", async () => {
      process.env.RAKUTEN_APP_ID = "mock-app-id";
      const mockPayload = {
        count: 1,
        Items: [
          {
            Item: {
              itemCode: "store:1001",
              itemName: "Trà xanh Uji Matcha Nhật Bản",
              itemPrice: 1500,
              itemUrl: "https://item.rakuten.co.jp/store/1001",
              shopName: "Uji Tea Official",
              mediumImageUrls: [{ imageUrl: "https://thumbnail.rakuten.co.jp/1001.jpg" }],
            },
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => mockPayload,
      } as any);

      const res = await searchRakuten("matcha", 10, mockFetch);
      expect(res.success).toBe(true);
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.id).toBe("store:1001");
      expect(item.name).toBe("Trà xanh Uji Matcha Nhật Bản");
      expect(item.priceJpy).toBe(1500);
      expect(item.marketplace).toBe("RAKUTEN");
      expect(item.quoteSource).toBe("API_RAKUTEN");
      expect(item.url).toBe("https://item.rakuten.co.jp/store/1001");
      expect(item.imageUrl).toBe("https://thumbnail.rakuten.co.jp/1001.jpg");
    });
  });

  describe("Yahoo! Shopping Item Search Client", () => {
    it("trả về lỗi mềm và credit bắt buộc khi thiếu YAHOO_CLIENT_ID", async () => {
      delete process.env.YAHOO_CLIENT_ID;
      const res = await searchYahooShopping("gundam");

      expect(res.success).toBe(false);
      expect(res.items).toHaveLength(0);
      expect(res.error).toContain("Yahoo! Shopping Client ID chưa được thiết lập");
      expect(res.creditHtml).toContain("Web Services by Yahoo! JAPAN");
    });

    it("xử lý lỗi HTTP 429 từ Yahoo! Shopping", async () => {
      process.env.YAHOO_CLIENT_ID = "mock-yahoo-id";
      const mockFetch = vi.fn().mockResolvedValue({
        status: 429,
        ok: false,
      } as any);

      const res = await searchYahooShopping("gundam", 10, mockFetch);
      expect(res.success).toBe(false);
      expect(res.isRateLimited).toBe(true);
    });

    it("chuẩn hóa kết quả tìm kiếm hợp lệ từ Yahoo! Shopping với quoteSource = API_YAHOO", async () => {
      process.env.YAHOO_CLIENT_ID = "mock-yahoo-id";
      const mockPayload = {
        totalResultsAvailable: 1,
        hits: [
          {
            code: "bandai-001",
            name: "Mô hình RG 1/144 RX-78-2 Gundam Ver.2.0",
            price: 3850,
            url: "https://store.shopping.yahoo.co.jp/bandai/001.html",
            seller: { name: "Bandai Hobby Store" },
            image: { medium: "https://item-shopping.c.yimg.jp/i/l/bandai_001.jpg" },
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => mockPayload,
      } as any);

      const res = await searchYahooShopping("gundam", 10, mockFetch);
      expect(res.success).toBe(true);
      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.id).toBe("bandai-001");
      expect(item.name).toBe("Mô hình RG 1/144 RX-78-2 Gundam Ver.2.0");
      expect(item.priceJpy).toBe(3850);
      expect(item.marketplace).toBe("YAHOO");
      expect(item.quoteSource).toBe("API_YAHOO");
      expect(res.creditHtml).toContain("Web Services by Yahoo! JAPAN");
    });
  });
});
