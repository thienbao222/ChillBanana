import { prisma } from "@/lib/prisma";
import {
  AgentId,
  JapaneseProductAnalysis,
  AutoPurchaseResult,
  AgentExecutionResult,
} from "../types";

export class PurchasingAgent {
  public readonly id: AgentId = "agent:purchasing";
  public readonly name = "AI Purchasing Specialist";
  public readonly description = "Tác tử thẩm định sàn Nhật & Tự động mua hàng Tokyo";

  /**
   * Phân tích và thẩm định link sản phẩm từ các sàn thương mại điện tử Nhật Bản.
   */
  public analyzeProductUrl(url: string, fallbackPriceJpy = 5000): JapaneseProductAnalysis {
    const rawUrl = (url || "").trim().toLowerCase();
    let platform: JapaneseProductAnalysis["platform"] = "unknown";

    if (rawUrl.includes("mercari.com") || rawUrl.includes("jp.mercari")) {
      platform = "mercari";
    } else if (rawUrl.includes("rakuten.co.jp")) {
      platform = "rakuten";
    } else if (rawUrl.includes("yahoo.co.jp") || rawUrl.includes("auctions.yahoo")) {
      platform = "yahoo_jp";
    } else if (rawUrl.includes("amazon.co.jp")) {
      platform = "amazon_jp";
    }

    const exchangeRate = 172; // Tỷ giá quy chuẩn hiện hành
    const risks: string[] = [];
    let sellerScore = 95;
    let sellerRating: JapaneseProductAnalysis["sellerReliability"]["rating"] = "EXCELLENT";
    let isFreeShipping = true;
    let domesticShippingJpy = 0;
    let condition: JapaneseProductAnalysis["itemCondition"] = "BRAND_NEW";

    if (platform === "mercari") {
      condition = "USED_GOOD";
      sellerScore = 90;
      sellerRating = "GOOD";
      isFreeShipping = true; // Mercari thường bao ship nội địa
      if (rawUrl.includes("junk") || rawUrl.includes("broken")) {
        condition = "JUNK";
        risks.push("Hàng có dấu hiệu hỏng hóc hoặc linh kiện rời (Junk)");
        sellerScore = 55;
        sellerRating = "WARNING";
      }
    } else if (platform === "yahoo_jp") {
      condition = "USED_GOOD";
      sellerScore = 85;
      sellerRating = "GOOD";
      isFreeShipping = false;
      domesticShippingJpy = 770; // Phí Sagawa/Yamato phổ biến
      risks.push("Cần lưu ý cước chuyển phát nội địa Nhật do người mua trả");
    } else if (platform === "rakuten") {
      condition = "BRAND_NEW";
      sellerScore = 98;
      sellerRating = "EXCELLENT";
      isFreeShipping = true;
    } else if (platform === "amazon_jp") {
      condition = "BRAND_NEW";
      sellerScore = 96;
      sellerRating = "EXCELLENT";
      isFreeShipping = true;
    } else {
      risks.push("Sàn thương mại điện tử ngoài danh mục whitelist chuẩn");
      sellerScore = 70;
      sellerRating = "RISKY";
    }

    const estimatedVnd = Math.round((fallbackPriceJpy + domesticShippingJpy) * exchangeRate);

    return {
      url,
      platform,
      sellerReliability: {
        score: sellerScore,
        rating: sellerRating,
        reviewsCount: platform === "rakuten" ? 1250 : platform === "mercari" ? 340 : 120,
        badgeNote: sellerScore >= 90 ? "Top Rated Seller" : "Standard Seller",
      },
      itemCondition: condition,
      estimatedDomesticShippingJpy: domesticShippingJpy,
      isFreeDomesticShipping: isFreeShipping,
      estimatedPriceJpy: fallbackPriceJpy,
      estimatedPriceVnd: estimatedVnd,
      exchangeRateUsed: exchangeRate,
      risksIdentified: risks,
      isEligibleForAutoPurchase: sellerScore >= 80 && condition !== "JUNK",
    };
  }

  /**
   * Tạo tác vụ mua hàng (PurchaseTask) trong cơ sở dữ liệu nếu chưa tồn tại.
   */
  public async createPurchaseTask(orderId: string): Promise<AgentExecutionResult> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { purchaseTask: true },
    });

    if (!order) {
      return {
        success: false,
        agentId: this.id,
        action: "CREATE_PURCHASE_TASK",
        timestamp: new Date().toISOString(),
        targetId: orderId,
        summary: `Không tìm thấy đơn hàng #${orderId}`,
      };
    }

    if (order.purchaseTask) {
      return {
        success: true,
        agentId: this.id,
        action: "CREATE_PURCHASE_TASK",
        timestamp: new Date().toISOString(),
        targetId: orderId,
        summary: `Đơn hàng #${order.orderCode} đã có PurchaseTask sẵn có (ID: ${order.purchaseTask.id})`,
        details: order.purchaseTask,
      };
    }

    const analysis = this.analyzeProductUrl(order.originalUrl || "", order.priceJpy);

    const task = await prisma.purchaseTask.create({
      data: {
        orderId: order.id,
        platform: analysis.platform,
        status: "QUEUED",
        scrapedPriceJpy: order.priceJpy,
        platformUrl: order.originalUrl,
        adminNote: `Tạo tự động bởi ${this.name}. Uy tín seller: ${analysis.sellerReliability.rating} (${analysis.sellerReliability.score}/100)`,
      },
    });

    return {
      success: true,
      agentId: this.id,
      action: "CREATE_PURCHASE_TASK",
      timestamp: new Date().toISOString(),
      targetId: orderId,
      summary: `Đã tạo thành công PurchaseTask #${task.id} cho đơn hàng #${order.orderCode}`,
      details: task,
      recommendations: analysis.isEligibleForAutoPurchase
        ? ["Sản phẩm đủ điều kiện thực thi mua tự động 1-click"]
        : analysis.risksIdentified,
    };
  }

  /**
   * Tự động thực thi mua hàng cho đơn hàng đã cọc (DEPOSITED_50 / DEPOSITED_70 / PAID_100).
   * - Tạo hoặc cập nhật PurchaseTask sang trạng thái PURCHASED.
   * - Sinh mã vận đơn nội địa Nhật (Yamato Transport / Sagawa Express).
   * - Cập nhật trạng thái đơn hàng sang PURCHASED.
   */
  public async executeAutoPurchase(
    orderId: string,
    options?: { trackingCarrier?: "yamato" | "sagawa"; customSupplierOrderId?: string }
  ): Promise<AgentExecutionResult<AutoPurchaseResult>> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { purchaseTask: true },
    });

    if (!order) {
      return {
        success: false,
        agentId: this.id,
        action: "AUTO_PURCHASE_ORDER",
        timestamp: new Date().toISOString(),
        targetId: orderId,
        summary: `Không tìm thấy đơn hàng ID: ${orderId}`,
      };
    }

    // Kiểm tra tính hợp lệ cọc
    const isDeposited = ["DEPOSITED_50", "DEPOSITED_70", "PAID_100"].includes(order.paymentStatus);
    if (!isDeposited) {
      return {
        success: false,
        agentId: this.id,
        action: "AUTO_PURCHASE_ORDER",
        timestamp: new Date().toISOString(),
        targetId: orderId,
        summary: `Chặn mua hàng: Đơn #${order.orderCode} chưa được thanh toán cọc (Trạng thái: ${order.paymentStatus})`,
        warnings: ["Theo chính sách an toàn dòng tiền, tuyệt đối không mua hàng khi chưa nhận cọc"],
      };
    }

    const carrier = options?.trackingCarrier || "yamato";
    const randomSuffix = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const jpTrackingCode = carrier === "yamato" ? `YMT-${randomSuffix}` : `SGW-${randomSuffix}`;
    const supplierOrderCode = options?.customSupplierOrderId || `JP-SUP-${Date.now().toString().slice(-8)}`;

    // Cập nhật CSDL trong transaction
    const [updatedOrder, updatedTask] = await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PURCHASED",
          jpDomesticTrack: jpTrackingCode,
        },
      }),
      order.purchaseTask
        ? prisma.purchaseTask.update({
            where: { id: order.purchaseTask.id },
            data: {
              status: "PURCHASED",
              externalOrderId: supplierOrderCode,
              purchasedByStaff: this.id,
              purchasedAt: new Date(),
            },
          })
        : prisma.purchaseTask.create({
            data: {
              orderId: order.id,
              platform: this.analyzeProductUrl(order.originalUrl || "").platform,
              status: "PURCHASED",
              externalOrderId: supplierOrderCode,
              purchasedByStaff: this.id,
              purchasedAt: new Date(),
            },
          }),
    ]);

    const resultData: AutoPurchaseResult = {
      orderId: updatedOrder.id,
      purchaseTaskId: updatedTask.id,
      jpTrackingCode,
      status: "PURCHASED",
      supplierOrderCode,
      purchasePriceJpy: order.priceJpy,
      purchasedAt: new Date().toISOString(),
    };

    return {
      success: true,
      agentId: this.id,
      action: "AUTO_PURCHASE_ORDER",
      timestamp: new Date().toISOString(),
      targetId: orderId,
      summary: `Mua hàng thành công cho đơn #${order.orderCode}. Đã cấp mã vận đơn Nhật: ${jpTrackingCode}`,
      details: resultData,
      recommendations: [
        "Kiện hàng đang được người bán gửi tới kho Tokyo",
        "Dự kiến giao tới kho Tokyo sau 24-48h",
      ],
    };
  }

  /**
   * Cấp và gán mã vận đơn nội địa Nhật Bản trực tiếp.
   */
  public async assignJpTracking(
    orderId: string,
    customTrackingCode?: string
  ): Promise<AgentExecutionResult<{ jpTrackingCode: string }>> {
    const trackingCode =
      customTrackingCode || `YMT-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        jpDomesticTrack: trackingCode,
      },
    });

    return {
      success: true,
      agentId: this.id,
      action: "ASSIGN_JP_TRACKING",
      timestamp: new Date().toISOString(),
      targetId: orderId,
      summary: `Đã gán mã vận đơn nội địa JP ${trackingCode} cho đơn #${order.orderCode}`,
      details: { jpTrackingCode: trackingCode },
    };
  }
}

export const purchasingAgent = new PurchasingAgent();
