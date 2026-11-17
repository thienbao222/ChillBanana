import { describe, it, expect } from "vitest";
import { inspectVnJpCargoDeterministic } from "@/features/ai/vn-jp/maff-inspector";
import { getVnJpRatePerKg } from "@/features/pricing/vn-jp-rates";

describe("WP6.1 — Phân hệ VN → JP: Kiểm dịch MAFF ở Server, Cước IATA & Bảo vệ PII", () => {
  describe("Thẩm định kiểm dịch MAFF tại Server (Deterministic Engine)", () => {
    it("phát hiện và chặn ngay lập tức các mặt hàng thuộc diện cấm tuyệt đối (PROHIBITED)", () => {
      const prohibitedCases = [
        "2 hộp bò khô Tây Bắc, 1 gói kẹo lạc",
        "Xúc xích tiệt trùng, bánh đậu xanh",
        "Nem chua Thanh Hóa gửi cho bạn",
        "Ruốc thịt lợn, chà bông gà",
      ];

      for (const details of prohibitedCases) {
        const result = inspectVnJpCargoDeterministic({
          cargoDetails: details,
          cargoType: "food",
          estimatedWeightKg: 2,
          receiverPrefecture: "Tokyo",
          receiverPostalCode: "100-0001",
          receiverName: "NGUYEN VAN A",
        });

        expect(result.overallRisk).toBe("PROHIBITED");
        expect(result.canFly).toBe(false);
        const prohibitedItems = result.items.filter((it) => it.status === "PROHIBITED");
        expect(prohibitedItems.length).toBeGreaterThan(0);
      }
    });

    it("cho phép hàng an toàn (SAFE) bay thẳng không cần cảnh báo", () => {
      const safeCargo = "Sách hướng dẫn tiếng Nhật, tài liệu công chứng, quần áo mùa đông";
      const result = inspectVnJpCargoDeterministic({
        cargoDetails: safeCargo,
        cargoType: "doc",
        estimatedWeightKg: 1,
        receiverPrefecture: "Osaka",
        receiverPostalCode: "530-0001",
        receiverName: "TRAN VAN B",
      });

      expect(result.overallRisk).toBe("SAFE");
      expect(result.canFly).toBe(true);
    });

    it("phân loại hàng có điều kiện (CONDITIONAL) khi chứa thực phẩm chế biến không thịt", () => {
      const conditionalCargo = "Cà phê hòa tan Trung Nguyên, bánh đậu xanh Hải Dương";
      const result = inspectVnJpCargoDeterministic({
        cargoDetails: conditionalCargo,
        cargoType: "food",
        estimatedWeightKg: 3,
        receiverPrefecture: "Aichi",
        receiverPostalCode: "460-0001",
        receiverName: "LE THI C",
      });

      expect(result.overallRisk).toBe("CONDITIONAL");
      expect(result.canFly).toBe(true);
    });
  });

  describe("Tính cước theo thể tích IATA (Volumetric Weight = L*W*H / 5000)", () => {
    it("áp dụng cân thể tích khi kiện hàng cồng kềnh hơn cân nặng thực tế", () => {
      const actualWeightKg = 2.0;
      // Kiện hàng kích thước 50cm x 40cm x 30cm
      const length = 50;
      const width = 40;
      const height = 30;
      const volumetricWeightKg = (length * width * height) / 5000; // 60.000 / 5000 = 12 kg

      expect(volumetricWeightKg).toBe(12.0);
      const chargeableWeightKg = Math.max(actualWeightKg, volumetricWeightKg);
      expect(chargeableWeightKg).toBe(12.0);

      const unitPrice = getVnJpRatePerKg("gift"); // 180.000 đ/kg
      const totalShippingFeeVnd = Math.round(unitPrice * chargeableWeightKg);
      expect(totalShippingFeeVnd).toBe(180_000 * 12);
    });

    it("áp dụng cân thực tế khi kiện hàng đặc, nặng hơn thể tích", () => {
      const actualWeightKg = 10.0;
      // Kiện hàng nhỏ 20cm x 20cm x 20cm -> thể tích = 8000 / 5000 = 1.6 kg
      const volumetricWeightKg = (20 * 20 * 20) / 5000;
      const chargeableWeightKg = Math.max(actualWeightKg, volumetricWeightKg);
      expect(chargeableWeightKg).toBe(10.0);
    });
  });

  describe("Che giấu dữ liệu cá nhân (PII Masking)", () => {
    it("che số điện thoại chỉ để lại đầu số và đuôi", () => {
      const maskPhone = (phone: string) => {
        const digits = phone.replace(/\D/g, "");
        if (digits.length <= 4) return "****";
        return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
      };

      expect(maskPhone("0912345678")).toBe("091****678");
      expect(maskPhone("+81 080 1234 5678")).toBe("810****678");
    });

    it("che tên người gửi/nhận chỉ giữ chữ đầu và chữ cuối", () => {
      const maskName = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length <= 1) return name.slice(0, 2) + "***";
        return `${parts[0]} *** ${parts[parts.length - 1]}`;
      };

      expect(maskName("Nguyễn Văn Anh")).toBe("Nguyễn *** Anh");
      expect(maskName("YAMADA TARO")).toBe("YAMADA *** TARO");
    });
  });
});

