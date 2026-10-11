import { prisma } from "@/lib/prisma";
import { recentVietnamDateKeys, vietnamDateKey, vietnamDayStart } from "@/lib/vietnam-time";
import { ADMIN_AI_MODULES } from "@/lib/admin-ai/definitions";
import type { AdminAiModuleId } from "@/lib/admin-ai/definitions";
export { ADMIN_AI_MODULES } from "@/lib/admin-ai/definitions";
export type { AdminAiModuleId } from "@/lib/admin-ai/definitions";

function windowForDays(days: number) {
  const dateKeys = recentVietnamDateKeys(days);
  return {
    from: vietnamDayStart(dateKeys[0]),
    toDate: dateKeys[dateKeys.length - 1],
  };
}

async function getChatTagSummary(since: Date) {
  const where = { createdAt: { gte: since } };
  const [sessionCount, topicGroups, keywordGroups] = await Promise.all([
    prisma.chatSession.count({ where }),
    prisma.chatSession.groupBy({ by: ["topic"], where, _count: { _all: true } }),
    prisma.chatSession.groupBy({ by: ["detectedKeywords"], where, _count: { _all: true } }),
  ]);
  const keywordCounts = new Map<string, number>();
  for (const group of keywordGroups) {
    for (const keyword of (group.detectedKeywords || "").split(",")) {
      const clean = keyword.trim().slice(0, 80);
      if (clean) keywordCounts.set(clean, (keywordCounts.get(clean) || 0) + group._count._all);
    }
  }
  return {
    sessionCount,
    topics: topicGroups.map((group) => [group.topic || "Chưa phân loại", group._count._all] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 12),
    recordedKeywords: Array.from(keywordCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12),
  };
}

async function buildOverviewSnapshot() {
  return { ...(await buildReportsSnapshot()), scope: "overview" };
}

async function buildReportsSnapshot() {
  const current = windowForDays(30);
  const previous = windowForDays(60);
  if (!current.from || !previous.from) throw new Error("Không thể tạo khoảng ngày báo cáo.");

  const [orders, previousOrders] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: current.from }, status: { not: "CANCELLED" } },
      select: { productName: true, category: true, totalVnd: true, depositAmountVnd: true, paymentStatus: true, status: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: previous.from, lt: current.from }, status: { not: "CANCELLED" } },
      select: { totalVnd: true, depositAmountVnd: true, paymentStatus: true, status: true },
    }),
  ]);

  const summarize = (rows: { totalVnd: number; depositAmountVnd: number; paymentStatus: string; status: string }[]) => ({
    orderCount: rows.length,
    paidOrderCount: rows.filter((o) => o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED").length,
    actualRevenueVnd: rows.reduce((sum, o) => sum + (o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED" ? o.depositAmountVnd : 0), 0),
    estimatedOrderValueVnd: rows.reduce((sum, o) => sum + o.totalVnd, 0),
    completedOrderCount: rows.filter((o) => o.status === "COMPLETED").length,
    activeOrderCount: rows.filter((o) => o.status !== "COMPLETED").length,
  });

  const productCounts = new Map<string, { category: string; orders: number; collectedVnd: number }>();
  const categoryCounts = new Map<string, { orders: number; collectedVnd: number }>();
  const daily = new Map<string, { orders: number; collectedVnd: number }>();
  for (const order of orders) {
    const paid = order.paymentStatus !== "UNPAID" && order.paymentStatus !== "REFUNDED";
    const productName = order.productName.trim().slice(0, 100) || "Chưa rõ sản phẩm";
    const product = productCounts.get(productName) || { category: order.category, orders: 0, collectedVnd: 0 };
    product.orders++;
    if (paid) product.collectedVnd += order.depositAmountVnd;
    productCounts.set(productName, product);
    const category = categoryCounts.get(order.category) || { orders: 0, collectedVnd: 0 };
    category.orders++;
    if (paid) category.collectedVnd += order.depositAmountVnd;
    categoryCounts.set(order.category, category);
    const date = vietnamDateKey(order.createdAt);
    const day = daily.get(date) || { orders: 0, collectedVnd: 0 };
    day.orders++;
    if (paid) day.collectedVnd += order.depositAmountVnd;
    daily.set(date, day);
  }

  const now = new Date();
  const [chatSummary, customerCount, catalogProductCount, catalogSlots, hotProducts] = await Promise.all([
    getChatTagSummary(current.from),
    prisma.customer.count(),
    prisma.product.count(),
    prisma.product.aggregate({ _sum: { stockSlots: true } }),
    prisma.product.findMany({ where: { isHot: true }, select: { name: true }, take: 10 }),
  ]);
  const [totalChatSessions, identifiedChatSessions, chatLeadSessions, chatLeadEmails, customersWithOrders, ordersByCustomerType] = await Promise.all([
    prisma.chatSession.count(),
    prisma.chatSession.count({ where: { customerType: { not: "ANONYMOUS_GUEST" } } }),
    prisma.chatSession.count({ where: { customerType: "CHAT_LEAD" } }),
    prisma.chatSession.findMany({ where: { customerType: "CHAT_LEAD", customerEmail: { not: null } }, select: { customerEmail: true }, distinct: ["customerEmail"] }),
    prisma.customer.count({ where: { orders: { some: {} } } }),
    prisma.order.groupBy({ by: ["customerType"], _count: { _all: true } }),
  ]);
  const attributedChatLeadOrders = chatLeadEmails.length
    ? await prisma.order.count({ where: { customerEmail: { in: chatLeadEmails.map((session) => session.customerEmail!).filter(Boolean) } } })
    : 0;
  const products = Array.from(productCounts.entries()).map(([name, values]) => ({ name, ...values })).sort((a, b) => b.orders - a.orders).slice(0, 10);
  return {
    scope: "overview",
    dataAsOf: now.toISOString(),
    period: { current: `${current.toDate} trở về 30 ngày`, previous: "30 ngày liền trước" },
    report: { current30Days: summarize(orders), previous30Days: summarize(previousOrders) },
    topProductsByOrders: products,
    categories: Array.from(categoryCounts.entries()).map(([category, value]) => ({ category, ...value })),
    orderCreationByDay: Array.from(daily.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, ...value })),
    customerAndChat: {
      registeredCustomersAllTime: customerCount,
      chatSessionsLast30Days: chatSummary.sessionCount,
      topicsLast30Days: chatSummary.topics.slice(0, 8),
      recordedKeywordsLast30Days: chatSummary.recordedKeywords.slice(0, 10),
      allTimeFunnelCounts: {
        totalChatSessions,
        identifiedChatSessions,
        chatLeadSessions,
        distinctChatLeadEmails: chatLeadEmails.length,
        ordersMatchedToChatLeadEmail: attributedChatLeadOrders,
        customersWithOrders,
        ordersByCustomerType: ordersByCustomerType.map((item) => ({ customerType: item.customerType, count: item._count._all })),
        note: "Phễu dùng số phiên, không phải người duy nhất; quy kết Chat Lead dựa trên email khớp đơn và chỉ cho biết liên hệ dữ liệu, không chứng minh chat tạo ra đơn.",
      },
      note: "Chủ đề và từ khóa là tag được hệ thống lưu, không đại diện toàn thị trường và không phải số lượt tìm kiếm độc lập.",
    },
    catalog: {
      listedProductCount: catalogProductCount,
      totalListedSlots: catalogSlots._sum.stockSlots || 0,
      hotProducts: hotProducts.map((product) => product.name.slice(0, 100)),
      note: "stockSlots là số suất hiển thị trên website, không phải số lượng hàng vật lý trong kho.",
    },
  };
}

async function buildTrendsSnapshot() {
  const period = windowForDays(30);
  if (!period.from) throw new Error("Không thể tạo khoảng ngày xu hướng.");
  const where = { createdAt: { gte: period.from } };
  const [tagSummary, sentimentGroups, customerGroups] = await Promise.all([
    getChatTagSummary(period.from),
    prisma.chatSession.groupBy({ by: ["sentiment"], where, _count: { _all: true } }),
    prisma.chatSession.groupBy({ by: ["customerType"], where, _count: { _all: true } }),
  ]);
  return {
    scope: "trends",
    dataAsOf: new Date().toISOString(),
    period: `${period.toDate} trở về 30 ngày`,
    chatSessionCount: tagSummary.sessionCount,
    topics: tagSummary.topics,
    recordedKeywords: tagSummary.recordedKeywords,
    sentimentTags: sentimentGroups.map((group) => [group.sentiment || "Chưa phân loại", group._count._all]),
    customerTypes: customerGroups.map((group) => [group.customerType || "ANONYMOUS_GUEST", group._count._all]),
    limitations: [
      "Đây là tag và phiên chat đã ghi trong website; dữ liệu có thể thiếu tag hoặc bị phân loại chưa chính xác.",
      "Không có nội dung hội thoại, email, tên, số điện thoại hay IP được gửi cho mô hình.",
      "Số phiên không đồng nghĩa số người duy nhất; không suy rộng thành xu hướng toàn thị trường.",
    ],
  };
}

async function buildOrdersSnapshot() {
  const period = windowForDays(30);
  const now = new Date();
  const activeWhere = { status: { notIn: ["COMPLETED", "CANCELLED"] } };
  const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [orders, total, activeCount, statusGroups, oldPendingCount, unverifiedPriceCount, oldActiveCount] = await Promise.all([
    prisma.order.findMany({
      where: activeWhere,
      select: { status: true, paymentStatus: true, isPriceVerified: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
    prisma.order.count(),
    prisma.order.count({ where: activeWhere }),
    prisma.order.groupBy({ by: ["status"], where: activeWhere, _count: { _all: true } }),
    prisma.order.count({ where: { status: "PENDING_DEPOSIT", paymentStatus: "UNPAID", createdAt: { lt: threeDaysAgo } } }),
    prisma.order.count({ where: { status: "PENDING_DEPOSIT", isPriceVerified: false } }),
    prisma.order.count({ where: { ...activeWhere, createdAt: { lt: sevenDaysAgo } } }),
  ]);
  const ageInDays = (createdAt: Date) => Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000);
  return {
    scope: "orders",
    dataAsOf: now.toISOString(),
    activeOrderCount: activeCount,
    totalOrderCountAllTime: total,
    byStatus: statusGroups.map((group) => ({ status: group.status, count: group._count._all })),
    pendingDepositOlderThan3Days: oldPendingCount,
    priceNotVerified: unverifiedPriceCount,
    activeOlderThan7Days: oldActiveCount,
    oldestActiveOrders: orders.slice(0, 8).map((order, index) => ({ rank: index + 1, status: order.status, ageDays: ageInDays(order.createdAt), paymentStatus: order.paymentStatus })),
    periodStart: period.toDate,
    note: "Các chỉ số đếm được truy vấn trên toàn bộ đơn; danh sách chi tiết chỉ gồm trạng thái/tuổi của 8 đơn đang mở lâu nhất, không kèm mã đơn hay thông tin nhận dạng khách.",
  };
}

async function buildProductsSnapshot() {
  const since = windowForDays(30).from;
  const [listedProductCount, listedSlots, fewSlotCount, fewSlotProducts, hotProducts, orderGroups] = await Promise.all([
    prisma.product.count(),
    prisma.product.aggregate({ _sum: { stockSlots: true } }),
    prisma.product.count({ where: { stockSlots: { lte: 2 } } }),
    prisma.product.findMany({ where: { stockSlots: { lte: 2 } }, select: { name: true, categoryName: true, stockSlots: true }, take: 20, orderBy: { stockSlots: "asc" } }),
    prisma.product.findMany({ where: { isHot: true }, select: { name: true, stockSlots: true, featuredNote: true }, take: 15 }),
    prisma.order.groupBy({
      by: ["productName"],
      where: { status: { not: "CANCELLED" }, ...(since ? { createdAt: { gte: since } } : {}) },
      _count: { _all: true },
      orderBy: { _count: { productName: "desc" } },
      take: 20,
    }),
  ]);
  return {
    scope: "products",
    dataAsOf: new Date().toISOString(),
    listedProductCount,
    totalListedSlots: listedSlots._sum.stockSlots || 0,
    fewListedSlotProductCount: fewSlotCount,
    productsWithFewListedSlots: fewSlotProducts.map((product) => ({ name: product.name.slice(0, 100), listedSlots: product.stockSlots, category: product.categoryName })),
    hotProducts: hotProducts.map((product) => ({ name: product.name.slice(0, 100), listedSlots: product.stockSlots, note: (product.featuredNote || "").slice(0, 160) })),
    mostOrderedNamesLast30Days: orderGroups.map((item) => ({ name: item.productName.slice(0, 100), orders: item._count._all })),
    note: "stockSlots là số suất hiển thị/còn cho phép đặt trên website, không khẳng định tồn kho vật lý. Top mặt hàng đơn hàng được nhóm theo tên tự do, có thể trùng/khác cách viết với catalog.",
  };
}

async function buildCustomersSnapshot() {
  const period = windowForDays(30);
  if (!period.from) throw new Error("Không thể tạo khoảng ngày khách hàng.");
  const [totalCustomers, newCustomers, chatTypes, orderTypes, verifiedCustomers] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: { gte: period.from } } }),
    prisma.chatSession.groupBy({ by: ["customerType"], where: { createdAt: { gte: period.from } }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["customerType"], where: { createdAt: { gte: period.from }, status: { not: "CANCELLED" } }, _count: { _all: true } }),
    prisma.customer.count({ where: { emailVerifiedAt: { not: null } } }),
  ]);
  return {
    scope: "customers",
    dataAsOf: new Date().toISOString(),
    period: `${period.toDate} trở về 30 ngày`,
    registeredCustomersAllTime: totalCustomers,
    emailVerifiedCustomersAllTime: verifiedCustomers,
    newRegisteredCustomersLast30Days: newCustomers,
    chatSessionsByCustomerTypeLast30Days: chatTypes.map((item) => ({ customerType: item.customerType, count: item._count._all })),
    ordersByCustomerTypeLast30Days: orderTypes.map((item) => ({ customerType: item.customerType, count: item._count._all })),
    note: "Chỉ cung cấp số liệu tổng hợp; không gửi thông tin nhận dạng cá nhân cho mô hình.",
  };
}

const moduleBuilders: Record<AdminAiModuleId, () => Promise<unknown>> = {
  overview: buildOverviewSnapshot,
  reports: buildReportsSnapshot,
  trends: buildTrendsSnapshot,
  orders: buildOrdersSnapshot,
  products: buildProductsSnapshot,
  customers: buildCustomersSnapshot,
};

export function isAdminAiModuleId(value: unknown): value is AdminAiModuleId {
  return typeof value === "string" && ADMIN_AI_MODULES.some((module) => module.id === value);
}

export function getAdminAiModuleSnapshot(moduleId: AdminAiModuleId) {
  return moduleBuilders[moduleId]();
}
