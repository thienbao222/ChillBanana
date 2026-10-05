import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "chillbanana_admin_session";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "chillbanana_secure_admin_salt_2026";

function verifyAdmin(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return false;
  try {
    const decoded = Buffer.from(cookie.value, "base64").toString("utf-8");
    const [payloadStr, signature] = decoded.split("::");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payloadStr).digest("hex");
    if (signature !== expectedSig) return false;
    const payload = JSON.parse(payloadStr);
    return payload.exp > Date.now();
  } catch { return false; }
}

// POST /api/admin/stitch-all
// Chạy Identity Stitching cho toàn bộ dữ liệu lịch sử trong DB
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  try {
    // Lấy tất cả khách hàng đã đăng ký
    const allCustomers = await prisma.customer.findMany({
      select: { id: true, email: true, phone: true },
    });

    let totalOrdersStitched = 0;
    let totalSessionsStitched = 0;

    for (const customer of allCustomers) {
      const cleanEmail = customer.email.toLowerCase().trim();
      const cleanPhone = customer.phone?.trim() || null;

      // Stitch đơn hàng theo email
      const emailOrderUpdate = await prisma.order.updateMany({
        where: { customerEmail: cleanEmail, customerId: null },
        data: { customerId: customer.id, customerType: "REGISTERED" },
      });
      totalOrdersStitched += emailOrderUpdate.count;

      // Stitch đơn hàng theo phone
      if (cleanPhone) {
        const phoneOrderUpdate = await prisma.order.updateMany({
          where: { customerPhone: cleanPhone, customerId: null },
          data: { customerId: customer.id, customerType: "REGISTERED" },
        });
        totalOrdersStitched += phoneOrderUpdate.count;
      }

      // Stitch chat sessions theo email
      const emailSessionUpdate = await prisma.chatSession.updateMany({
        where: { customerEmail: cleanEmail, customerId: null },
        data: { customerId: customer.id, customerType: "REGISTERED" },
      });
      totalSessionsStitched += emailSessionUpdate.count;

      // Stitch chat sessions theo phone
      if (cleanPhone) {
        const phoneSessionUpdate = await prisma.chatSession.updateMany({
          where: { customerPhone: cleanPhone, customerId: null },
          data: { customerId: customer.id, customerType: "REGISTERED" },
        });
        totalSessionsStitched += phoneSessionUpdate.count;
      }
    }

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
