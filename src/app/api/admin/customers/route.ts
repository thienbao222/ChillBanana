import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

function isPaymentRecorded(paymentStatus: string) {
  return paymentStatus === "DEPOSITED_50" || paymentStatus === "PAID_100";
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    // ====== 1. Thành viên đã đăng ký (REGISTERED) ======
    const registeredCustomers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });

    // ====== 2. Tất cả đơn hàng để phân tích ======
    const allOrders = await prisma.order.findMany({
      select: {
        id: true,
        orderCode: true,
        customerEmail: true,
        customerPhone: true,
        customerName: true,
        customerAddress: true,
        totalVnd: true,
        depositAmountVnd: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        customerId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Email & Phone của thành viên đã đăng ký
    const registeredEmails = new Set(registeredCustomers.map((c) => c.email.toLowerCase().trim()));
    const registeredPhones = new Set(
      registeredCustomers.filter((c) => c.phone).map((c) => c.phone!.trim())
    );

    // ====== 3. Khách vãng lai qua đơn hàng (GUEST_ORDER) ======
    const guestOrderMap = new Map<string, any>();
    for (const ord of allOrders) {
      const email = (ord.customerEmail || "").toLowerCase().trim();
      const phone = (ord.customerPhone || "").trim();
      const isRegistered =
        (email && registeredEmails.has(email)) ||
        (phone && registeredPhones.has(phone));
      if (!isRegistered && !ord.customerId) {
        const key = email || phone || ord.customerName;
        if (!guestOrderMap.has(key)) {
          guestOrderMap.set(key, {
            id: `guest-${key}`,
            name: ord.customerName,
            email: ord.customerEmail || "",
            phone: ord.customerPhone || "Chưa cập nhật",
            address: ord.customerAddress || "Chưa cập nhật",
            customerType: "GUEST_ORDER",
            orders: [],
            createdAt: ord.createdAt,
            lastActiveAt: ord.createdAt,
          });
        }
        const guest = guestOrderMap.get(key);
        guest.orders.push(ord);
        if (new Date(ord.createdAt) > new Date(guest.lastActiveAt)) {
          guest.lastActiveAt = ord.createdAt;
        }
      }
    }

    // ====== 4. Chat sessions để làm phong phú dữ liệu ======
    let chatSessions: any[] = [];
    try {
      chatSessions = await prisma.chatSession.findMany({
        include: { messages: { take: 1, orderBy: { createdAt: "asc" } } },
        orderBy: { updatedAt: "desc" },
        take: 200,
      });
    } catch {
      // customerEmail field may not exist yet if migration pending
    }

    // ====== 5. Chat Leads (có email nhưng không phải thành viên hay khách đặt đơn) ======
    const guestEmailsInOrders = new Set(
      Array.from(guestOrderMap.values()).map((g: any) => g.email?.toLowerCase().trim()).filter(Boolean)
    );
    const chatLeadMap = new Map<string, any>();
    for (const session of chatSessions) {
      const sessionEmail = session.customerEmail;
      if (sessionEmail) {
        const email = sessionEmail.toLowerCase().trim();
        if (!registeredEmails.has(email) && !guestEmailsInOrders.has(email)) {
          if (!chatLeadMap.has(email)) {
            chatLeadMap.set(email, {
              id: `chat-${session.id}`,
              name: session.customerName || "Khách Chat Vãng Lai",
              email: sessionEmail,
              phone: session.customerPhone || "Chưa cập nhật",
              address: "Chưa cập nhật",
              customerType: "CHAT_LEAD",
              chatCount: 0,
              lastTopic: session.topic,
              lastSentiment: session.sentiment,
              createdAt: session.createdAt,
              lastActiveAt: session.updatedAt,
            });
          }
          chatLeadMap.get(email).chatCount++;
        }
      }
    }

    const anonymousSessionCount = chatSessions.filter(
      (s) => !s.customerEmail && !s.customerPhone
    ).length;

    // ====== 6. Enrich thành viên đã đăng ký ======
    let totalRevenueVnd = 0;
    let registeredWithOrders = 0;

    const enrichedRegistered = registeredCustomers.map((c) => {
      const cleanEmail = c.email.toLowerCase().trim();
      const cleanPhone = c.phone?.trim() || "";

      const userOrders = allOrders.filter((o) => {
        const oEmail = (o.customerEmail || "").toLowerCase().trim();
        const oPhone = (o.customerPhone || "").trim();
        return (
          (cleanEmail && oEmail === cleanEmail) ||
          (cleanPhone && oPhone === cleanPhone) ||
          o.customerId === c.id
        );
      });

      const orderCount = userOrders.length;
      if (orderCount > 0) registeredWithOrders++;
      const totalSpentVnd = userOrders.reduce(
        (sum, order) => sum + (isPaymentRecorded(order.paymentStatus) ? order.depositAmountVnd || 0 : 0),
        0
      );
      totalRevenueVnd += totalSpentVnd;
      const latestOrder = userOrders[0] || null;

      const memberSessions = chatSessions.filter(
        (s) => s.customerId === c.id || s.customerEmail === c.email
      );

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone || "Chưa cập nhật",
        address: c.address || "Chưa cập nhật",
        customerType: "REGISTERED" as const,
        orderCount,
        totalSpentVnd,
        latestOrderCode: latestOrder?.orderCode || null,
        latestOrderStatus: latestOrder?.status || null,
        latestOrderDate: latestOrder?.createdAt || null,
        chatSessionCount: memberSessions.length,
        lastChatTopic: memberSessions[0]?.topic || null,
        lastActiveAt: latestOrder?.createdAt || memberSessions[0]?.updatedAt || c.createdAt,
        createdAt: c.createdAt,
      };
    });

    // ====== 7. Enrich khách vãng lai đặt đơn ======
    const enrichedGuestOrders = Array.from(guestOrderMap.values()).map((g: any) => {
      const orderCount = g.orders.length;
      const totalSpentVnd = g.orders.reduce(
        (sum: number, order: any) => sum + (isPaymentRecorded(order.paymentStatus) ? order.depositAmountVnd || 0 : 0),
        0
      );
      totalRevenueVnd += totalSpentVnd;
      const latestOrder = g.orders[0] || null;

      const guestSessions = chatSessions.filter(
        (s) => s.customerEmail && s.customerEmail.toLowerCase() === g.email.toLowerCase()
      );

      return {
        id: g.id,
        name: g.name,
        email: g.email,
        phone: g.phone,
        address: g.address,
        customerType: "GUEST_ORDER" as const,
        orderCount,
        totalSpentVnd,
        latestOrderCode: latestOrder?.orderCode || null,
        latestOrderStatus: latestOrder?.status || null,
        latestOrderDate: latestOrder?.createdAt || null,
        chatSessionCount: guestSessions.length,
        lastChatTopic: guestSessions[0]?.topic || null,
        lastActiveAt: g.lastActiveAt,
        createdAt: g.createdAt,
      };
    });

    // ====== 8. Enrich Chat Leads ======
    const enrichedChatLeads = Array.from(chatLeadMap.values()).map((lead: any) => ({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      customerType: "CHAT_LEAD" as const,
      orderCount: 0,
      totalSpentVnd: 0,
      latestOrderCode: null,
      latestOrderStatus: null,
      latestOrderDate: null,
      chatSessionCount: lead.chatCount,
      lastChatTopic: lead.lastTopic,
      lastActiveAt: lead.lastActiveAt,
      createdAt: lead.createdAt,
    }));

    // ====== 9. Gộp & sắp xếp ======
    const allCustomers = [
      ...enrichedRegistered,
      ...enrichedGuestOrders,
      ...enrichedChatLeads,
    ].sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());

    return NextResponse.json({
      success: true,
      customers: allCustomers,
      stats: {
        totalAll: allCustomers.length,
        totalRegistered: enrichedRegistered.length,
        totalGuestOrder: enrichedGuestOrders.length,
        totalChatLead: enrichedChatLeads.length,
        anonymousSessionCount,
        registeredWithOrders,
        totalRevenueVnd,
      },
    });
  } catch (error) {
    console.error("Unified Customers API error:", error);
    return NextResponse.json(
      { error: "Lỗi tải dữ liệu khách hàng hợp nhất từ CSDL." },
      { status: 500 }
    );
  }
}
