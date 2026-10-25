// FILE: src/app/api/admin/ai-analytics/route.ts
// API Phân tích & Báo cáo Quản trị Toàn diện 2 Chiều (JP ➔ VN và VN ➔ JP) cho Admin AI Copilot.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { adminKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS, getFeatureModels } from "@/lib/gemini-models";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);

    const [
      totalOrders,
      ordersByStatus,
      jpVnRevenueAgg,
      totalVnJpShipments,
      vnJpByStatus,
      vnJpRevenueAgg,
      inFlightShipments,
      unpaidShipmentsCount,
      pendingDepositOver3DaysCount,
      unverifiedPriceCount,
      unweighedOrdersCount,
      purchasingJpCount,
      hotLeadsCount,
      stuckChatSessionsCount,
      lowSlotProductsCount,
      totalCustomersCount,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.order.aggregate({
        where: { paymentStatus: { in: ["DEPOSITED_50", "PAID_100"] } },
        _sum: { depositAmountVnd: true, totalVnd: true },
      }),
      prisma.vnJpShipment.count(),
      prisma.vnJpShipment.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.vnJpShipment.aggregate({
        where: { paymentStatus: "PAID" },
        _sum: { totalShippingFeeVnd: true, chargeableWeightKg: true },
      }),
      prisma.vnJpShipment.count({ where: { status: "IN_FLIGHT_TO_JP" } }),
      prisma.vnJpShipment.count({ where: { paymentStatus: "UNPAID", status: { not: "CANCELLED" } } }),
      prisma.order.count({ where: { status: "PENDING_DEPOSIT", createdAt: { lt: threeDaysAgo } } }),
      prisma.order.count({ where: { status: "PENDING_DEPOSIT", isPriceVerified: false } }),
      prisma.order.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, weightKg: { lte: 0 } } }),
      prisma.order.count({ where: { status: "PURCHASING_JP" } }),
      prisma.chatSession.count({ where: { customerType: "CHAT_LEAD" } }),
      prisma.chatSession.count({ where: { sentiment: "complaint" } }),
      prisma.product.count({ where: { stockSlots: { lte: 2 } } }),
      prisma.customer.count(),
    ]);

    const jpVnRevenue = jpVnRevenueAgg._sum.depositAmountVnd || 0;
    const vnJpRevenue = vnJpRevenueAgg._sum.totalShippingFeeVnd || 0;
    const totalSystemRevenue = jpVnRevenue + vnJpRevenue;

    const vnJpCounts: Record<string, number> = {
      PENDING_CONFIRMATION: 0,
      CONFIRMED_PICKUP: 0,
      WAREHOUSE_VN_INSPECTED: 0,
      IN_FLIGHT_TO_JP: 0,
      DELIVERED_JP: 0,
      CANCELLED: 0,
    };
    vnJpByStatus.forEach((sc) => {
      vnJpCounts[sc.status] = sc._count._all;
    });

    const analyticsData = {
      generatedAt: new Date().toISOString(),
      overview: {
        totalSystemRevenueVnd: totalSystemRevenue,
        jpVnCollectedRevenueVnd: jpVnRevenue,
        vnJpCollectedRevenueVnd: vnJpRevenue,
        totalOrdersAllTime: totalOrders + totalVnJpShipments,
      },
      operationalAlerts: {
        orders: {
          pendingDepositOver3Days: pendingDepositOver3DaysCount,
          unverifiedPrice: unverifiedPriceCount,
          purchasingJp: purchasingJpCount,
          unweighedOrders: unweighedOrdersCount,
        },
        customersAndLeads: {
          hotLeads: hotLeadsCount,
          stuckSessions: stuckChatSessionsCount,
          totalCustomers: totalCustomersCount,
        },
        products: {
          lowSlots: lowSlotProductsCount,
        },
      },
      jpToVnForwarding: {
        totalOrders,
        statusBreakdown: ordersByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      },
      vnToJpCargoSubsystem: {
        totalShipments: totalVnJpShipments,
        inFlightCount: inFlightShipments,
        unpaidCount: unpaidShipmentsCount,
        paidRevenueVnd: vnJpRevenue,
        paidWeightKg: vnJpRevenueAgg._sum.chargeableWeightKg || 0,
        statusBreakdown: vnJpCounts,
      },
    };

    // Tạo tóm tắt phân tích bằng AI nếu có API Key
    let aiSummary = `Hệ thống ghi nhận tổng doanh thu 2 chiều đạt ${totalSystemRevenue.toLocaleString("vi-VN")} đ. Tuyến gửi hàng đi Nhật (VN ➔ JP) có ${totalVnJpShipments} vận đơn, trong đó ${inFlightShipments} kiện đang bay quốc tế và ${unpaidShipmentsCount} kiện đang chờ thu cước.`;

    const prompt = `Bạn là Trợ lý Giám đốc Vận hành ChillBanana. Hãy nhận xét ngắn gọn (3-4 gạch đầu dòng) về bức tranh vận hành logistics 2 chiều Việt - Nhật dựa trên số liệu sau:\n${JSON.stringify(analyticsData, null, 2)}`;
    const models = typeof getFeatureModels === "function"
      ? getFeatureModels("admin")
      : [GEMINI_MODELS.admin, GEMINI_MODELS.neoFallback, GEMINI_MODELS.lightweight];

    for (const model of models) {
      const apiKey = adminKeyPool.getNextKey(model);
      if (!apiKey) {
        console.warn(`[AIAnalytics] No available API key for model ${model}, skipping.`);
        continue;
      }

      let responseStatus: number | null = null;
      try {
        let response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                thinkingConfig: { thinkingLevel: "low" },
              },
            }),
            signal: AbortSignal.timeout(8000),
          }
        );
        responseStatus = response.status;

        if (response.status === 429) {
          const errorBody = await response.text().catch(() => "");
          const retryAfter = response.headers.get("retry-after") ?? undefined;
          console.warn(`[AIAnalytics] Model ${model} HTTP 429: ${errorBody.slice(0, 200)}`);
          adminKeyPool.markModelError(apiKey, model, 429, errorBody, retryAfter);
          continue;
        }

        if (response.status === 401 || response.status === 403) {
          const errorBody = await response.text().catch(() => "");
          console.warn(`[AIAnalytics] Model ${model} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
          adminKeyPool.markError(apiKey, response.status, model);
          continue;
        }

        if (response.status === 500 || response.status === 503) {
          const errorBody = await response.text().catch(() => "");
          console.warn(`[AIAnalytics] Model ${model} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
          try {
            const retryRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { thinkingConfig: { thinkingLevel: "low" } },
                }),
                signal: AbortSignal.timeout(8000),
              }
            );
            responseStatus = retryRes.status;
            if (retryRes.ok) {
              response = retryRes;
            } else {
              continue;
            }
          } catch {
            continue;
          }
        }

        if (response.status === 400) {
          const errorBody = await response.text().catch(() => "");
          console.warn(`[AIAnalytics] Model ${model} HTTP 400: ${errorBody.slice(0, 200)}`);
          const retryRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { thinkingConfig: { thinkingLevel: "low" } },
              }),
              signal: AbortSignal.timeout(8000),
            }
          );
          responseStatus = retryRes.status;
          if (retryRes.ok) {
            response = retryRes;
          } else {
            continue;
          }
        }

        if (response.ok) {
          const responseBody = await response.text();
          let resData: any;
          try {
            resData = JSON.parse(responseBody);
          } catch {
            console.warn(`[AIAnalytics] Model ${model} HTTP ${response.status}: ${responseBody.slice(0, 200)}`);
            continue;
          }
          const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            adminKeyPool.markModelSuccess(apiKey, model);
            aiSummary = text;
            break;
          }
          console.warn(`[AIAnalytics] Model ${model} HTTP ${response.status}: empty text`);
        } else {
          const errorBody = await response.text().catch(() => "");
          console.warn(`[AIAnalytics] Model ${model} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
        }
      } catch (error) {
        const isTimeout = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
        console.warn(`[AIAnalytics] Model ${model} ${isTimeout ? "timeout" : `HTTP ${responseStatus ?? "n/a"}`}: ${error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)}`);
        // Fallback giữ nguyên tóm tắt deterministic
      }
    }

    return NextResponse.json({
      success: true,
      analytics: analyticsData,
      aiSummary,
    });
  } catch (error) {
    console.error("[AIAnalytics] HTTP n/a:", error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200));
    return NextResponse.json(
      { success: false, error: "Không thể tổng hợp báo cáo phân tích từ dữ liệu hệ thống. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
