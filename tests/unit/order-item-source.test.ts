import { describe, expect, it } from "vitest";
import { inferMarketplaceFromUrl, parseOrderItemSource } from "@/features/orders/item-source";

describe("inferMarketplaceFromUrl", () => {
  it("identifies Amazon JP", () => {
    expect(inferMarketplaceFromUrl("https://www.amazon.co.jp/dp/B08XYZ")).toBe("Amazon JP");
    expect(inferMarketplaceFromUrl("https://amazon.jp/product/123")).toBe("Amazon JP");
  });

  it("identifies Mercari", () => {
    expect(inferMarketplaceFromUrl("https://jp.mercari.com/item/m123456789")).toBe("Mercari");
  });

  it("identifies Rakuten", () => {
    expect(inferMarketplaceFromUrl("https://item.rakuten.co.jp/shop/item1/")).toBe("Rakuten");
  });

  it("identifies Yahoo!", () => {
    expect(inferMarketplaceFromUrl("https://shopping.yahoo.co.jp/products/123")).toBe("Yahoo!");
    expect(inferMarketplaceFromUrl("https://page.auctions.yahoo.co.jp/jp/auction/abc")).toBe("Yahoo!");
  });

  it("identifies Uniqlo", () => {
    expect(inferMarketplaceFromUrl("https://www.uniqlo.com/jp/ja/products/E456789")).toBe("Uniqlo");
  });

  it("identifies Surugaya", () => {
    expect(inferMarketplaceFromUrl("https://www.suruga-ya.jp/product/detail/12345")).toBe("Surugaya");
  });

  it("identifies Bic Camera", () => {
    expect(inferMarketplaceFromUrl("https://www.biccamera.com/bc/item/12345/")).toBe("Bic Camera");
  });

  it("identifies Yodobashi", () => {
    expect(inferMarketplaceFromUrl("https://www.yodobashi.com/product/100000/")).toBe("Yodobashi");
  });

  it("falls back to Sàn khác for unknown domain or invalid url", () => {
    expect(inferMarketplaceFromUrl("https://unknown-shop.jp/product/1")).toBe("Sàn khác");
    expect(inferMarketplaceFromUrl(null)).toBe("Sàn khác");
    expect(inferMarketplaceFromUrl("invalid-url")).toBe("Sàn khác");
  });
});

describe("parseOrderItemSource", () => {
  it("parses EXTERNAL item with link at the end of productName", () => {
    const item = {
      itemType: "EXTERNAL",
      productName: "Nồi cơm điện Zojirushi [https://www.amazon.co.jp/dp/B08XYZ]",
    };
    const parsed = parseOrderItemSource(item);
    expect(parsed.cleanName).toBe("Nồi cơm điện Zojirushi");
    expect(parsed.url).toBe("https://www.amazon.co.jp/dp/B08XYZ");
    expect(parsed.marketplace).toBe("Amazon JP");
    expect(parsed.hasUrl).toBe(true);
    expect(parsed.itemType).toBe("EXTERNAL");
  });

  it("parses EXTERNAL item using order.originalUrl as fallback when no link in productName", () => {
    const item = {
      itemType: "EXTERNAL",
      productName: "Mô hình Luffy Gear 5",
    };
    const order = {
      originalUrl: "https://jp.mercari.com/item/m99999",
    };
    const parsed = parseOrderItemSource(item, order);
    expect(parsed.cleanName).toBe("Mô hình Luffy Gear 5");
    expect(parsed.url).toBe("https://jp.mercari.com/item/m99999");
    expect(parsed.marketplace).toBe("Mercari");
    expect(parsed.hasUrl).toBe(true);
    expect(parsed.itemType).toBe("EXTERNAL");
  });

  it("parses EXTERNAL item without any link", () => {
    const item = {
      itemType: "EXTERNAL",
      productName: "Áo khoác gió Tokyo",
    };
    const parsed = parseOrderItemSource(item, {});
    expect(parsed.cleanName).toBe("Áo khoác gió Tokyo");
    expect(parsed.url).toBeNull();
    expect(parsed.marketplace).toBe("Sàn khác");
    expect(parsed.hasUrl).toBe(false);
  });

  it("parses CATALOG item returning name, imageUrl, and originalStore without link", () => {
    const item = {
      itemType: "CATALOG",
      productName: "Tảo biển Spirulina Nhật Bản 2200 viên",
      product: {
        name: "Tảo biển Spirulina Nhật Bản 2200 viên",
        imageUrl: "https://example.com/spirulina.jpg",
        originalStore: "Don Quijote",
      },
    };
    const parsed = parseOrderItemSource(item);
    expect(parsed.cleanName).toBe("Tảo biển Spirulina Nhật Bản 2200 viên");
    expect(parsed.imageUrl).toBe("https://example.com/spirulina.jpg");
    expect(parsed.originalStore).toBe("Don Quijote");
    expect(parsed.url).toBeNull();
    expect(parsed.hasUrl).toBe(false);
    expect(parsed.itemType).toBe("CATALOG");
  });
});
