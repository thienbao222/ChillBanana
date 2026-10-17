import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";


// POST /api/admin/stitch-all
// Chạy Identity Stitching cho toàn bộ dữ liệu lịch sử trong DB
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  try {
    // Lấy tất cả khách hàng đã đăng ký
    const allCustomers = await prisma.customer.findMany({
      where: { emailVerifiedAt: { not: null } },
      select: { id: true, email: true },
    });

    let totalOrdersStitched = 0;
    let totalSessionsStitched = 0;

    for (const customer of allCustomers) {
      const cleanEmail = customer.email.toLowerCase().trim();
      // Stitch đơn hàng theo email
      const emailOrderUpdate = await prisma.order.updateMany({
        where: { customerEmail: cleanEmail, customerId: null },
        data: { customerId: customer.id, customerType: "REGISTERED" },
      });
      totalOrdersStitched += emailOrderUpdate.count;

      // Stitch chat sessions theo email
      const emailSessionUpdate = await prisma.chatSession.updateMany({
        where: { customerEmail: cleanEmail, customerId: null },
        data: { customerId: customer.id, customerType: "REGISTERED" },
      });
      totalSessionsStitched += emailSessionUpdate.count;

      // BẢO MẬT: Bỏ qua Stitch theo SĐT vì chưa có cơ chế xác minh SMS OTP.
    }

    await writeAuditLog({
      actor: guard.username,
      action: "CUSTOMER_STITCH_ALL",
      summary: `Gán ${totalOrdersStitched} đơn và ${totalSessionsStitched} phiên chat vào tài khoản thành viên.`,
      metadata: { orders: totalOrdersStitched, sessions: totalSessionsStitched, customersProcessed: allCustomers.length },
      req,
    });
    console.log(`[StitchAll] Hoàn thành: ${totalOrdersStitched} đơn + ${totalSessionsStitched} chat đã được gán.`);

    return NextResponse.json({
      success: true,
      message: `Đã hợp nhất thành công: ${totalOrdersStitched} đơn hàng và ${totalSessionsStitched} phiên chat vào tài khoản thành viên tương ứng.`,
      stitched: {
        orders: totalOrdersStitched,
        sessions: totalSessionsStitched,
        customersProcessed: allCustomers.length,
      },
    });
  } catch (error) {
    console.error("[StitchAll] Error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi chạy Identity Stitching." }, { status: 500 });
  }
}
