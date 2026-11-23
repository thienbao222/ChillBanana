import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { createCostLine, voidCostLine, COST_CATEGORIES, CostCategory } from "@/features/finance/cost-lines";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  try {
    const { id: orderId } = await params;
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: orderId }, { orderCode: orderId }] },
      select: {
        id: true,
        orderCode: true,
        status: true,
        totalVnd: true,
        productPriceVnd: true,
        serviceFeeVnd: true,
        shippingFeeVnd: true,
        costLines: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    const activeLines = order.costLines.filter((c) => !c.voidedAt);
    const hasGoodsJpy = activeLines.some((c) => c.category === "GOODS_JPY");
    const totalCostVnd = activeLines.reduce((sum, c) => sum + c.amountVnd, 0);

    const isCompleted = order.status === "COMPLETED";
    const grossProfitVnd = isCompleted && hasGoodsJpy ? order.totalVnd - totalCostVnd : null;
    const statusFlag = !hasGoodsJpy ? "Chưa có chi phí mua hàng (GOODS_JPY)" : null;

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderCode: order.orderCode,
      costLines: order.costLines,
      summary: {
        totalCostVnd,
        orderTotalVnd: order.totalVnd,
        grossProfitVnd,
        hasGoodsJpy,
        statusFlag,
      },
    });
  } catch (error) {
    console.error("[ADMIN ORDER COSTS GET]", error);
    return NextResponse.json({ error: "Không thể tải danh sách chi phí." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  try {
    const { id: orderId } = await params;
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: orderId }, { orderCode: orderId }] },
      select: { id: true, orderCode: true, status: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
    }

    // 1. Thao tác HỦY DÒNG CHI PHÍ (Void - Không bao giờ xóa cứng)
    if (body.action === "void") {
      const { costLineId, reason } = body;
      if (!costLineId || typeof costLineId !== "string") {
        return NextResponse.json({ error: "Thiếu mã dòng chi phí costLineId." }, { status: 400 });
      }
      if (!reason || typeof reason !== "string" || !reason.trim()) {
        return NextResponse.json({ error: "Bắt buộc nhập lý do khi hủy dòng chi phí." }, { status: 400 });
      }

      const voided = await voidCostLine(costLineId, reason.trim(), guard.username);
      return NextResponse.json({
        success: true,
        message: "Đã hủy dòng chi phí thành công.",
        costLine: voided,
      });
    }

    // 2. Thao tác TẠO DÒNG CHI PHÍ MỚI
    const {
      category,
      amountOriginal,
      currency,
      fxRate,
      amountVnd,
      note,
      receiptUrl,
      purchaseTaskId,
      shipmentId,
    } = body;

    if (!category || !COST_CATEGORIES.includes(category as CostCategory)) {
      return NextResponse.json(
        { error: `Danh mục chi phí '${category}' không hợp lệ. Các danh mục hợp lệ: ${COST_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    const numOriginal = Number(amountOriginal);
    if (!Number.isFinite(numOriginal) || numOriginal <= 0) {
      return NextResponse.json({ error: "Số tiền gốc amountOriginal phải là số dương hợp lệ." }, { status: 400 });
    }

    if (currency !== "JPY" && currency !== "VND") {
      return NextResponse.json({ error: "Tiền tệ chỉ chấp nhận 'JPY' hoặc 'VND'." }, { status: 400 });
    }

    const numAmountVnd = Number(amountVnd);
    if (!Number.isSafeInteger(numAmountVnd) || numAmountVnd < 0) {
      return NextResponse.json({ error: "Số tiền quy đổi amountVnd phải là số nguyên không âm (VND)." }, { status: 400 });
    }

    const numFxRate = fxRate !== undefined && fxRate !== null ? Number(fxRate) : null;
    if (numFxRate !== null && (!Number.isFinite(numFxRate) || numFxRate <= 0)) {
      return NextResponse.json({ error: "Tỷ giá fxRate phải là số dương." }, { status: 400 });
    }

    const costLine = await createCostLine({
      orderId: order.id,
      category: category as CostCategory,
      amountOriginal: numOriginal,
      currency: currency as "JPY" | "VND",
      fxRate: numFxRate,
      amountVnd: numAmountVnd,
      note: note ? String(note).trim() : null,
      receiptUrl: receiptUrl ? String(receiptUrl).trim() : null,
      createdBy: guard.username,
      purchaseTaskId: purchaseTaskId ? String(purchaseTaskId) : null,
      shipmentId: shipmentId ? String(shipmentId) : null,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Đã thêm dòng chi phí thành công.",
        costLine,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[ADMIN ORDER COSTS POST]", error);
    return NextResponse.json(
      { error: error?.message || "Không thể xử lý chi phí lúc này." },
      { status: 500 }
    );
  }
}

