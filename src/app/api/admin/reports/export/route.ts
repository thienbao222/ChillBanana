import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vietnam-time";

export const dynamic = "force-dynamic";

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  try {
    const searchParams = req.nextUrl.searchParams;
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const where: any = {};
    if (fromStr || toStr) {
      where.createdAt = {};
      if (fromStr) {
        where.createdAt.gte = new Date(`${fromStr}T00:00:00.000+07:00`);
      }
      if (toStr) {
        where.createdAt.lte = new Date(`${toStr}T23:59:59.999+07:00`);
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        paymentTransactions: true,
        costLines: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Mã đơn",
      "Ngày",
      "Trạng thái",
      "GMV",
      "Phí dịch vụ",
      "Cước bay",
      "Tổng tiền",
      "Đã thu",
      "Chi phí thực",
      "Lãi gộp",
      "Cờ",
    ];

    const rows = orders.map((o) => {
      const activeCostLines = o.costLines.filter((c) => !c.voidedAt);
      const hasGoodsJpy = activeCostLines.some((c) => c.category === "GOODS_JPY");
      const totalCostVnd = activeCostLines.reduce((sum, c) => sum + c.amountVnd, 0);

      const activePayments = o.paymentTransactions.filter(
        (t) => t.status !== "VOIDED" && t.status !== "PENDING_RECONCILE"
      );
      const totalPaidVnd = activePayments.reduce((sum, t) => {
        if (t.kind === "REFUND") return sum - Math.abs(t.amountVnd);
        return sum + t.amountVnd;
      }, 0);

      let grossProfit = 0;
      let flag = "";

      if (o.status === "CANCELLED") {
        flag = "Đã hủy";
      } else if (o.status === "COMPLETED") {
        if (hasGoodsJpy) {
          grossProfit = o.totalVnd - totalCostVnd;
        } else {
          flag = "Chưa đủ chi phí";
        }
      }

      return [
        escapeCsvField(o.orderCode),
        escapeCsvField(vietnamDateKey(o.createdAt)),
        escapeCsvField(o.status),
        escapeCsvField(o.productPriceVnd),
        escapeCsvField(o.serviceFeeVnd),
        escapeCsvField(o.shippingFeeVnd),
        escapeCsvField(o.totalVnd),
        escapeCsvField(totalPaidVnd),
        escapeCsvField(totalCostVnd),
        escapeCsvField(grossProfit),
        escapeCsvField(flag),
      ].join(",");
    });

    // UTF-8 BOM (0xEF, 0xBB, 0xBF) giúp Excel mở file tiếng Việt chuẩn không bị lỗi font
    const csvString = [headers.join(","), ...rows].join("\r\n");
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const bodyBytes = Buffer.concat([bom, Buffer.from(csvString, "utf-8")]);
    const filename = `bao-cao-don-hang-${fromStr || "all"}-${toStr || "all"}.csv`;

    return new NextResponse(bodyBytes, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[REPORTS EXPORT CSV]", error);
    return NextResponse.json({ error: "Không thể xuất file CSV lúc này." }, { status: 500 });
  }
}
