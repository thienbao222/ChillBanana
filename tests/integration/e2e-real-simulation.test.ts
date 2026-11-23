import { describe, expect, it } from "vitest";
import { POST as createOrder } from "@/app/api/orders/route";
import { PATCH as patchOrder } from "@/app/api/orders/[id]/route";
import { POST as recordPayment } from "@/app/api/admin/orders/[id]/payments/route";
import { prisma } from "../helpers/db";
import { json, post, patch, params } from "../helpers/request";
import { adminCookies, makeAdmin, makeProduct, orderPayload } from "../helpers/factories";
import { quarantineAgent } from "@/features/ai-workspace/agents/quarantine-agent";
import { checkWeightTolerance, calculateWarehouseVnBalance } from "@/features/payments/policy";

describe("KỊCH BẢN MÔ PHỎNG THỰC TẾ HAI CHIỀU: KHÁCH HÀNG & QUẢN TRỊ VẬN HÀNH (E2E VALUE STREAM)", () => {
  it("Thực thi trọn vẹn vòng đời đơn hàng: Báo giá, Cọc 70%, Thu mua Tokyo, Dung sai cân nặng, Thu số dư Đợt 2, Bàn giao Shipper, và Kiểm toán Lời/Lỗ", async () => {
    // -------------------------------------------------------------------------------------------------
    // BƯỚC 0: Khởi tạo dữ liệu nền tảng (Sản phẩm Catalog & Quản trị viên)
    // -------------------------------------------------------------------------------------------------
    const adminUser = await makeAdmin("operator_jp", "OPERATOR");
    const adminAuth = adminCookies(adminUser.username, adminUser.role);

    const product = await makeProduct({
      name: "Mô hình Figure Jujutsu Kaisen Gojo Satoru Limited Edition (Amazon JP)",
      priceJpy: 6000,
      weightKg: 0.8,
      stockSlots: 10,
    });

    // -------------------------------------------------------------------------------------------------
    // PHÍA KHÁCH HÀNG - BƯỚC 1: Đặt hàng qua Catalog & Nhận báo giá Server
    // -------------------------------------------------------------------------------------------------
    const createRes = await createOrder(
      post(
        "/api/orders",
        orderPayload([{ id: product.id, quantity: 1 }], {
          customerName: "Trần Văn An",
          customerPhone: "0912345678",
          customerEmail: "khachhang.an@gmail.com",
          customerAddress: "Số 15 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
        })
      )
    );

    expect(createRes.status).toBe(200);
    const createData = await json<{ success: boolean; order: any }>(createRes);
    expect(createData.success).toBe(true);
    const order = createData.order;

    // Kiểm tra tính toán giá phía Khách hàng:
    // Tiền hàng: 6.000 ¥ * 170 = 1.020.000 đ
    // Sàn phí mua hộ tối thiểu: 80.000 đ
    // Cước bay quốc tế: 0.8kg * 185.000 = 148.000 đ
    // Tổng tiền đơn: 1.020.000 + 80.000 + 148.000 = 1.248.000 đ
    expect(order.productPriceVnd).toBe(1_020_000);
    expect(order.serviceFeeVnd).toBe(80_000);
    expect(order.shippingFeeVnd).toBe(148_000);
    expect(order.totalVnd).toBe(1_248_000);

    // Luật cọc 3 bậc: Base cost = 1.100.000 đ (> 1M) -> Bậc STANDARD (70%)
    // Cọc 70% trên 1.100.000 đ = 770.000 đ
    expect(order.depositPercent).toBe(70);
    expect(order.depositAmountVnd).toBe(770_000);
    expect(order.status).toBe("PENDING_DEPOSIT");
    expect(order.paymentStatus).toBe("UNPAID");

    // -------------------------------------------------------------------------------------------------
    // PHÍA KHÁCH HÀNG & QUẢN TRỊ - BƯỚC 2: Khách nộp cọc Đợt 1 (770.000 đ) & Quản trị duyệt tiền
    // -------------------------------------------------------------------------------------------------
    const depositPayRes = await recordPayment(
      post(
        `/api/admin/orders/${order.orderCode}/payments`,
        {
          amountVnd: 770_000,
          reference: "VQR-DEP-770000-AN",
        },
        { cookies: adminAuth }
      ),
      params({ id: order.orderCode })
    );

    expect(depositPayRes.status).toBe(200);
    const depositPayData = await json<{ success: boolean }>(depositPayRes);
    expect(depositPayData.success).toBe(true);

    // Xác nhận DB: Đơn đã nhận cọc và chuyển sang khâu thu mua Tokyo
    const afterDepositOrder = await prisma.order.findUniqueOrThrow({
      where: { orderCode: order.orderCode },
      include: { paymentTransactions: true, trackingLogs: true },
    });
    expect(afterDepositOrder.paymentStatus).toBe("DEPOSITED_70");
    expect(afterDepositOrder.status).toBe("PURCHASING_JP");
    expect(afterDepositOrder.paymentTransactions).toHaveLength(1);
    expect(afterDepositOrder.paymentTransactions[0].amountVnd).toBe(770_000);

    // -------------------------------------------------------------------------------------------------
    // PHÍA QUẢN TRỊ VẬN HÀNH - BƯỚC 3: AI Quarantine Agent kiểm tra an toàn bay & Mua hàng Tokyo
    // -------------------------------------------------------------------------------------------------
    // 3.1 AI Quarantine Agent thẩm định kiện hàng
    const quarantineReport = quarantineAgent.screenTextCompliance(order.productName);
    expect(quarantineReport.riskLevel).toBe("SAFE");
    expect(quarantineReport.isCompliant).toBe(true);
    expect(quarantineReport.iataStatus.isIataDangerousGoods).toBe(false);
    expect(quarantineReport.maffStatus.isMaffProhibited).toBe(false);

    // 3.2 Ghi nhận tác vụ mua hàng Tokyo và chi phí tiền hàng
    const purchaseTask = await prisma.purchaseTask.create({
      data: {
        orderId: afterDepositOrder.id,
        platform: "amazon_jp",
        status: "PURCHASED",
        externalOrderId: "AMZ-JP-9928103",
        approvedByAdmin: adminUser.username,
        approvedAt: new Date(),
        purchasedByStaff: adminUser.username,
        purchasedAt: new Date(),
        adminNote: "Đã đặt hàng thành công trên Amazon JP. Mã bưu tá nội địa Sagawa: SAGAWA-JP-8829104",
      },
    });
    expect(purchaseTask).toBeDefined();

    // Ghi nhận chi phí vốn hàng bán: 6.000 JPY * 170 = 1.020.000 đ
    await prisma.orderCostLine.create({
      data: {
        orderId: afterDepositOrder.id,
        purchaseTaskId: purchaseTask.id,
        category: "GOODS_JPY",
        amountOriginal: 6000,
        currency: "JPY",
        fxRate: 170,
        amountVnd: 1_020_000,
        note: "Tiền mua hàng gốc trên Amazon JP",
        createdBy: adminUser.username,
      },
    });

    // -------------------------------------------------------------------------------------------------
    // PHÍA QUẢN TRỊ VẬN HÀNH - BƯỚC 4: Nhập kho Tokyo, Cân đo dung sai & Xuất bay quốc tế
    // -------------------------------------------------------------------------------------------------
    // 4.1 Hàng đến kho Tokyo -> Chuyển sang WAREHOUSE_JP
    const toTokyoRes = await patchOrder(
      patch(
        `/api/orders/${order.orderCode}`,
        {
          status: "WAREHOUSE_JP",
          adminNote: "Đã nhận hàng từ bưu tá Sagawa tại kho Tokyo Shinjuku.",
        },
        { cookies: adminAuth }
      ),
      params({ id: order.orderCode })
    );
    expect(toTokyoRes.status).toBe(200);

    // 4.2 Cân đo thực tế: Dự kiến 0.80 kg, Thực tế 0.83 kg (lệch 30g)
    const actualWeightKg = 0.83;
    const tolerance = checkWeightTolerance(order.weightKg, actualWeightKg);
    expect(tolerance.withinTolerance).toBe(true); // Lệch 30g <= 50g -> MIỄN PHÍ DUNG SAI CHO KHÁCH

    // Ghi nhận chi phí kho Tokyo (nhận hàng, đóng gói bọt khí chống sốc): 300 JPY (~51.000 đ)
    await prisma.orderCostLine.create({
      data: {
        orderId: afterDepositOrder.id,
        category: "TOKYO_HANDLING",
        amountOriginal: 300,
        currency: "JPY",
        fxRate: 170,
        amountVnd: 51_000,
        note: "Phí xử lý kiểm đếm và đóng gói carton tại Kho Tokyo",
        createdBy: adminUser.username,
      },
    });

    // 4.3 Xuất bay hàng không quốc tế -> Chuyển sang IN_TRANSIT_AIR
    const toAirRes = await patchOrder(
      patch(
        `/api/orders/${order.orderCode}`,
        {
          status: "IN_TRANSIT_AIR",
          trackingNumber: "AWB-VNA-NRT-SGN-9921",
          adminNote: "Đã bàn giao hãng hàng không Vietnam Airlines chuyến bay VN301 Narita -> Tân Sơn Nhất.",
        },
        { cookies: adminAuth }
      ),
      params({ id: order.orderCode })
    );
    expect(toAirRes.status).toBe(200);

    // Ghi nhận chi phí cước bay hàng không thực tế: 0.83kg * 140.000 đ/kg = 116.200 đ
    await prisma.orderCostLine.create({
      data: {
        orderId: afterDepositOrder.id,
        category: "INTL_FREIGHT",
        amountOriginal: 116200,
        currency: "VND",
        fxRate: 1.0,
        amountVnd: 116_200,
        note: "Cước bay Narita - Tân Sơn Nhất (hợp đồng B2B 140k/kg)",
        createdBy: adminUser.username,
      },
    });

    // -------------------------------------------------------------------------------------------------
    // PHÍA KHÁCH HÀNG & QUẢN TRỊ - BƯỚC 5: Cập cảng kho VN & Tất toán Số Dư Đợt 2
    // -------------------------------------------------------------------------------------------------
    // 5.1 Hàng cập cảng VN -> Chuyển sang WAREHOUSE_VN
    const toVnRes = await patchOrder(
      patch(
        `/api/orders/${order.orderCode}`,
        {
          status: "WAREHOUSE_VN",
          adminNote: "Kiện hàng đã thông quan và nhập kho ChillBanana Tân Bình, TP.HCM.",
        },
        { cookies: adminAuth }
      ),
      params({ id: order.orderCode })
    );
    expect(toVnRes.status).toBe(200);

    // 5.2 Tính toán số dư còn thiếu Đợt 2
    const balanceCalc = calculateWarehouseVnBalance({
      totalVnd: order.totalVnd,
      paidAmountVnd: 770_000,
    });
    expect(balanceCalc.isFullySettled).toBe(false);
    expect(balanceCalc.actionNeeded).toBe("COLLECT_BALANCE");
    expect(balanceCalc.remainingGoodsBalanceVnd).toBe(478_000); // 1.248.000 - 770.000 = 478.000 đ

    // 5.3 Thử nghiệm bảo vệ: Chưa thanh toán đủ 100% thì CHẶN giao hàng LOCAL_DELIVERY (HTTP 409 Conflict)
    const prematureDeliveryRes = await patchOrder(
      patch(
        `/api/orders/${order.orderCode}`,
        {
          status: "LOCAL_DELIVERY",
        },
        { cookies: adminAuth }
      ),
      params({ id: order.orderCode })
    );
    expect(prematureDeliveryRes.status).toBe(409); // Bị chặn HTTP 409 Conflict vì chưa PAID_100!

    // 5.4 Khách hàng quét mã VietQR động thanh toán nốt số dư Đợt 2 (478.000 đ)
    const balancePayRes = await recordPayment(
      post(
        `/api/admin/orders/${order.orderCode}/payments`,
        {
          amountVnd: 478_000,
          reference: "VQR-BAL-478000-AN",
        },
        { cookies: adminAuth }
      ),
      params({ id: order.orderCode })
    );
    expect(balancePayRes.status).toBe(200);

    // Xác nhận sau khi tất toán Đợt 2: Đạt PAID_100
    const afterBalanceOrder = await prisma.order.findUniqueOrThrow({
      where: { orderCode: order.orderCode },
      include: { paymentTransactions: true },
    });
    expect(afterBalanceOrder.paymentStatus).toBe("PAID_100");
    expect(afterBalanceOrder.depositAmountVnd).toBe(1_248_000); // Cập nhật đủ 100%
    expect(afterBalanceOrder.paymentTransactions).toHaveLength(2); // 2 lần nộp tiền

    // -------------------------------------------------------------------------------------------------
    // PHÍA QUẢN TRỊ VẬN HÀNH - BƯỚC 6: Bàn giao Shipper nội địa & Hoàn tất đơn hàng
    // -------------------------------------------------------------------------------------------------
    // 6.1 Mở khóa bàn giao bưu cục Viettel Post -> LOCAL_DELIVERY
    const deliveryRes = await patchOrder(
      patch(
        `/api/orders/${order.orderCode}`,
        {
          status: "LOCAL_DELIVERY",
          trackingNumber: "VTP-HCM-6638201",
          adminNote: "Đã bàn giao bưu tá Viettel Post phát hàng hỏa tốc trong ngày.",
        },
        { cookies: adminAuth }
      ),
      params({ id: order.orderCode })
    );
    expect(deliveryRes.status).toBe(200);

    // Ghi nhận chi phí ship nội địa Viettel Post: 32.000 đ
    await prisma.orderCostLine.create({
      data: {
        orderId: afterDepositOrder.id,
        category: "VN_DOMESTIC_SHIP",
        amountOriginal: 32000,
        currency: "VND",
        fxRate: 1.0,
        amountVnd: 32_000,
        note: "Cước bưu cục Viettel Post phát tận nhà Quận 1",
        createdBy: adminUser.username,
      },
    });

    // Ghi nhận phí xử lý cổng thanh toán: 18.720 đ (1.5% của 1.248.000 đ)
    await prisma.orderCostLine.create({
      data: {
        orderId: afterDepositOrder.id,
        category: "PAYMENT_FEE",
        amountOriginal: 18720,
        currency: "VND",
        fxRate: 1.0,
        amountVnd: 18_720,
        note: "Phí cổng thanh toán VietQR / VNPAY",
        createdBy: adminUser.username,
      },
    });

    // 6.2 Khách nhận hàng thành công -> Chuyển sang COMPLETED
    const completedRes = await patchOrder(
      patch(
        `/api/orders/${order.orderCode}`,
        {
          status: "COMPLETED",
          adminNote: "Khách hàng đã nhận hàng nguyên vẹn và ký nhận thành công.",
        },
        { cookies: adminAuth }
      ),
      params({ id: order.orderCode })
    );
    expect(completedRes.status).toBe(200);

    // -------------------------------------------------------------------------------------------------
    // BƯỚC 7: KIỂM TOÁN TÀI CHÍNH LỜI / LỖ (P&L UNIT ECONOMICS AUDIT)
    // -------------------------------------------------------------------------------------------------
    const finalOrder = await prisma.order.findUniqueOrThrow({
      where: { orderCode: order.orderCode },
      include: {
        paymentTransactions: true,
        costLines: true,
        trackingLogs: true,
      },
    });

    // Tổng doanh thu thực thu từ khách
    const totalRevenueVnd = finalOrder.paymentTransactions.reduce((acc, tx) => acc + tx.amountVnd, 0);
    expect(totalRevenueVnd).toBe(1_248_000);

    // Tổng chi phí thực tế bỏ ra
    const totalActualCostVnd = finalOrder.costLines.reduce((acc, cost) => acc + cost.amountVnd, 0);
    // 1.020.000 (Hàng) + 51.000 (Kho JP) + 116.200 (Bay) + 32.000 (Ship VN) + 18.720 (Cổng) = 1.237.920 đ
    expect(totalActualCostVnd).toBe(1_237_920);

    // Lợi nhuận ròng thực tế thu về (Net Profit)
    const netProfitVnd = totalRevenueVnd - totalActualCostVnd;
    expect(netProfitVnd).toBe(10_080); // Dương +10.080 đ!
    expect(netProfitVnd).toBeGreaterThan(0);

    // Kiểm tra tính toàn vẹn của Audit Log & Tracking Timeline
    const audits = await prisma.auditLog.findMany({
      where: { entityId: order.orderCode },
    });
    expect(audits.length).toBeGreaterThan(0);
    expect(finalOrder.trackingLogs.length).toBeGreaterThanOrEqual(6);
  });
});
