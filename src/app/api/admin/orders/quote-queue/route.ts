import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const sourceFilter = searchParams.get("quoteSource");
    const overdueOnly = searchParams.get("overdue4h") === "true";

    // Tìm các đơn hàng ngoài catalog chưa được nhân viên duyệt giá
    const orders = await prisma.order.findMany({
      where: {
        isPriceVerified: false,
        status: "PENDING_DEPOSIT",
        ...(sourceFilter
          ? {
              orderItems: {
                some: {
                  quoteSource: sourceFilter,
                },
              },
            }
          : {}),
      },
      include: {
        orderItems: true,
      },
      orderBy: {
        createdAt: "asc", // Đơn chờ lâu nhất lên đầu
      },
      take: 100,
    });

    const now = Date.now();
    const fourHoursMs = 4 * 60 * 60 * 1000;

    const queueItems = orders
      .map((order) => {
        const ageMs = now - order.createdAt.getTime();
        const waitingHours = Math.round((ageMs / (1000 * 60 * 60)) * 10) / 10;
        const isOverdue4h = ageMs >= fourHoursMs;

        // Tập hợp nguồn báo giá của các dòng hàng
        const sources = Array.from(new Set(order.orderItems.map((it) => it.quoteSource || "MANUAL")));

        return {
          orderId: order.id,
          orderCode: order.orderCode,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          createdAt: order.createdAt,
          waitingHours,
          isOverdue4h,
          totalVnd: order.totalVnd,
          priceJpy: order.priceJpy,
          weightKg: order.weightKg,
          sources,
          itemsCount: order.orderItems.length,
          orderItems: order.orderItems.map((it) => ({
            id: it.id,
            productName: it.productName,
            itemType: it.itemType,
            quoteSource: it.quoteSource || "MANUAL",
            priceJpy: it.priceJpy,
            weightKg: it.weightKg,
            quantity: it.quantity,
          })),
        };
      })
      .filter((item) => (overdueOnly ? item.isOverdue4h : true));

    return NextResponse.json({
      success: true,
      total: queueItems.length,
      overdueCount: queueItems.filter((i) => i.isOverdue4h).length,
      queue: queueItems,
    });
  } catch (error) {
    console.error("[QuoteQueue] Lỗi tải hàng đợi duyệt giá:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi tải hàng đợi duyệt giá." }, { status: 500 });
  }
}

