import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  purchasingAgent,
  quarantineAgent,
  financialAuditAgent,
  executiveAssistantAgent,
  agentOrchestrator,
} from "@/features/ai-workspace";
import { prisma } from "@/lib/prisma";
import * as auditModule from "@/lib/audit";

// Mock prisma and audit
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    purchaseTask: {
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentTransaction: {
      create: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((ops) => (Array.isArray(ops) ? Promise.all(ops) : ops(prisma))),
  },
}));

describe("R4: Agentic AI Workspace — Bộ Kiểm Thử 4 AI Agent Chuyên Trách & Orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. KIỂM THỬ KHỞI TẠO & CẤU HÌNH BIỆT ĐỘI 4 AI AGENT
  // =========================================================================
  describe("1. Khởi tạo & Cấu hình 4 Tác tử Thông minh", () => {
    it("Biệt đội phải gồm đúng 4 Agent chuyên trách với mã định danh actor chuẩn", () => {
      const roster = agentOrchestrator.getAgentRoster();
      expect(roster).toHaveLength(4);

      const ids = roster.map((a) => a.id);
      expect(ids).toContain("agent:purchasing");
      expect(ids).toContain("agent:quarantine");
      expect(ids).toContain("agent:financial_audit");
      expect(ids).toContain("agent:executive_assistant");

      for (const agent of roster) {
        expect(agent.status).toBe("ONLINE");
        expect(agent.successRate).toBeGreaterThanOrEqual(95);
        expect(agent.specialties.length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // 2. KIỂM THỬ AGENT KIỂM DỊCH & AN NINH HÀNG KHÔNG (QuarantineComplianceAgent)
  // =========================================================================
  describe("2. Agent Kiểm Dịch MAFF & An Ninh Hàng Không IATA", () => {
    it("phải phát hiện cấm tuyệt đối các sản phẩm từ thịt gia súc, gia cầm theo MAFF Nhật Bản", () => {
      const prohibitedPork = quarantineAgent.screenTextCompliance("1 hộp bánh pía và 500g ruốc thịt heo");
      expect(prohibitedPork.isCompliant).toBe(false);
      expect(prohibitedPork.riskLevel).toBe("PROHIBITED");
      expect(prohibitedPork.maffStatus.isMaffProhibited).toBe(true);
      expect(prohibitedPork.maffStatus.flaggedKeywords.some((k) => /ruốc|thịt heo/i.test(k))).toBe(true);

      const prohibitedSausage = quarantineAgent.screenTextCompliance("Thùng đồ ăn vặt có xúc xích và lạp xưởng");
      expect(prohibitedSausage.isCompliant).toBe(false);
      expect(prohibitedSausage.riskLevel).toBe("PROHIBITED");
      expect(prohibitedSausage.maffStatus.isMaffProhibited).toBe(true);

      const prohibitedSeed = quarantineAgent.screenTextCompliance("Gói hạt giống hoa hướng dương và cây cảnh");
      expect(prohibitedSeed.isCompliant).toBe(false);
      expect(prohibitedSeed.riskLevel).toBe("PROHIBITED");
    });

    it("phải phát hiện hàng nguy hiểm cấm bay theo an ninh hàng không IATA (pin lithium, bình xịt)", () => {
      const powerbank = quarantineAgent.screenTextCompliance("Điện thoại kèm sạc dự phòng pin lithium");
      expect(powerbank.isCompliant).toBe(false);
      expect(powerbank.riskLevel).toBe("PROHIBITED");
      expect(powerbank.iataStatus.isIataDangerousGoods).toBe(true);
      expect(powerbank.iataStatus.batteryDetected).toBe(true);

      const spray = quarantineAgent.screenTextCompliance("Mỹ phẩm bình xịt nén khí và nước hoa");
      expect(spray.isCompliant).toBe(false);
      expect(spray.iataStatus.isIataDangerousGoods).toBe(true);
      expect(spray.iataStatus.flammableDetected || spray.iataStatus.pressureDetected).toBe(true);
    });

    it("phải xác nhận an toàn cho mặt hàng được phép bay (SAFE)", () => {
      const safeItem = quarantineAgent.screenTextCompliance("Áo thun cotton Uniqlo và mô hình figure Gundam nhựa");
      expect(safeItem.isCompliant).toBe(true);
      expect(safeItem.riskLevel).toBe("SAFE");
      expect(safeItem.maffStatus.isMaffProhibited).toBe(false);
      expect(safeItem.iataStatus.isIataDangerousGoods).toBe(false);
    });

    it("phải tính toán quy chuẩn cân nặng thể tích IATA (D x R x C / 5000) và đề xuất cỡ thùng carton chuẩn", () => {
      // Kiện hàng cồng kềnh: 40 x 30 x 25 = 30.000 / 5000 = 6.0 kg > Cân thực 2.0 kg
      const result = quarantineAgent.calculateIataVolumetric(2.0, 40, 30, 25);
      expect(result.volumetricWeightKg).toBe(6.0);
      expect(result.chargeableWeightKg).toBe(6.0);
      expect(result.isVolumetricHigher).toBe(true);
      expect(result.suggestedBox).toBe("BOX_L");

      // Kiện hàng nặng đặc: 20 x 15 x 10 = 3000 / 5000 = 0.6 kg < Cân thực 1.5 kg
      const denseResult = quarantineAgent.calculateIataVolumetric(1.5, 20, 15, 10);
      expect(denseResult.volumetricWeightKg).toBe(0.6);
      expect(denseResult.chargeableWeightKg).toBe(1.5);
      expect(denseResult.isVolumetricHigher).toBe(false);
      expect(denseResult.suggestedBox).toBe("BOX_S");
    });
  });

  // =========================================================================
  // 3. KIỂM THỬ AGENT MUA HÀNG TOKYO (PurchasingAgent)
  // =========================================================================
  describe("3. Agent Mua Hàng Sàn Nhật Tokyo", () => {
    it("phải bóc tách link, nhận diện đúng sàn Nhật và tính giá cước nội địa", () => {
      const mercariAnalysis = purchasingAgent.analyzeProductUrl("https://jp.mercari.com/item/m9988776655", 3000);
      expect(mercariAnalysis.platform).toBe("mercari");
      expect(mercariAnalysis.isFreeDomesticShipping).toBe(true);
      expect(mercariAnalysis.sellerReliability.rating).toBe("GOOD");

      const rakutenAnalysis = purchasingAgent.analyzeProductUrl("https://item.rakuten.co.jp/store/item123", 5000);
      expect(rakutenAnalysis.platform).toBe("rakuten");
      expect(rakutenAnalysis.sellerReliability.rating).toBe("EXCELLENT");

      const yahooAnalysis = purchasingAgent.analyzeProductUrl("https://page.auctions.yahoo.co.jp/jp/auction/123", 4000);
      expect(yahooAnalysis.platform).toBe("yahoo_jp");
      expect(yahooAnalysis.isFreeDomesticShipping).toBe(false);
      expect(yahooAnalysis.estimatedDomesticShippingJpy).toBe(770);
    });

    it("phải cảnh báo rủi ro khi phát hiện hàng hỏng/linh kiện rời (Junk) trên Mercari", () => {
      const junkAnalysis = purchasingAgent.analyzeProductUrl("https://jp.mercari.com/item/m123-junk-broken-parts", 1000);
      expect(junkAnalysis.itemCondition).toBe("JUNK");
      expect(junkAnalysis.isEligibleForAutoPurchase).toBe(false);
      expect(junkAnalysis.risksIdentified.length).toBeGreaterThan(0);
    });

    it("chặn mua tự động khi đơn hàng chưa thanh toán tiền cọc", async () => {
      (prisma.order.findUnique as any).mockResolvedValue({
        id: "ord_1",
        orderCode: "CB-UNPAID",
        paymentStatus: "UNPAID",
        priceJpy: 5000,
      });

      const res = await purchasingAgent.executeAutoPurchase("ord_1");
      expect(res.success).toBe(false);
      expect(res.summary).toContain("chưa được thanh toán cọc");
    });

    it("cho phép mua tự động, sinh mã vận đơn JP (Yamato) khi đơn hàng đã cọc hợp lệ", async () => {
      (prisma.order.findUnique as any).mockResolvedValue({
        id: "ord_2",
        orderCode: "CB-DEPOSITED",
        paymentStatus: "DEPOSITED_70",
        priceJpy: 8000,
        originalUrl: "https://item.rakuten.co.jp/brand/item888",
        purchaseTask: null,
      });

      (prisma.order.update as any).mockResolvedValue({ id: "ord_2", status: "PURCHASED" });
      (prisma.purchaseTask.create as any).mockResolvedValue({ id: "task_1", status: "PURCHASED" });

      const res = await purchasingAgent.executeAutoPurchase("ord_2", { trackingCarrier: "yamato" });
      expect(res.success).toBe(true);
      expect(res.details?.status).toBe("PURCHASED");
      expect(res.details?.jpTrackingCode).toMatch(/^YMT-\d+/);
    });
  });

  // =========================================================================
  // 4. KIỂM THỬ AGENT KIỂM TOÁN TÀI CHÍNH (FinancialAuditAgent)
  // =========================================================================
  describe("4. Agent Kiểm Toán Tài Chính & Thu Số Dư Kho VN", () => {
    it("kiểm toán tuân thủ tỷ lệ đặt cọc 3 bậc (Tier 1: 100%, Tier 2: 70%, Tier 3: 50%)", () => {
      // Đơn nhỏ < 1M: cọc 100%
      const tier1 = financialAuditAgent.verifyDepositTier(800_000, 800_000);
      expect(tier1.depositTier).toBe("LOW");
      expect(tier1.expectedDepositPercent).toBe(100);
      expect(tier1.isCompliant).toBe(true);

      // Đơn 1M - 10M: cọc 70% (3.000.000 * 70% = 2.100.000)
      const tier2 = financialAuditAgent.verifyDepositTier(3_000_000, 2_100_000);
      expect(tier2.depositTier).toBe("STANDARD");
      expect(tier2.expectedDepositPercent).toBe(70);
      expect(tier2.isCompliant).toBe(true);

      // Đơn > 10M: cọc 50% (15.000.000 * 50% = 7.500.000)
      const tier3 = financialAuditAgent.verifyDepositTier(15_000_000, 7_500_000);
      expect(tier3.depositTier).toBe("HIGH");
      expect(tier3.expectedDepositPercent).toBe(50);
      expect(tier3.isCompliant).toBe(true);

      // Khách cọc thiếu
      const underDeposit = financialAuditAgent.verifyDepositTier(3_000_000, 1_000_000);
      expect(underDeposit.isCompliant).toBe(false);
      expect(underDeposit.expectedDepositVnd).toBe(2_100_000);
    });

    it("phát hiện đơn hàng về Kho VN nhưng chưa thanh toán số dư đợt 2", async () => {
      (prisma.order.findUnique as any).mockResolvedValue({
        id: "ord_vn_unsettled",
        orderCode: "CB-VN-01",
        status: "WAREHOUSE_VN",
        paymentStatus: "DEPOSITED_70",
        totalVnd: 2_000_000,
        depositAmountVnd: 1_400_000,
        paymentTransactions: [
          { status: "CONFIRMED", amountVnd: 1_400_000 },
        ],
        costLines: [],
      });

      const audit = await financialAuditAgent.auditOrderFinancials("ord_vn_unsettled");
      expect(audit.success).toBe(true);
      expect(audit.details?.warehouseVnBalance.remainingGoodsBalanceVnd).toBe(600_000);
      expect(audit.details?.warehouseVnBalance.canReleaseToDelivery).toBe(false);
      expect(audit.warnings?.some((w) => w.includes("CHƯA ĐƯỢC PHÉP XUẤT GIAO HÀNG"))).toBe(true);
    });

    it("tất toán số dư đợt 2 tại Kho VN, kích hoạt PAID_100 và mở khóa giao hàng LOCAL_DELIVERY", async () => {
      (prisma.order.findUnique as any).mockResolvedValue({
        id: "ord_vn_settling",
        orderCode: "CB-VN-02",
        status: "WAREHOUSE_VN",
        paymentStatus: "DEPOSITED_70",
        totalVnd: 2_000_000,
        depositAmountVnd: 1_400_000,
        paymentTransactions: [{ status: "CONFIRMED", amountVnd: 1_400_000 }],
      });

      (prisma.paymentTransaction.create as any).mockResolvedValue({ id: "tx_bal_1" });
      (prisma.order.update as any).mockResolvedValue({ id: "ord_vn_settling", paymentStatus: "PAID_100" });

      const res = await financialAuditAgent.settleWarehouseVnBalance("ord_vn_settling");
      expect(res.success).toBe(true);
      expect(res.details?.collectedAmountVnd).toBe(600_000);
      expect(res.details?.newPaymentStatus).toBe("PAID_100");
      expect(res.details?.canDispatchLocalDelivery).toBe(true);
    });

    it("phát hiện bất thường tài chính: đơn hàng âm biên lợi nhuận (Lỗ)", async () => {
      (prisma.order.findUnique as any).mockResolvedValue({
        id: "ord_loss",
        orderCode: "CB-LOSS",
        status: "PURCHASED",
        paymentStatus: "PAID_100",
        totalVnd: 1_000_000, // Thu khách 1tr
        depositAmountVnd: 1_000_000,
        paymentTransactions: [{ status: "CONFIRMED", amountVnd: 1_000_000 }],
        costLines: [
          { amountVnd: 950_000 },
          { amountVnd: 200_000 }, // Tổng chi 1.15tr > 1tr
        ],
      });

      const audit = await financialAuditAgent.auditOrderFinancials("ord_loss");
      expect(audit.success).toBe(true);
      expect(audit.details?.anomalies.some((a) => a.type === "NEGATIVE_MARGIN")).toBe(true);
    });
  });

  // =========================================================================
  // 5. KIỂM THỬ AGENT TRỢ LÝ ĐIỀU HÀNH (ExecutiveAssistantAgent)
  // =========================================================================
  describe("5. Agent Giám Đốc Vận Hành & Khơi Thông Điểm Nghẽn", () => {
    it("tổng hợp Bảng điểm Vận hành (Operations Scorecard) và phát hiện điểm nghẽn", async () => {
      (prisma.order.count as any)
        .mockResolvedValueOnce(12) // pendingDeposit
        .mockResolvedValueOnce(5)  // purchased
        .mockResolvedValueOnce(8)  // warehouseJp
        .mockResolvedValueOnce(4)  // inTransitAir
        .mockResolvedValueOnce(3)  // warehouseVn
        .mockResolvedValueOnce(6)  // localDelivery
        .mockResolvedValueOnce(50) // completed
        .mockResolvedValueOnce(2)  // stagnant > 48h
        .mockResolvedValueOnce(3); // unpaid at warehouseVn

      const scorecard = await executiveAssistantAgent.generateOperationsScorecard();
      expect(scorecard.pipelineCounts.pendingDeposit).toBe(12);
      expect(scorecard.throughputScore).toBeGreaterThan(0);
      expect(scorecard.bottlenecks.length).toBeGreaterThan(0);
      expect(scorecard.bottlenecks.some((b) => b.id === "bn_pending_deposits")).toBe(true);
    });

    it("thực thi One-Click Dispatch kích hoạt xử lý điểm nghẽn", async () => {
      (prisma.order.findMany as any).mockResolvedValue([
        { id: "o1", orderCode: "CB-101", customerEmail: "a@gmail.com" },
      ]);

      const dispatch = await executiveAssistantAgent.dispatchAction("DISPATCH_DEPOSIT_REMINDERS");
      expect(dispatch.success).toBe(true);
      expect(dispatch.summary).toContain("One-Click Dispatch");
    });
  });

  // =========================================================================
  // 6. KIỂM THỬ AGENT ORCHESTRATOR & GHI AUDITLOG BẤT BIẾN
  // =========================================================================
  describe("6. Agent Orchestrator & Kiểm toán Quyết định Tự động", () => {
    it("orchestrator điều phối tác vụ và tự động ghi AuditLog với actor=agentId", async () => {
      const auditSpy = vi.spyOn(auditModule, "writeAuditLog").mockResolvedValue(undefined as any);

      const execResult = await agentOrchestrator.executeAgentAction({
        agentId: "agent:quarantine",
        action: "SCREEN_COMPLIANCE",
        params: { text: "Hộp quà bánh đậu xanh" },
        triggeredBy: "admin_tester",
      });

      expect(execResult.success).toBe(true);
      expect(auditSpy).toHaveBeenCalledTimes(1);
      const callArg = auditSpy.mock.calls[0][0];
      expect(callArg.actor).toBe("agent:quarantine");
      expect(callArg.actorType).toBe("SYSTEM");
      expect(callArg.action).toBe("AI_SCREEN_COMPLIANCE");
      expect(callArg.summary).toBeDefined();

      auditSpy.mockRestore();
    });
  });

  // =========================================================================
  // 7. KIỂM THỬ PHÂN QUYỀN RBAC TRÊN CÁC API ROUTE MỚI CỦA AI WORKSPACE
  // =========================================================================
  describe("7. Kiểm thử bảo vệ RBAC trên các API route AI Workspace", () => {
    it("route overview và execute phải import requireAdmin và chỉ cấp quyền cho SUPER_ADMIN và OPERATOR", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const overviewPath = path.join(process.cwd(), "src/app/api/admin/ai-workspace/overview/route.ts");
      const executePath = path.join(process.cwd(), "src/app/api/admin/ai-workspace/execute/route.ts");

      expect(fs.existsSync(overviewPath)).toBe(true);
      expect(fs.existsSync(executePath)).toBe(true);

      const overviewContent = fs.readFileSync(overviewPath, "utf8");
      const executeContent = fs.readFileSync(executePath, "utf8");

      expect(overviewContent).toContain("requireAdmin");
      expect(overviewContent).toContain('"SUPER_ADMIN"');
      expect(overviewContent).toContain('"OPERATOR"');

      expect(executeContent).toContain("requireAdmin");
      expect(executeContent).toContain('"SUPER_ADMIN"');
      expect(executeContent).toContain('"OPERATOR"');
    });
  });
});
