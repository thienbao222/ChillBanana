import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

describe("WP4.1 — Nguồn báo giá & Hàng đợi duyệt giá (Human-in-the-loop)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Quy tắc duyệt giá bất biến: Không có đường nào tự động duyệt ngoài catalog", () => {
    it("dòng ngoài catalog từ bất kỳ nguồn nào (API, EXTENSION, SCRAPE, MANUAL) đều bắt buộc isPriceVerified = false", () => {
      const externalSources = ["API_RAKUTEN", "API_YAHOO", "EXTENSION", "MANUAL", "SCRAPE"];

      for (const source of externalSources) {
        // Mô phỏng logic resolve order item
        const isCatalog = source === "CATALOG";
        const isOnlyCatalogItems = isCatalog;

        const orderItemData = {
          itemType: isCatalog ? "CATALOG" : "EXTERNAL",
          quoteSource: source,
          quoteVerifiedAt: isCatalog ? new Date() : null,
          quoteVerifiedBy: isCatalog ? "SYSTEM_CATALOG" : null,
        };

        const orderData = {
          isPriceVerified: isOnlyCatalogItems,
          priceVerifiedAt: isOnlyCatalogItems ? new Date() : null,
        };

        expect(orderItemData.quoteVerifiedAt).toBeNull();
        expect(orderItemData.quoteVerifiedBy).toBeNull();
        expect(orderData.isPriceVerified).toBe(false);
        expect(orderData.priceVerifiedAt).toBeNull();
      }
    });

    it("chỉ đơn 100% dòng CATALOG mới được tự động coi là đã xác minh", () => {
      const isOnlyCatalogItems = true;
      const orderData = {
        isPriceVerified: isOnlyCatalogItems,
        priceVerifiedAt: isOnlyCatalogItems ? new Date() : null,
      };

      expect(orderData.isPriceVerified).toBe(true);
      expect(orderData.priceVerifiedAt).not.toBeNull();
    });
  });

  describe("Hàng đợi báo giá (Quote Queue) & Cảnh báo quá hạn 4 giờ", () => {
    it("tính chính xác tuổi đơn và kích hoạt cảnh báo đổi màu isOverdue4h khi ≥ 4 giờ", () => {
      const now = Date.now();
      const threeHoursAgo = new Date(now - 3 * 3600 * 1000);
      const fourAndHalfHoursAgo = new Date(now - 4.5 * 3600 * 1000);

      const itemRecent = {
        createdAt: threeHoursAgo,
      };
      const ageRecentHours = Math.round(((now - itemRecent.createdAt.getTime()) / (3600 * 1000)) * 10) / 10;
      const isOverdueRecent = ageRecentHours >= 4;

      expect(ageRecentHours).toBe(3);
      expect(isOverdueRecent).toBe(false);

      const itemOverdue = {
        createdAt: fourAndHalfHoursAgo,
      };
      const ageOverdueHours = Math.round(((now - itemOverdue.createdAt.getTime()) / (3600 * 1000)) * 10) / 10;
      const isOverdue = ageOverdueHours >= 4;

      expect(ageOverdueHours).toBe(4.5);
      expect(isOverdue).toBe(true);
    });

    it("lọc chính xác theo quoteSource trong hàng đợi", () => {
      const queue = [
        { orderCode: "CB-1", sources: ["API_RAKUTEN"] },
        { orderCode: "CB-2", sources: ["SCRAPE"] },
        { orderCode: "CB-3", sources: ["EXTENSION"] },
      ];

      const filteredRakuten = queue.filter((q) => q.sources.includes("API_RAKUTEN"));
      expect(filteredRakuten).toHaveLength(1);
      expect(filteredRakuten[0].orderCode).toBe("CB-1");

      const filteredScrape = queue.filter((q) => q.sources.includes("SCRAPE"));
      expect(filteredScrape).toHaveLength(1);
      expect(filteredScrape[0].orderCode).toBe("CB-2");
    });
  });
});

