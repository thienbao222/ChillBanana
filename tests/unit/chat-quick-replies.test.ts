import { describe, it, expect } from "vitest";
import { generateQuickReplies, type ProductCardData } from "@/features/ai/customer/support-tools";
import type { SupportEvidence } from "@/features/ai/customer/support-policy";

describe("Deterministic Quick Replies (Gợi ý trả lời nhanh)", () => {
  it("trả về tối đa 3 câu gợi ý ngắn khi có thẻ sản phẩm gia dụng/gadgets", () => {
    const cards: ProductCardData[] = [
      {
        id: "prod-1",
        name: "Nồi cơm điện Zojirushi NP-ZX05",
        priceJpy: 22000,
        priceVnd: 3800000,
        inStock: true,
        category: "gadgets",
      },
    ];

    const replies = generateQuickReplies({ productCards: cards });
    expect(replies.length).toBeLessThanOrEqual(3);
    expect(replies.length).toBeGreaterThan(0);
    expect(replies).toContain("Tính tổng chi phí về VN");
    expect(replies).toContain("Món này dùng điện Việt Nam được không?");
    expect(replies).toContain("Xem sản phẩm tương tự");
  });

  it("trả về tối đa 3 câu gợi ý ngắn khi có thẻ sản phẩm mỹ phẩm", () => {
    const cards: ProductCardData[] = [
      {
        id: "prod-2",
        name: "Kem chống nắng Anessa Perfect UV Sunscreen",
        priceJpy: 3000,
        priceVnd: 516000,
        inStock: true,
        category: "cosmetics",
      },
    ];

    const replies = generateQuickReplies({ productCards: cards });
    expect(replies.length).toBeLessThanOrEqual(3);
    expect(replies).toContain("Tính tổng chi phí về VN");
    expect(replies).toContain("Tư vấn cách sử dụng món này");
    expect(replies).toContain("Xem sản phẩm tương tự");
  });

  it("gợi ý phù hợp khi catalog đã tìm nhưng không có sản phẩm (resultCount = 0)", () => {
    const evidence: SupportEvidence[] = [
      {
        toolId: "catalog_search",
        status: "ok",
        source: { label: "Catalog", observedAt: new Date().toISOString() },
        known: {
          searched: true,
          resultCount: 0,
        },
        unknown: [],
        links: [],
      },
    ];

    const replies = generateQuickReplies({ evidence, productCards: [] });
    expect(replies.length).toBeLessThanOrEqual(3);
    expect(replies).toContain("Báo giá hàng ngoài catalog");
    expect(replies).toContain("Gửi link sản phẩm để báo giá");
  });

  it("gợi ý tra cứu tiến độ / chính sách khi có bằng chứng tra cứu đơn hàng hoặc vận chuyển", () => {
    const evidence: SupportEvidence[] = [
      {
        toolId: "order_status",
        status: "ok",
        source: { label: "Order", observedAt: new Date().toISOString() },
        known: {
          code: "CB-2026-TEST-0001",
          status: "IN_TRANSIT_AIR",
        },
        unknown: [],
        links: [],
      },
    ];

    const replies = generateQuickReplies({ evidence });
    expect(replies.length).toBeLessThanOrEqual(3);
    expect(replies).toContain("Thời gian giao hàng dự kiến");
    expect(replies).toContain("Phí mua hộ tính thế nào?");
  });

  it("trả về danh sách mặc định không rỗng khi chưa có thẻ sản phẩm hay bằng chứng đặc biệt", () => {
    const replies = generateQuickReplies({});
    expect(replies.length).toBeLessThanOrEqual(3);
    expect(replies.length).toBeGreaterThan(0);
    expect(replies[0]).toBeTruthy();
  });
});
