import { describe, it, expect } from "vitest";
import {
  allocateBatchFreight,
  BatchItemWeight,
} from "@/features/campaigns/freight-allocation";

describe("WP5.2 — Phân bổ cước lô theo cân & Bất biến tài chính", () => {
  describe("Thuật toán allocateBatchFreight", () => {
    it("phân bổ cước chính xác theo tỷ lệ trọng lượng khi chia chẵn", () => {
      const items: BatchItemWeight[] = [
        { orderId: "ord-1", orderCode: "CB-001", weightKg: 1.0 },
        { orderId: "ord-2", orderCode: "CB-002", weightKg: 2.0 },
        { orderId: "ord-3", orderCode: "CB-003", weightKg: 3.0 },
      ];
      const totalFreightVnd = 600_000;

      const results = allocateBatchFreight(items, totalFreightVnd);
      expect(results).toHaveLength(3);

      expect(results[0].allocatedFreightVnd).toBe(100_000);
      expect(results[1].allocatedFreightVnd).toBe(200_000);
      expect(results[2].allocatedFreightVnd).toBe(300_000);

      const sum = results.reduce((acc, r) => acc + r.allocatedFreightVnd, 0);
      expect(sum).toBe(totalFreightVnd);
    });

    it("BẤT BIẾN TOÁN HỌC: Tổng cước phân bổ BẰNG ĐÚNG 100% tổng cước thực tế khi có số dư làm tròn", () => {
      // 3 kiện cân nặng 0.33kg, 0.33kg, 0.34kg. Tổng cước lẻ 500.000 đ
      const items: BatchItemWeight[] = [
        { orderId: "ord-1", orderCode: "CB-001", weightKg: 0.33 },
        { orderId: "ord-2", orderCode: "CB-002", weightKg: 0.33 },
        { orderId: "ord-3", orderCode: "CB-003", weightKg: 0.34 },
      ];
      const totalFreightVnd = 500_000;

      const results = allocateBatchFreight(items, totalFreightVnd);

      // Mọi phần tử đều là số nguyên an toàn
      for (const res of results) {
        expect(Number.isSafeInteger(res.allocatedFreightVnd)).toBe(true);
      }

      // Tổng phân bổ phải bằng đúng 500.000 đ (sai số 0 đồng)
      const sum = results.reduce((acc, r) => acc + r.allocatedFreightVnd, 0);
      expect(sum).toBe(500_000);

      // Kiện có cân nặng lớn nhất (ord-3 với 0.34kg) nhận phần dư bù làm tròn
      expect(results[2].weightKg).toBe(0.34);
      expect(results[2].allocatedFreightVnd).toBeGreaterThan(results[0].allocatedFreightVnd);
    });

    it("xử lý trường hợp tất cả kiện có cân nặng = 0 (chia đều)", () => {
      const items: BatchItemWeight[] = [
        { orderId: "ord-1", orderCode: "CB-001", weightKg: 0 },
        { orderId: "ord-2", orderCode: "CB-002", weightKg: 0 },
      ];
      const totalFreightVnd = 150_000;

      const results = allocateBatchFreight(items, totalFreightVnd);
      expect(results).toHaveLength(2);
      const sum = results.reduce((acc, r) => acc + r.allocatedFreightVnd, 0);
      expect(sum).toBe(150_000);
      expect(results[0].allocatedFreightVnd).toBe(75_000);
      expect(results[1].allocatedFreightVnd).toBe(75_000);
    });
  });
});

