import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  try {
    // ================================================================
    // SPRINT 4 — CONVERSION FUNNEL ANALYSIS
    // Đo lường hành trình: Chat → Đơn hàng → Thành viên
    // ================================================================

    // 1. Tổng số phiên chat AI
    const totalChatSessions = await prisma.chatSession.count();

    // 2. Số phiên chat có định danh (không ẩn danh)
    const identifiedSessions = await prisma.chatSession.count({
      where: {
        customerType: { not: "ANONYMOUS_GUEST" },
      },
    });

    // 3. Chat Lead: Khách chat xong để lại email/phone nhưng chưa mua
    const chatLeadSessions = await prisma.chatSession.count({
      where: { customerType: "CHAT_LEAD" },
    });

    // 4. Tổng số đơn hàng
    const totalOrders = await prisma.order.count();

    // 5. Đơn hàng từ khách đã có tài khoản
    const registeredOrders = await prisma.order.count({
      where: { customerType: "REGISTERED" },
    });

    // 6. Đơn hàng từ khách vãng lai
    const guestOrders = await prisma.order.count({
      where: { customerType: "GUEST" },
    });

    // 7. Đơn hàng từ khách trước đây là Chat Lead (có email trong chat)
    // Tìm các đơn có email khớp với email thu thập từ chat session
    const chatLeadEmailsRaw = await prisma.chatSession.findMany({
      where: {
        customerType: "CHAT_LEAD",
        customerEmail: { not: null },
      },
      select: { customerEmail: true },
      distinct: ["customerEmail"],
    });
    const chatLeadEmails = chatLeadEmailsRaw
      .map((s) => s.customerEmail as string)
      .filter(Boolean);

    const ordersFromChatLeads = chatLeadEmails.length > 0
      ? await prisma.order.count({
          where: { customerEmail: { in: chatLeadEmails } },
        })
      : 0;

    // 8. Tổng số khách hàng đã đăng ký
    const totalRegisteredCustomers = await prisma.customer.count();

    // 9. Khách hàng có ít nhất 1 đơn hàng (từng mua)
    const customersWithOrders = await prisma.customer.count({
      where: { orders: { some: {} } },
    });

    // 10. Khách hàng có lịch sử chat (tương tác AI)
    const customersWithChats = await prisma.customer.count({
      where: { chatSessions: { some: {} } },
    });

    // 11. Đơn hàng hoàn thành
    const completedOrders = await prisma.order.count({
      where: { status: "COMPLETED" },
    });

    // 12. Đơn hàng bị hủy
    const cancelledOrders = await prisma.order.count({
      where: { status: "CANCELLED" },
    });

    // 13. Tổng doanh thu (đơn đã cọc/thanh toán, không tính đơn đã hủy)
    const revenueResult = await prisma.order.aggregate({
      where: {
        status: { not: "CANCELLED" },
        paymentStatus: { notIn: ["UNPAID", "REFUNDED"] },
      },
      _sum: { depositAmountVnd: true },
    });
    const totalRevenue = revenueResult._sum.depositAmountVnd || 0;

    // 14. Doanh thu từ khách đăng ký (không tính đơn đã hủy)
    const registeredRevenueResult = await prisma.order.aggregate({
      where: {
        status: { not: "CANCELLED" },
        customerType: "REGISTERED",
        paymentStatus: { notIn: ["UNPAID", "REFUNDED"] },
      },
      _sum: { depositAmountVnd: true },
    });
    const registeredRevenue = registeredRevenueResult._sum.depositAmountVnd || 0;

    // 15. Phễu tỷ lệ chuyển đổi theo bước
    const funnelSteps = [
      {
        step: 1,
        label: "Tổng Khách Ghé Thăm Chat AI",
        description: "Tất cả phiên chat đã lưu trong CSDL",
        count: totalChatSessions,
        percentage: 100,
        color: "slate",
      },
      {
        step: 2,
        label: "Khách Để Lại Thông Tin",
        description: "Chat có email/phone (Identified + Lead)",
        count: identifiedSessions,
        percentage: totalChatSessions > 0 ? Math.round((identifiedSessions / totalChatSessions) * 100) : 0,
        color: "blue",
      },
      {
        step: 3,
        label: "Khách Đặt Hàng",
        description: "Chat Lead chuyển thành đơn hàng thực tế",
        count: ordersFromChatLeads,
        percentage: chatLeadEmails.length > 0 ? Math.round((ordersFromChatLeads / chatLeadEmails.length) * 100) : 0,
        color: "amber",
      },
      {
        step: 4,
        label: "Khách Đăng Ký Tài Khoản",
        description: "Trở thành thành viên chính thức",
        count: totalRegisteredCustomers,
        percentage: totalChatSessions > 0 ? Math.round((totalRegisteredCustomers / totalChatSessions) * 100) : 0,
        color: "emerald",
      },
      {
        step: 5,
        label: "Thành Viên Có Đơn Hàng",
        description: "Thành viên đã mua ít nhất 1 lần",
        count: customersWithOrders,
        percentage: totalRegisteredCustomers > 0 ? Math.round((customersWithOrders / totalRegisteredCustomers) * 100) : 0,
        color: "banana",
      },
    ];

    const customersWithOrderCounts = await prisma.customer.findMany({
      select: { _count: { select: { orders: true } } },
      where: { orders: { some: {} } }
    });
    const repeatCustomers = customersWithOrderCounts.filter(c => c._count.orders >= 2).length;

    // 17. AI Chat → Mua hàng conversion rate (tổng quát)
    const chatToOrderRate = totalChatSessions > 0
      ? ((totalOrders / totalChatSessions) * 100).toFixed(1)
      : "0.0";

    return NextResponse.json({
      success: true,
      funnel: funnelSteps,
      summary: {
        totalChatSessions,
        identifiedSessions,
        chatLeadSessions,
        chatLeadEmails: chatLeadEmails.length,
        ordersFromChatLeads,
        totalOrders,
        registeredOrders,
        guestOrders,
        completedOrders,
        cancelledOrders,
        totalRegisteredCustomers,
        customersWithOrders,
        customersWithChats,
        repeatCustomers,
        totalRevenue,
        registeredRevenue,
        guestRevenue: totalRevenue - registeredRevenue,
        chatToOrderRate: parseFloat(chatToOrderRate),
        orderCompletionRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
        memberConversionRate: totalChatSessions > 0 ? Math.round((totalRegisteredCustomers / totalChatSessions) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("[FUNNEL API] Error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi tải dữ liệu phễu chuyển đổi." }, { status: 500 });
  }
}
