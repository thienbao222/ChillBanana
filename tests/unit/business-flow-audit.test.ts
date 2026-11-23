import { describe, it, expect } from "vitest";
import {
  calculateDepositV2,
  checkWeightTolerance,
  calculateWarehouseVnBalance,
  isDepositPaid,
  getPaymentStatusLabelVi,
} from "@/features/payments/policy";
import {
  calculateOrderPrice,
  DEFAULT_PRICING_CONFIG,
  SERVICE_FEE_MINIMUM_VND,
} from "@/features/pricing/calculator";
import { estimateMargin } from "@/features/pricing/unit-economics";
import {
  isNextOrderStatus,
  getPreviousOrderStatus,
} from "@/features/orders/policy";
import { quarantineAgent } from "@/features/ai-workspace/agents/quarantine-agent";
import { financialAuditAgent } from "@/features/ai-workspace/agents/financial-audit-agent";
import { executiveAssistantAgent } from "@/features/ai-workspace/agents/executive-assistant-agent";
import { purchasingAgent } from "@/features/ai-workspace/agents/purchasing-agent";
import { isPrivateHost } from "@/lib/ssrf";

describe("PROBE 1: Định giá & Chính sách Cọc 3 bậc & Sàn phí 80k", () => {
  it("Sàn phí mua hộ tối thiểu phải bằng chính xác 80.000 đ", () => {
    expect(SERVICE_FEE_MINIMUM_VND).toBe(80_000);
  });

  it("Đơn hàng siêu nhỏ (1.000 JPY ~ 170k) áp sàn phí 80.000 đ và số tiền VND là số nguyên", () => {
    const calc = calculateOrderPrice(1000, 0.5, 170, false, DEFAULT_PRICING_CONFIG);
    expect(calc.productPriceVnd).toBe(170_000);
    expect(calc.serviceFeeVnd).toBe(80_000); // 4% của 170k là 6.8k < 80k -> áp sàn 80k
    expect(Number.isInteger(calc.totalVnd)).toBe(true);
    expect(Number.isInteger(calc.baseOrderCostVnd)).toBe(true);
  });

  it("Đơn 300.000 đ (ngưỡng tối thiểu): Biên lợi nhuận đóng góp Unit Economics được bảo vệ", () => {
    // Giá 1.500 JPY ~ 255k + phí 80k = 335k baseOrderCost
    const margin = estimateMargin({
      priceJpy: 1500,
      weightKg: 0.3,
      exchangeRate: 170,
      fulfillmentOrigin: "JP",
    });
    // Doanh thu: phí 80k + cước bay thu khách. Chi phí: kho Tokyo 300 JPY (~51k), ship VN 35k, phí thanh toán & tỷ giá ~10k
    expect(margin.serviceFeeVnd).toBe(80_000);
    expect(margin.totalVnd).toBeGreaterThanOrEqual(300_000);
  });

  it("Bậc cọc 1 (< 1.000.000 đ): Bắt buộc cọc 100%", () => {
    const res999k = calculateDepositV2(999_999);
    expect(res999k.tier).toBe("LOW");
    expect(res999k.depositPercent).toBe(100);
    expect(res999k.depositAmountVnd).toBe(999_999);

    const res500k = calculateDepositV2(500_000);
    expect(res500k.tier).toBe("LOW");
    expect(res500k.depositPercent).toBe(100);
    expect(res500k.depositAmountVnd).toBe(500_000);
  });

  it("Bậc cọc 2 (1.000.000 đ - 10.000.000 đ): Cọc 70%", () => {
    const res1M = calculateDepositV2(1_000_000);
    expect(res1M.tier).toBe("STANDARD");
    expect(res1M.depositPercent).toBe(70);
    expect(res1M.depositAmountVnd).toBe(700_000);

    const res5M = calculateDepositV2(5_000_000);
    expect(res5M.tier).toBe("STANDARD");
    expect(res5M.depositPercent).toBe(70);
    expect(res5M.depositAmountVnd).toBe(3_500_000);

    const res10M = calculateDepositV2(10_000_000);
    expect(res10M.tier).toBe("STANDARD");
    expect(res10M.depositPercent).toBe(70);
    expect(res10M.depositAmountVnd).toBe(7_000_000);
  });

  it("Bậc cọc 3 (> 10.000.000 đ): Cho phép cọc 50%", () => {
    const res10M001 = calculateDepositV2(10_000_001);
    expect(res10M001.tier).toBe("HIGH");
    expect(res10M001.depositPercent).toBe(50);
    expect(res10M001.depositAmountVnd).toBe(Math.round(10_000_001 * 0.5));

    const res20M = calculateDepositV2(20_000_000);
    expect(res20M.tier).toBe("HIGH");
    expect(res20M.depositPercent).toBe(50);
    expect(res20M.depositAmountVnd).toBe(10_000_000);
  });
});

describe("PROBE 2: Dung sai cân nặng tại kho Tokyo (Weight Tolerance)", () => {
  it("Thực tế nhẹ hơn hoặc bằng ước tính: Luôn được chấp nhận miễn phí", () => {
    const res = checkWeightTolerance(1.0, 0.95);
    expect(res.withinTolerance).toBe(true);
    expect(res.weightDiffKg).toBe(-0.05);
  });

  it("Thực tế nặng hơn trong mức dung sai ≤ 50g: Chấp nhận miễn phí", () => {
    const res = checkWeightTolerance(0.5, 0.54); // Lệch 40g (< 50g)
    expect(res.withinTolerance).toBe(true);
  });

  it("Thực tế nặng hơn trong mức dung sai ≤ 5% cho kiện lớn: Chấp nhận miễn phí", () => {
    const res = checkWeightTolerance(5.0, 5.2); // 5.0kg, 5% là 250g. Lệch 200g -> trong ngưỡng
    expect(res.withinTolerance).toBe(true);
  });

  it("Thực tế nặng hơn vượt cả 50g và 5%: Báo vượt dung sai để tính thêm cước", () => {
    const res = checkWeightTolerance(1.0, 1.15); // Lệch 150g (> 50g và > 50g/5%)
    expect(res.withinTolerance).toBe(false);
  });
});

describe("PROBE 3: Luồng thu số dư đợt 2 (Balance Settlement at WAREHOUSE_VN)", () => {
  it("Đơn đã cọc 70% khi về kho VN: Tính chính xác số dư còn thiếu 30% và actionNeeded = COLLECT_BALANCE", () => {
    const res = calculateWarehouseVnBalance({
      totalVnd: 1_200_000,
      paidAmountVnd: 700_000, // Đã cọc 700k
    });
    expect(res.isFullySettled).toBe(false);
    expect(res.remainingGoodsBalanceVnd).toBe(500_000);
    expect(res.totalRemainingVnd).toBe(500_000);
    expect(res.actionNeeded).toBe("COLLECT_BALANCE");
  });

  it("Đơn đã cọc 100%: Tại kho VN số dư bằng 0, actionNeeded = NONE và isFullySettled = true", () => {
    const res = calculateWarehouseVnBalance({
      totalVnd: 1_200_000,
      paidAmountVnd: 1_200_000,
    });
    expect(res.isFullySettled).toBe(true);
    expect(res.totalRemainingVnd).toBe(0);
    expect(res.actionNeeded).toBe("NONE");
  });

  it("Khách nộp dư (do điều chỉnh giảm giá): Hệ thống nhận diện REFUND", () => {
    const res = calculateWarehouseVnBalance({
      totalVnd: 900_000,
      paidAmountVnd: 1_000_000,
    });
    expect(res.actionNeeded).toBe("REFUND");
    expect(res.balanceVnd).toBe(-100_000);
  });
});

describe("PROBE 4: Máy trạng thái đơn hàng (Order State Machine)", () => {
  it("Đơn hàng Nhật Bản (JP): Tuân thủ chặt chẽ 7 bước tuần tự", () => {
    expect(isNextOrderStatus("PENDING_DEPOSIT", "PURCHASING_JP", "JP")).toBe(true);
    expect(isNextOrderStatus("PURCHASING_JP", "WAREHOUSE_JP", "JP")).toBe(true);
    expect(isNextOrderStatus("WAREHOUSE_JP", "IN_TRANSIT_AIR", "JP")).toBe(true);
    expect(isNextOrderStatus("IN_TRANSIT_AIR", "WAREHOUSE_VN", "JP")).toBe(true);
    expect(isNextOrderStatus("WAREHOUSE_VN", "LOCAL_DELIVERY", "JP")).toBe(true);
    expect(isNextOrderStatus("LOCAL_DELIVERY", "COMPLETED", "JP")).toBe(true);

    // Chặn nhảy cóc
    expect(isNextOrderStatus("PENDING_DEPOSIT", "WAREHOUSE_VN", "JP")).toBe(false);
    expect(isNextOrderStatus("PURCHASING_JP", "LOCAL_DELIVERY", "JP")).toBe(false);
    expect(isNextOrderStatus("WAREHOUSE_JP", "COMPLETED", "JP")).toBe(false);
  });

  it("Đơn hàng nguồn gốc Việt Nam (VN): Bỏ qua bước quốc tế, đi thẳng từ PENDING_DEPOSIT sang WAREHOUSE_VN", () => {
    expect(isNextOrderStatus("PENDING_DEPOSIT", "WAREHOUSE_VN", "VN")).toBe(true);
    expect(isNextOrderStatus("WAREHOUSE_VN", "LOCAL_DELIVERY", "VN")).toBe(true);
    expect(isNextOrderStatus("LOCAL_DELIVERY", "COMPLETED", "VN")).toBe(true);

    // Hàng VN không đi qua Tokyo
    expect(isNextOrderStatus("PENDING_DEPOSIT", "PURCHASING_JP", "VN")).toBe(false);
    expect(isNextOrderStatus("PENDING_DEPOSIT", "WAREHOUSE_JP", "VN")).toBe(false);
  });

  it("Quy tắc Rollback lùi bước: Tính đúng trạng thái trước đó", () => {
    expect(getPreviousOrderStatus("COMPLETED", "JP")).toBe("LOCAL_DELIVERY");
    expect(getPreviousOrderStatus("LOCAL_DELIVERY", "JP")).toBe("WAREHOUSE_VN");
    expect(getPreviousOrderStatus("WAREHOUSE_VN", "JP")).toBe("IN_TRANSIT_AIR");
    expect(getPreviousOrderStatus("IN_TRANSIT_AIR", "JP")).toBe("WAREHOUSE_JP");
    expect(getPreviousOrderStatus("WAREHOUSE_JP", "JP")).toBe("PURCHASING_JP");
    expect(getPreviousOrderStatus("PURCHASING_JP", "JP")).toBe("PENDING_DEPOSIT");

    // Với hàng VN
    expect(getPreviousOrderStatus("WAREHOUSE_VN", "VN")).toBe("PENDING_DEPOSIT");
  });
});

describe("PROBE 5: AI Agent Workspace Logic & Security", () => {
  it("Quarantine Agent: Nhận diện chính xác hàng an toàn (Quần áo)", () => {
    const result = quarantineAgent.screenTextCompliance("Áo thun Uniqlo cotton 100% size M màu trắng");
    expect(result.riskLevel).toBe("SAFE");
    expect(result.isCompliant).toBe(true);
    expect(result.iataStatus.isIataDangerousGoods).toBe(false);
    expect(result.maffStatus.isMaffProhibited).toBe(false);
    expect(result.maffStatus.flaggedKeywords.length).toBe(0);
  });

  it("Quarantine Agent: Nhận diện và gắn cờ cảnh báo hàng cấm bay IATA (Pin sạc lithium, bình xịt)", () => {
    const result = quarantineAgent.screenTextCompliance(
      "Pin sạc dự phòng Anker 20000mAh Lithium Ion và bình xịt khoáng dạng nén"
    );
    expect(result.riskLevel).toBe("PROHIBITED");
    expect(result.isCompliant).toBe(false);
    expect(result.iataStatus.isIataDangerousGoods).toBe(true);
    expect(result.iataStatus.batteryDetected).toBe(true);
    expect(result.iataStatus.pressureDetected).toBe(true);
  });

  it("Quarantine Agent: Nhận diện hàng vi phạm kiểm dịch thực phẩm MAFF (Thịt bò Kobe, khô gà)", () => {
    const result = quarantineAgent.screenTextCompliance("Thịt bò Wagyu tươi hút chân không và ruốc heo khô");
    expect(result.riskLevel).toBe("PROHIBITED");
    expect(result.isCompliant).toBe(false);
    expect(result.maffStatus.isMaffProhibited).toBe(true);
    expect(result.maffStatus.regulationsViolated.length).toBeGreaterThan(0);
  });

  it("Financial Audit Agent: Tính toán tỷ lệ cọc 3 bậc chính xác và phát hiện vi phạm", () => {
    // Đơn 5 triệu: Bậc STANDARD yêu cầu 70% (3.500.000 đ)
    const validAudit = financialAuditAgent.verifyDepositTier(5_000_000, 3_500_000);
    expect(validAudit.isCompliant).toBe(true);
    expect(validAudit.depositTier).toBe("STANDARD");
    expect(validAudit.expectedDepositPercent).toBe(70);
    expect(validAudit.expectedDepositVnd).toBe(3_500_000);

    // Khách chỉ cọc 50% (2.500.000 đ) trên đơn 5 triệu -> Vi phạm
    const invalidAudit = financialAuditAgent.verifyDepositTier(5_000_000, 2_500_000);
    expect(invalidAudit.isCompliant).toBe(false);
    expect(invalidAudit.differenceVnd).toBe(1_000_000);
  });

  it("Executive Assistant Agent: Khởi tạo và tạo báo cáo Scorecard chứa đầy đủ các khâu chuỗi cung ứng", async () => {
    const scorecard = await executiveAssistantAgent.generateOperationsScorecard();
    expect(scorecard).toBeDefined();
    expect(typeof scorecard.throughputScore).toBe("number");
    expect(scorecard.pipelineCounts).toBeDefined();
    expect(typeof scorecard.pipelineCounts.pendingDeposit).toBe("number");
    expect(typeof scorecard.pipelineCounts.warehouseJp).toBe("number");
    expect(typeof scorecard.pipelineCounts.warehouseVn).toBe("number");
    expect(Array.isArray(scorecard.bottlenecks)).toBe(true);
  });
});

describe("PROBE 6: An ninh Mạng & AppSec Safeguards", () => {
  it("SSRF Protection: isPrivateHost chặn đứng 100% các dải IP nội bộ và cloud metadata", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("169.254.169.254")).toBe(true); // AWS / Cloud metadata
    expect(isPrivateHost("::1")).toBe(true);

    // Tên miền hợp lệ
    expect(isPrivateHost("amazon.co.jp")).toBe(false);
    expect(isPrivateHost("rakuten.co.jp")).toBe(false);
    expect(isPrivateHost("mercari.com")).toBe(false);
  });
});
