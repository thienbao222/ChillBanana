import { prisma } from "@/lib/prisma";
import { adminKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS } from "@/lib/gemini-models";

export type ActionItemPriority = "high" | "medium" | "low";

export interface ActionItem {
  id: string;
  priority: ActionItemPriority;
  title: string;
  reason: string;
  aiExplanation?: string;
  orderCodes: string[];
  deepLink: string;
  itemCount: number;
}

export interface ActionRuleInput {
  unverifiedOrders: Array<{ orderCode: string; createdAt: Date; weightKg: number }>;
  pendingDepositOrders: Array<{ orderCode: string; createdAt: Date; reservationExpiresAt: Date | null }>;
  stalledOrders: Array<{ orderCode: string; status: string; daysStalled: number }>;
  failedEmails: Array<{ id: string; orderCode?: string | null; lastErrorCode?: string | null }>;
  maffShipments?: Array<{ trackingCode: string; cargoType: string }>;
}

/**
 * Tính toán danh sách việc cần làm hôm nay bằng QUY TẮC XÁC ĐỊNH (Deterministic Rules).
 * Không phụ thuộc AI, đảm bảo dữ liệu luôn chính xác và có thể kiểm thử độc lập.
 */
export function evaluateActionItemRules(input: ActionRuleInput, now: Date = new Date()): ActionItem[] {
  const items: ActionItem[] = [];

  // Quy tắc 1: Đơn chờ duyệt giá > 4 giờ (Ưu tiên CAO)
  const over4hUnverified = input.unverifiedOrders.filter(
    (o) => now.getTime() - new Date(o.createdAt).getTime() >= 4 * 3600 * 1000
  );
  if (over4hUnverified.length > 0) {
    items.push({
      id: "unverified-over-4h",
      priority: "high",
      title: "Đơn chờ duyệt giá quá 4 giờ",
      reason: `Có ${over4hUnverified.length} đơn hàng chờ xác minh giá quá 4 giờ. Cần kiểm tra giá sàn gốc và duyệt sớm để khách kịp đặt cọc.`,
      orderCodes: over4hUnverified.map((o) => o.orderCode),
      deepLink: "/admin?tab=orders&filter=unverified",
      itemCount: over4hUnverified.length,
    });
  }

  // Quy tắc 2: Đơn chờ cọc sắp hết hạn giữ chỗ trong 24 giờ (Ưu tiên CAO)
  const next24h = new Date(now.getTime() + 24 * 3600 * 1000);
  const expiringDeposits = input.pendingDepositOrders.filter((o) => {
    if (o.reservationExpiresAt) {
      return new Date(o.reservationExpiresAt).getTime() <= next24h.getTime();
    }
    // Nếu không có reservationExpiresAt, coi như quá hạn nếu đã tạo > 48h
    return now.getTime() - new Date(o.createdAt).getTime() >= 48 * 3600 * 1000;
  });
  if (expiringDeposits.length > 0) {
    items.push({
      id: "expiring-reservations",
      priority: "high",
      title: "Đơn chờ cọc sắp hết hạn giữ chỗ",
      reason: `Có ${expiringDeposits.length} đơn hàng sắp hết hạn giữ chỗ trong 24 giờ tới hoặc cần nhắc cọc lần cuối.`,
      orderCodes: expiringDeposits.map((o) => o.orderCode),
      deepLink: "/admin?tab=orders&status=PENDING_DEPOSIT",
      itemCount: expiringDeposits.length,
    });
  }

  // Quy tắc 3: Đơn đứng yên / kẹt ở kho > 3 ngày (Ưu tiên TRUNG BÌNH)
  const stalledOver3d = input.stalledOrders.filter((o) => o.daysStalled >= 3);
  if (stalledOver3d.length > 0) {
    items.push({
      id: "stalled-warehouse-over-3d",
      priority: "medium",
      title: "Đơn kẹt ở kho hoặc đứng yên > 3 ngày",
      reason: `Có ${stalledOver3d.length} đơn hàng chưa có cập nhật tracking hoặc đứng yên tại trạm hơn 3 ngày.`,
      orderCodes: stalledOver3d.map((o) => o.orderCode),
      deepLink: "/admin?tab=orders&view=kanban",
      itemCount: stalledOver3d.length,
    });
  }

  // Quy tắc 4: Email thất bại cần gửi lại (Ưu tiên TRUNG BÌNH)
  if (input.failedEmails.length > 0) {
    const codes = input.failedEmails.map((e) => e.orderCode).filter((c): c is string => Boolean(c));
    items.push({
      id: "failed-emails-retry",
      priority: "medium",
      title: "Email thông báo gửi thất bại cần gửi lại",
      reason: `Có ${input.failedEmails.length} email thông báo (xác nhận cọc, giao hàng, thông báo giá) bị lỗi gửi.`,
      orderCodes: Array.from(new Set(codes)),
      deepLink: "/admin?tab=audit&filter=emails",
      itemCount: input.failedEmails.length,
    });
  }

  // Quy tắc 5: Vận đơn VN→JP có kiểm dịch MAFF (Ưu tiên CAO nếu có)
  if (input.maffShipments && input.maffShipments.length > 0) {
    items.push({
      id: "maff-quarantine-check",
      priority: "high",
      title: "Vận đơn VN→JP cần rà soát kiểm dịch MAFF",
      reason: `Có ${input.maffShipments.length} kiện hàng thực phẩm gửi đi Nhật Bản cần kiểm tra danh mục cấm trước khi xếp chuyến bay.`,
      orderCodes: input.maffShipments.map((s) => s.trackingCode),
      deepLink: "/admin?tab=orders&view=vnjp",
      itemCount: input.maffShipments.length,
    });
  }

  return items;
}

/**
 * Truy vấn cơ sở dữ liệu và sinh danh sách việc cần làm hôm nay kèm lời giải thích ngắn từ AI.
 */
export async function getDailyActionItems(): Promise<ActionItem[]> {
  const now = new Date();
  const activeStatuses = ["PURCHASING_JP", "WAREHOUSE_JP", "IN_TRANSIT_AIR", "WAREHOUSE_VN", "LOCAL_DELIVERY"];

  const [unverifiedOrders, pendingDepositOrders, activeOrders, failedEmails, maffShipments] = await Promise.all([
    prisma.order.findMany({
      where: { isPriceVerified: false, status: { not: "CANCELLED" } },
      select: { orderCode: true, createdAt: true, weightKg: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: { status: "PENDING_DEPOSIT", paymentStatus: "UNPAID" },
      select: { orderCode: true, createdAt: true, reservationExpiresAt: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: { status: { in: activeStatuses } },
      select: {
        orderCode: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        trackingLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      take: 60,
    }),
    prisma.emailLog.findMany({
      where: { status: "FAILED" },
      select: { id: true, lastErrorCode: true, order: { select: { orderCode: true } } },
      take: 30,
    }),
    prisma.vnJpShipment.findMany({
      where: {
        status: { notIn: ["DELIVERED_JP", "CANCELLED"] },
        OR: [{ cargoType: "food" }, { maffAgreement: false }],
      },
      select: { trackingCode: true, cargoType: true },
      take: 20,
    }),
  ]);

  const stalledOrders = activeOrders.map((order) => {
    const lastActivity = order.trackingLogs[0]?.createdAt || order.updatedAt || order.createdAt;
    const daysStalled = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    return {
      orderCode: order.orderCode,
      status: order.status,
      daysStalled,
    };
  });

  const ruleInput: ActionRuleInput = {
    unverifiedOrders,
    pendingDepositOrders,
    stalledOrders,
    failedEmails: failedEmails.map((e) => ({
      id: e.id,
      orderCode: e.order?.orderCode || null,
      lastErrorCode: e.lastErrorCode,
    })),
    maffShipments: maffShipments.map((s) => ({
      trackingCode: s.trackingCode,
      cargoType: s.cargoType,
    })),
  };

  const actionItems = evaluateActionItemRules(ruleInput, now);

  if (actionItems.length === 0) {
    return [];
  }

  // AI chỉ viết lời giải thích ngắn gọn, không quyết định danh sách việc
  const apiKey = adminKeyPool.getNextKey();
  if (apiKey) {
    try {
      const summaryList = actionItems.map((item) => `${item.title}: ${item.reason}`).join("\n");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELS.lightweight}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Dưới đây là các đầu việc vận hành hôm nay của ChillBanana được tính bằng quy tắc hệ thống:
${summaryList}

Hãy viết 1 câu khuyến nghị vận hành ngắn gọn (tối đa 25 từ) cho từng đầu việc.
Trả về định dạng JSON array: [{"title": "tên việc", "explanation": "lời khuyên ngắn"}]`,
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
          }),
          signal: AbortSignal.timeout(3500),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const match = text.match(/\[[\s\S]*?\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) {
            const expMap = new Map<string, string>();
            for (const p of parsed) {
              if (p.title && p.explanation) {
                expMap.set(String(p.title).toLowerCase(), String(p.explanation));
              }
            }
            for (const item of actionItems) {
              for (const [titleKey, exp] of expMap.entries()) {
                if (item.title.toLowerCase().includes(titleKey) || titleKey.includes(item.title.toLowerCase())) {
                  item.aiExplanation = exp;
                  break;
                }
              }
            }
          }
        }
      }
    } catch {
      // Fallback không dùng AI, giữ nguyên reason của rule
    }
  }

  // Đảm bảo aiExplanation có fallback nếu AI không trả lời
  for (const item of actionItems) {
    if (!item.aiExplanation) {
      if (item.id === "unverified-over-4h") {
        item.aiExplanation = "Ưu tiên mở link gốc, kiểm tra phụ phí và xác minh giá để đơn không bị trễ hạn cọc.";
      } else if (item.id === "expiring-reservations") {
        item.aiExplanation = "Liên hệ khách qua Zalo/Email để hỗ trợ thanh toán hoặc hủy giữ chỗ hoàn slot.";
      } else if (item.id === "stalled-warehouse-over-3d") {
        item.aiExplanation = "Kiểm tra với kho Tokyo/Hà Nội để cập nhật cân nặng hoặc đẩy chuyến bay sớm.";
      } else if (item.id === "failed-emails-retry") {
        item.aiExplanation = "Bấm gửi lại trong bảng Email Logs để đảm bảo khách nhận thông báo kịp thời.";
      } else if (item.id === "maff-quarantine-check") {
        item.aiExplanation = "Yêu cầu bưu tá chụp ảnh kiện hàng đối chiếu danh mục cấm MAFF trước khi bay.";
      }
    }
  }

  return actionItems;
}
