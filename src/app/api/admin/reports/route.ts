import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { recentVietnamDateKeys, vietnamDateKey } from "@/lib/vietnam-time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  try {
    // 1. Lấy tất cả đơn hàng kèm PaymentTransactions và OrderCostLines
    const [orders, vnJpShipments] = await Promise.all([
      prisma.order.findMany({
        include: {
          paymentTransactions: true,
          costLines: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.vnJpShipment.findMany({
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // 2. Phân loại theo WP2.3 (loại bỏ CANCELLED khỏi các chỉ số tài chính)
    const nonCancelledOrders = orders.filter((o) => o.status !== "CANCELLED");
    const completedOrders = nonCancelledOrders.filter((o) => o.status === "COMPLETED");
    const cancelledOrders = orders.filter((o) => o.status === "CANCELLED");
    const activeOrders = nonCancelledOrders.filter((o) => o.status !== "COMPLETED");

    // GMV = Tổng productPriceVnd của các đơn không CANCELLED
    const gmv = nonCancelledOrders.reduce((sum, o) => sum + (o.productPriceVnd || 0), 0);

    // Doanh thu dịch vụ = Tổng (serviceFeeVnd + shippingFeeVnd) của đơn COMPLETED
    const doanhThuDichVu = completedOrders.reduce(
      (sum, o) => sum + (o.serviceFeeVnd || 0) + (o.shippingFeeVnd || 0),
      0
    );

    // Tiền thực thu = Tổng PaymentTransaction hiệu lực (DEPOSIT, BALANCE, LEGACY) trừ REFUND, bỏ VOIDED
    let tienThucThu = 0;
    for (const order of nonCancelledOrders) {
      for (const t of order.paymentTransactions) {
        if (t.status === "VOIDED" || t.status === "PENDING_RECONCILE") continue;
        if (t.kind === "REFUND") {
          tienThucThu -= Math.abs(t.amountVnd);
        } else {
          // DEPOSIT, BALANCE, LEGACY, REVERSAL
          tienThucThu += t.amountVnd;
        }
      }
    }

    // Chi phí thực = Tổng OrderCostLine chưa voided của đơn không CANCELLED
    let chiPhiThuc = 0;
    for (const order of nonCancelledOrders) {
      for (const c of order.costLines) {
        if (!c.voidedAt) {
          chiPhiThuc += c.amountVnd;
        }
      }
    }

    // Lợi nhuận gộp = totalVnd của đơn COMPLETED trừ chiPhiThuc, chỉ tính khi đơn có dòng GOODS_JPY
    let loiNhuanGop = 0;
    let completedEligibleCount = 0;
    let completedIncompleteCostCount = 0;

    for (const order of completedOrders) {
      const activeCostLines = order.costLines.filter((c) => !c.voidedAt);
      const hasGoodsJpy = activeCostLines.some((c) => c.category === "GOODS_JPY");
      const orderCostTotal = activeCostLines.reduce((sum, c) => sum + c.amountVnd, 0);

      if (hasGoodsJpy) {
        loiNhuanGop += (order.totalVnd - orderCostTotal);
        completedEligibleCount++;
      } else {
        completedIncompleteCostCount++;
      }
    }

    // Doanh thu thực thu cũ (giữ tương thích ReportsTab.tsx UI)
    const actualRevenue = nonCancelledOrders
      .filter((o) => o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED")
      .reduce((acc, o) => acc + o.depositAmountVnd, 0);

    const estimatedRevenue = nonCancelledOrders.reduce((acc, o) => acc + o.totalVnd, 0);

    const avgOrderValue =
      nonCancelledOrders.length > 0 ? Math.round(estimatedRevenue / nonCancelledOrders.length) : 0;

    const conversionRate =
      orders.length > 0 ? Math.round((completedOrders.length / orders.length) * 100) : 0;

    // 3. Đơn theo trạng thái
    const statusBreakdown: Record<string, number> = {
      PENDING_DEPOSIT: 0,
      PURCHASING_JP: 0,
      WAREHOUSE_JP: 0,
      IN_TRANSIT_AIR: 0,
      WAREHOUSE_VN: 0,
      LOCAL_DELIVERY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    orders.forEach((o) => {
      if (statusBreakdown[o.status] !== undefined) {
        statusBreakdown[o.status]++;
      }
    });

    // 4. Mặt hàng bán chạy (chỉ đơn không CANCELLED)
    const productSalesMap: Record<string, { name: string; category: string; count: number; totalRevenue: number }> = {};
    nonCancelledOrders.forEach((o) => {
      const key = o.productName.trim().toLowerCase().slice(0, 60);
      if (!productSalesMap[key]) {
        productSalesMap[key] = {
          name: o.productName,
          category: o.category,
          count: 0,
          totalRevenue: 0,
        };
      }
      productSalesMap[key].count++;
      if (o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED") {
        productSalesMap[key].totalRevenue += o.depositAmountVnd;
      }
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 5. Phân bổ theo danh mục
    const categoryRevMap: Record<string, { count: number; revenue: number }> = {
      cosmetics: { count: 0, revenue: 0 },
      health: { count: 0, revenue: 0 },
      gadgets: { count: 0, revenue: 0 },
      anime: { count: 0, revenue: 0 },
      other: { count: 0, revenue: 0 },
    };
    nonCancelledOrders
      .filter((o) => o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED")
      .forEach((o) => {
        const cat = o.category in categoryRevMap ? o.category : "other";
        categoryRevMap[cat].count++;
        categoryRevMap[cat].revenue += o.depositAmountVnd;
      });

    const categoryBreakdown = Object.entries(categoryRevMap).map(([cat, data]) => ({
      category: cat,
      label:
        cat === "cosmetics"
          ? "Mỹ phẩm"
          : cat === "health"
          ? "Thực phẩm chức năng"
          : cat === "gadgets"
          ? "Gia dụng & Điện tử"
          : cat === "anime"
          ? "Anime & Mô hình"
          : "Khác",
      count: data.count,
      revenue: data.revenue,
    }));

    // 6. Doanh thu 7 ngày gần nhất (không tính đơn hủy)
    const last7Days = recentVietnamDateKeys(7);
    const dailyRevenue = last7Days.map((dateStr) => {
      const dayOrders = nonCancelledOrders.filter(
        (o) =>
          o.paymentStatus !== "UNPAID" &&
          o.paymentStatus !== "REFUNDED" &&
          vietnamDateKey(o.createdAt) === dateStr
      );
      return {
        date: dateStr,
        count: dayOrders.length,
        revenue: dayOrders.reduce((acc, o) => acc + o.depositAmountVnd, 0),
      };
    });

    // 7. Báo cáo phân loại khách hàng
    let registeredRevenue = 0;
    let registeredCount = 0;
    let guestRevenue = 0;
    let guestCount = 0;

    nonCancelledOrders.forEach((o) => {
      if (o.customerType === "REGISTERED") {
        registeredCount++;
        if (o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED") {
          registeredRevenue += o.depositAmountVnd;
        }
      } else {
        guestCount++;
        if (o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED") {
          guestRevenue += o.depositAmountVnd;
        }
      }
    });

    // 8. Báo cáo riêng VN -> JP (WP2.3 / WP6.1)
    const vnJpNonCancelled = vnJpShipments.filter((s) => s.status !== "CANCELLED");
    const vnJpSummary = {
      totalShipments: vnJpShipments.length,
      activeShipments: vnJpNonCancelled.filter((s) => s.status !== "DELIVERED").length,
      completedShipments: vnJpShipments.filter((s) => s.status === "DELIVERED").length,
      totalShippingFeeVnd: vnJpNonCancelled.reduce((acc, s) => acc + (s.totalShippingFeeVnd || 0), 0),
      totalChargeableWeightKg: vnJpNonCancelled.reduce((acc, s) => acc + (s.chargeableWeightKg || 0), 0),
    };

    return NextResponse.json({
      success: true,
      kpi: {
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        activeOrders: activeOrders.length,
        actualRevenue,
        estimatedRevenue,
        avgOrderValue,
        conversionRate,
        // WP2.3 Financial Metrics
        gmv,
        doanhThuDichVu,
        tienThucThu,
        chiPhiThuc,
        loiNhuanGop,
        completedEligibleCount,
        completedIncompleteCostCount,
      },
      statusBreakdown,
      topProducts,
      categoryBreakdown,
      dailyRevenue,
      customerTypeBreakdown: {
        registered: { count: registeredCount, revenue: registeredRevenue },
        guest: { count: guestCount, revenue: guestRevenue },
      },
      vnJpSummary,
    });
  } catch (error) {
    console.error("[ADMIN REPORTS]", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy báo cáo." }, { status: 500 });
  }
}
