import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { recentVietnamDateKeys, vietnamDateKey } from "@/lib/vietnam-time";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    // ====== 1. Lấy tất cả đơn hàng ======
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });

    // ====== 2. KPI Tổng quan ======
    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;
    const cancelledOrders = orders.filter((o) => o.status === "CANCELLED").length;
    const activeOrders = orders.filter(
      (o) => o.status !== "COMPLETED" && o.status !== "CANCELLED"
    ).length;

    // Doanh thu thực thu = tổng depositAmountVnd của đơn đã thanh toán
    const actualRevenue = orders
      .filter((o) => o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED")
      .reduce((acc, o) => acc + o.depositAmountVnd, 0);

    // Tổng giá trị đơn dự kiến (bao gồm cả chưa thanh toán)
    const estimatedRevenue = orders.reduce((acc, o) => acc + o.totalVnd, 0);

    const avgOrderValue =
      totalOrders > 0 ? Math.round(estimatedRevenue / totalOrders) : 0;

    const conversionRate =
      totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    // ====== 3. Đơn theo trạng thái ======
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

    // ====== 4. Mặt hàng bán chạy (nhóm theo productName + category) ======
    const productSalesMap: Record<string, { name: string; category: string; count: number; totalRevenue: number }> = {};
    orders
      .filter((o) => o.status !== "CANCELLED")
      .forEach((o) => {
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

    // ====== 5. Phân bổ doanh thu theo danh mục ======
    const categoryRevMap: Record<string, { count: number; revenue: number }> = {
      cosmetics: { count: 0, revenue: 0 },
      health: { count: 0, revenue: 0 },
      gadgets: { count: 0, revenue: 0 },
      anime: { count: 0, revenue: 0 },
      other: { count: 0, revenue: 0 },
    };
    orders
      .filter((o) => o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED")
      .forEach((o) => {
        const cat = o.category in categoryRevMap ? o.category : "other";
        categoryRevMap[cat].count++;
        categoryRevMap[cat].revenue += o.depositAmountVnd;
      });

    const categoryBreakdown = Object.entries(categoryRevMap).map(([cat, data]) => ({
      category: cat,
      label: cat === "cosmetics" ? "Mỹ phẩm"
        : cat === "health" ? "Thực phẩm chức năng"
        : cat === "gadgets" ? "Gia dụng & Điện tử"
        : cat === "anime" ? "Anime & Mô hình"
        : "Khác",
      count: data.count,
      revenue: data.revenue,
    }));

    // ====== 6. Doanh thu 7 ngày gần nhất ======
    const last7Days = recentVietnamDateKeys(7);

    const dailyRevenue = last7Days.map((dateStr) => {
      const dayOrders = orders.filter(
        (o) =>
          o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED" &&
          vietnamDateKey(o.createdAt) === dateStr
      );
      return {
        date: dateStr,
        count: dayOrders.length,
        revenue: dayOrders.reduce((acc, o) => acc + o.depositAmountVnd, 0),
      };
    });

    // ====== 7. Báo cáo phân loại khách hàng (REGISTERED vs GUEST) ======
    let registeredRevenue = 0;
    let registeredCount = 0;
    let guestRevenue = 0;
    let guestCount = 0;

    orders.filter(o => o.status !== "CANCELLED").forEach(o => {
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

    const customerTypeBreakdown = {
      registered: { count: registeredCount, revenue: registeredRevenue },
      guest: { count: guestCount, revenue: guestRevenue }
    };

    return NextResponse.json({
      success: true,
      kpi: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        activeOrders,
        actualRevenue,
        estimatedRevenue,
        avgOrderValue,
        conversionRate,
      },
      statusBreakdown,
      topProducts,
      categoryBreakdown,
      dailyRevenue,
      customerTypeBreakdown,
    });
  } catch (error) {
    console.error("[ADMIN REPORTS]", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy báo cáo." }, { status: 500 });
  }
}
