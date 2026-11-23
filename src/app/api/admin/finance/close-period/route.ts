import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { closePeriod } from "@/features/finance/period-close";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  try {
    const closedPeriods = await prisma.periodClose.findMany({
      orderBy: { period: "desc" },
    });

    const formatted = closedPeriods.map((p) => ({
      id: p.id,
      period: p.period,
      closedAt: p.closedAt,
      closedBy: p.closedBy,
      totalGmvVnd: Number(p.totalGmvVnd),
      totalRevenueVnd: Number(p.totalRevenueVnd),
      totalCostVnd: Number(p.totalCostVnd),
      grossProfitVnd: Number(p.grossProfitVnd),
      ordersCount: p.ordersCount,
      notes: p.notes,
    }));

    return NextResponse.json({ success: true, periods: formatted });
  } catch (err: any) {
    console.error("[ClosePeriod GET] Lỗi tải danh sách kỳ đóng sổ:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi tải danh sách kỳ đóng sổ." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // BẢO MẬT: Đóng sổ tài chính là hành động tối cao, CHỈ SUPER_ADMIN được phép
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  const adminUsername = guard.username || "admin";

  try {
    const body = await req.json();
    const period = body.period?.trim();
    if (!period) {
      return NextResponse.json({ error: "Vui lòng cung cấp mã kỳ kế toán (định dạng YYYY-MM)." }, { status: 400 });
    }

    const result = await closePeriod(period, adminUsername, body.notes);

    return NextResponse.json({
      success: true,
      message: `Đã chốt sổ kế toán thành công cho kỳ ${period}.`,
      result,
    });
  } catch (err: any) {
    console.error("[ClosePeriod POST] Lỗi chốt sổ kế toán:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi hệ thống khi chốt sổ kế toán." },
      { status: 400 }
    );
  }
}

