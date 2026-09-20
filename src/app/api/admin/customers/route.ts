import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "chillbanana_admin_session";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "chillbanana_secure_admin_salt_2026";

function verifyAdminSession(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie || !cookie.value) return false;

  try {
    const decoded = Buffer.from(cookie.value, "base64").toString("utf-8");
    const [payloadStr, signature] = decoded.split("::");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payloadStr).digest("hex");
    if (signature !== expectedSig) return false;

    const payload = JSON.parse(payloadStr);
    if (payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

// GET: Lấy danh sách toàn bộ khách hàng kèm thống kê đơn hàng
export async function GET(req: NextRequest) {
  try {
    const isAdmin = verifyAdminSession(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 });
    }

    // 1. Lấy danh sách khách hàng từ SQLite
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });

    // 2. Lấy tất cả đơn hàng để map thống kê
    const orders = await prisma.order.findMany({
      select: {
        id: true,
        orderCode: true,
        customerEmail: true,
        customerPhone: true,
        totalVnd: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let totalRevenueVnd = 0;
    let customersWithOrders = 0;

    const enrichedCustomers = customers.map((c) => {
      const cleanEmail = c.email.toLowerCase().trim();
      const cleanPhone = c.phone ? c.phone.trim() : "";

      const userOrders = orders.filter((o) => {
        const orderEmail = (o.customerEmail || "").toLowerCase().trim();
        const orderPhone = (o.customerPhone || "").trim();
        return (cleanEmail && orderEmail === cleanEmail) || (cleanPhone && orderPhone === cleanPhone);
      });

      const orderCount = userOrders.length;
      if (orderCount > 0) customersWithOrders++;

      const totalSpentVnd = userOrders.reduce((sum, o) => sum + (o.totalVnd || 0), 0);
      totalRevenueVnd += totalSpentVnd;

      const latestOrder = userOrders[0] || null;

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone || "Chưa cập nhật",
        address: c.address || "Chưa cập nhật",
        orderCount,
        totalSpentVnd,
        latestOrderCode: latestOrder ? latestOrder.orderCode : null,
        latestOrderStatus: latestOrder ? latestOrder.status : null,
        latestOrderDate: latestOrder ? latestOrder.createdAt : null,
        createdAt: c.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      customers: enrichedCustomers,
      stats: {
        totalCustomers: customers.length,
        customersWithOrders,
        totalRevenueVnd,
      },
    });
  } catch (error) {
    console.error("Admin Customers API error:", error);
    return NextResponse.json(
      { error: "Lỗi tải danh sách khách hàng từ CSDL." },
      { status: 500 }
    );
  }
}
