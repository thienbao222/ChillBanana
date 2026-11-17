import { describe, expect, it } from "vitest";
import { calculateOrderPrice, DEFAULT_PRICING_CONFIG } from "@/features/pricing/calculator";
import { resolveOrderFulfillmentOrigin } from "@/features/orders/policy";
import fs from "node:fs";
import path from "node:path";

describe("WP1.1: Quy tắc fulfillmentOrigin và tính cước vận chuyển", () => {
  it("(a) resolveOrderFulfillmentOrigin: Server tự quyết origin, có sản phẩm ngoài VN luôn là JP", () => {
    // Client gửi gì cũng bị bỏ qua: nếu có mặt hàng ngoài VN thì bắt buộc là JP
    expect(resolveOrderFulfillmentOrigin(true, 1)).toBe("JP");
    expect(resolveOrderFulfillmentOrigin(true, 5)).toBe("JP");
    expect(resolveOrderFulfillmentOrigin(false, 0)).toBe("JP"); // không có sản phẩm
    expect(resolveOrderFulfillmentOrigin(false, 2)).toBe("VN"); // toàn bộ là hàng kho VN
  });

  it("(b) calculateOrderPrice với fulfillmentOrigin='VN' luôn miễn cước bay quốc tế dù có cân nặng", () => {
    const priceVn = calculateOrderPrice(
      10_000,
      1.5,
      170,
      false,
      DEFAULT_PRICING_CONFIG,
      "VN"
    );
    expect(priceVn.shippingFeeVnd).toBe(0);
    expect(priceVn.totalVnd).toBe(priceVn.baseOrderCostVnd);
  });

  it("(c) calculateOrderPrice với fulfillmentOrigin='JP' tính cước bay quốc tế theo cân nặng", () => {
    const priceJp = calculateOrderPrice(
      10_000,
      1.5,
      170,
      false,
      DEFAULT_PRICING_CONFIG,
      "JP"
    );
    expect(priceJp.shippingFeeVnd).toBeGreaterThan(0);
    expect(priceJp.shippingFeeVnd).toBe(Math.round(1.5 * DEFAULT_PRICING_CONFIG.airShippingPerKgVnd));
  });

  it("(d) Đơn origin VN khi admin cập nhật cân nặng không bị tính cước bay quốc tế", () => {
    const existingOrder = {
      priceJpy: 5_000,
      exchangeRate: 170,
      isGroupBuy: false,
      fulfillmentOrigin: "VN",
    };
    const parsedWeightKg = 2.0;

    const recalc = calculateOrderPrice(
      existingOrder.priceJpy,
      parsedWeightKg,
      existingOrder.exchangeRate,
      existingOrder.isGroupBuy,
      DEFAULT_PRICING_CONFIG,
      existingOrder.fulfillmentOrigin
    );

    expect(recalc.shippingFeeVnd).toBe(0);
  });

  it("(e) Đơn origin JP khi duyệt giá vẫn tính cước bay theo cân nặng", () => {
    const existingOrder = {
      exchangeRate: 170,
      isGroupBuy: false,
      fulfillmentOrigin: "JP",
    };
    const finalPriceJpy = 8_000;
    const finalWeightKg = 0.8;

    const finalPrice = calculateOrderPrice(
      finalPriceJpy,
      finalWeightKg,
      existingOrder.exchangeRate,
      existingOrder.isGroupBuy,
      DEFAULT_PRICING_CONFIG,
      existingOrder.fulfillmentOrigin
    );

    expect(finalPrice.shippingFeeVnd).toBeGreaterThan(0);
    expect(finalPrice.shippingFeeVnd).toBe(Math.round(0.8 * DEFAULT_PRICING_CONFIG.airShippingPerKgVnd));
  });

  it("Mọi lời gọi calculateOrderPrice trong orders/[id]/route.ts đều phải truyền existingOrder.fulfillmentOrigin", () => {
    const routeFile = path.resolve(__dirname, "../../src/app/api/orders/[id]/route.ts");
    const content = fs.readFileSync(routeFile, "utf-8");

    // Lọc các lời gọi calculateOrderPrice trong file (ngoại trừ import)
    const lines = content.split("\n");
    const callLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("calculateOrderPrice(") && !lines[i].includes("import")) {
        // gom các dòng của lời gọi này
        let callSnippet = lines[i];
        let j = i;
        while (!callSnippet.includes(")") && j < lines.length - 1) {
          j++;
          callSnippet += " " + lines[j];
        }
        callLines.push(callSnippet);
      }
    }

    expect(callLines.length).toBeGreaterThanOrEqual(2);
    for (const call of callLines) {
      expect(call).toContain("existingOrder.fulfillmentOrigin");
    }
  });

  it("orders/route.ts không còn sử dụng body.fulfillmentOrigin để quyết định nguồn hàng", () => {
    const routeFile = path.resolve(__dirname, "../../src/app/api/orders/route.ts");
    const content = fs.readFileSync(routeFile, "utf-8");
    expect(content).not.toContain('body.fulfillmentOrigin === "VN"');
    expect(content).not.toContain("body.fulfillmentOrigin === 'VN'");
  });
});
