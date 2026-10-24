import { describe, expect, it } from "vitest";
import { buildOfflineEvidenceReply } from "@/features/ai/customer/assistant";
import type { SupportEvidence } from "@/features/ai/customer/support-policy";

describe("Bỏ sản phẩm và giá tự bịa", () => {
  it("buildOfflineEvidenceReply khi catalog không có sản phẩm khớp thì nói thẳng chưa có trong catalog và không in giá/cân nặng tự tạo", () => {
    const emptyCatalogEvidence: SupportEvidence = {
      toolId: "catalog_search",
      status: "ok",
      source: { label: "Danh mục sản phẩm", observedAt: "2026-10-24T00:00:00Z" },
      unknown: ["Sản phẩm không có trong catalog ChillBanana"],
      links: [],
      known: {
        category: "fashion",
        matchCount: 0,
        inCatalog: false,
        products: [],
        marketplaceLinks: {
          amazon: "https://www.amazon.co.jp/s?k=test",
          mercari: "https://jp.mercari.com/search?keyword=test",
          rakuten: "https://search.rakuten.co.jp/search/mall/test",
        },
      },
    };

    const replyOmo = buildOfflineEvidenceReply("áo khoác Uniqlo", [emptyCatalogEvidence], true);
    expect(replyOmo).toContain("ChillBanana chưa có sản phẩm này trong catalog. Quý khách dán link sản phẩm từ sàn Nhật để được báo giá, hoặc dùng các đường dẫn tìm kiếm bên dưới.");
    expect(replyOmo).toContain("https://www.amazon.co.jp/s?k=test");
    expect(replyOmo).toContain("https://jp.mercari.com/search?keyword=test");
    expect(replyOmo).toContain("https://search.rakuten.co.jp/search/mall/test");

    // Tuyệt đối không in giá JPY, VND hay cân nặng tự bịa
    expect(replyOmo).not.toContain("Mẫu chọn lọc trên Amazon JP");
    expect(replyOmo).not.toContain("Săn đồ lướt/mới trên Mercari JP");
    expect(replyOmo).not.toContain("JPY (~");
    expect(replyOmo).not.toContain("kg)");
  });

  it("buildOfflineEvidenceReply khi có sản phẩm catalog thực tế thì hiển thị đầy đủ thông tin", () => {
    const matchedEvidence: SupportEvidence = {
      toolId: "catalog_search",
      status: "ok",
      source: { label: "Danh mục sản phẩm", observedAt: "2026-10-24T00:00:00Z" },
      unknown: [],
      links: [],
      known: {
        category: "electronics",
        matchCount: 1,
        inCatalog: true,
        products: [
          {
            name: "Nồi cơm Zojirushi NP-XB10",
            priceJpy: 15000,
            estimatedProductPriceVnd: 2550000,
            estimatedWeightKg: 4.2,
            voltageNote: "Chỉ dùng 100V",
            directSearchUrl: null,
            sourceMarketplace: "Catalog ChillBanana",
          },
        ],
      },
    };

    const reply = buildOfflineEvidenceReply("nồi cơm zojirushi", [matchedEvidence], false);
    expect(reply).toContain("Nồi cơm Zojirushi NP-XB10");
    expect(reply).toContain("15.000 JPY");
    expect(reply).toContain("2.550.000 đ");
    expect(reply).toContain("4.2 kg");
    expect(reply).toContain("Chỉ dùng 100V");
  });
});
