import { describe, expect, it } from "vitest";
import { MIN_ORDER_THRESHOLD_VND, ORDER_STATUS_FLOW, isNextOrderStatus } from "@/features/orders/policy";
import {
  getDepositAmount,
  getRecordedPaymentStatus,
  isRecordedPaymentStatus,
  parseDepositPercent,
} from "@/features/payments/policy";

describe("quy trình trạng thái đơn", () => {
  it("chỉ cho phép sang đúng bước kế tiếp", () => {
    for (let i = 0; i < ORDER_STATUS_FLOW.length - 1; i++) {
      expect(isNextOrderStatus(ORDER_STATUS_FLOW[i], ORDER_STATUS_FLOW[i + 1])).toBe(true);
    }
  });

  it("không cho nhảy cóc, lùi hoặc giữ nguyên", () => {
    expect(isNextOrderStatus("PENDING_DEPOSIT", "WAREHOUSE_JP")).toBe(false);
    expect(isNextOrderStatus("WAREHOUSE_JP", "PURCHASING_JP")).toBe(false);
    expect(isNextOrderStatus("PENDING_DEPOSIT", "PENDING_DEPOSIT")).toBe(false);
  });

  it("trạng thái cuối và trạng thái lạ không có bước tiếp theo", () => {
    expect(isNextOrderStatus("COMPLETED", "PENDING_DEPOSIT")).toBe(false);
    expect(isNextOrderStatus("CANCELLED", "PURCHASING_JP")).toBe(false);
    expect(isNextOrderStatus("RAC", "PURCHASING_JP")).toBe(false);
  });

  it("ngưỡng đơn tối thiểu là 300.000đ", () => {
    expect(MIN_ORDER_THRESHOLD_VND).toBe(300_000);
  });
});

describe("chính sách đặt cọc", () => {
  it("chỉ nhận 50 hoặc 100", () => {
    expect(parseDepositPercent(50)).toBe(50);
    expect(parseDepositPercent(100)).toBe(100);
    for (const bad of [0, 30, 99, "50", null, undefined, NaN]) expect(parseDepositPercent(bad)).toBeNull();
  });

  it("tính số tiền cọc", () => {
    expect(getDepositAmount(1_060_800, 50)).toBe(530_400);
    expect(getDepositAmount(1_060_800, 100)).toBe(1_060_800);
    expect(getDepositAmount(1_001, 50)).toBe(501); // làm tròn
  });

  it("từ chối số tiền gốc không hợp lệ", () => {
    for (const bad of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => getDepositAmount(bad, 50)).toThrow();
    }
  });

  it("ánh xạ phần trăm cọc sang trạng thái thanh toán", () => {
    expect(getRecordedPaymentStatus(50)).toBe("DEPOSITED_50");
    expect(getRecordedPaymentStatus(100)).toBe("PAID_100");
    expect(isRecordedPaymentStatus("PAID_100")).toBe(true);
    expect(isRecordedPaymentStatus("REFUNDED")).toBe(false);
  });
});
