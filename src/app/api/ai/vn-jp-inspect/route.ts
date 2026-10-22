// FILE: src/app/api/ai/vn-jp-inspect/route.ts
// API AI Kiểm dịch MAFF, Chuẩn hóa Romaji & Sinh tờ khai Hải quan CN23 cho tuyến VN -> JP.
// - mode = "CUSTOMER": Dùng bể khóa chatKeyPool (Rate limit theo IP, phục vụ khách trên /gui-hang-di-nhat & OrderCalculator)
// - mode = "ADMIN": Yêu cầu requireAdmin + Dùng bể khóa adminKeyPool (Phục vụ Admin trên VnJpDispatchTab)

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";
import { chatKeyPool, adminKeyPool } from "@/lib/api-key-manager";
import { inspectVnJpCargoDeterministic } from "@/features/ai/vn-jp/maff-inspector";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body.mode === "ADMIN" ? "ADMIN" : "CUSTOMER";

    if (mode === "ADMIN") {
      const guard = await requireAdmin(req);
      if (!guard.ok) return guard.response;
    } else {
      const clientIp = getClientIp(req);
      const retryAfter = await checkAndRecordHit(`vn_jp_ai_inspect:${clientIp}`, {
        max: 20,
        windowMs: 60_000,
        blockMs: 60_000,
      });
      if (retryAfter > 0) {
        return NextResponse.json(
          { success: false, error: `Neo AI đang bận kiểm dịch, vui lòng thử lại sau ${retryAfter} giây.` },
          { status: 429 }
        );
      }
    }

    const cargoDetails = typeof body.cargoDetails === "string" ? body.cargoDetails.trim() : "";
    if (!cargoDetails) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập danh mục hàng hóa chi tiết để Neo AI kiểm dịch." },
        { status: 400 }
      );
    }

    // 1. Chạy Động cơ Kiểm dịch & Bưu chính Lõi (Deterministic Engine - Đảm bảo chính xác 100%)
    const baseResult = inspectVnJpCargoDeterministic({
      cargoDetails,
      estimatedWeightKg: Number(body.estimatedWeightKg) || 1,
      receiverName: typeof body.receiverName === "string" ? body.receiverName : "",
      receiverPostalCode: typeof body.receiverPostalCode === "string" ? body.receiverPostalCode : "",
      receiverPrefecture: typeof body.receiverPrefecture === "string" ? body.receiverPrefecture : "Tokyo",
      senderCity: typeof body.senderCity === "string" ? body.senderCity : "Bình Dương",
      includeAdminCopilot: mode === "ADMIN",
    });

    // 2. Làm giàu bản dịch tờ khai CN23 hoặc lời khuyên đóng gói bằng Gemini (Tách riêng chatKeyPool vs adminKeyPool)
    const activePool = mode === "ADMIN" ? adminKeyPool : chatKeyPool;
    const apiKey = activePool.getAvailableKey();

    if (apiKey) {
      try {
        const prompt =
          mode === "ADMIN"
            ? `Bạn là Chuyên gia Khai báo Hải quan Hàng không Việt - Nhật. Hãy dịch chính xác danh mục hàng hóa sau sang tiếng Anh và tiếng Nhật dùng cho tờ khai CN23 (chỉ trả về JSON {"invoiceEn": "...", "invoiceJp": "..."}): "${cargoDetails}"`
            : `Bạn là linh vật Neo Universe (phong cách Kuudere thông thái, ấm áp, dùng ẩn dụ vũ trụ ngắn gọn 2 câu). Hãy nhận xét kiện hàng gửi đi Nhật gồm "${cargoDetails}" với kết quả kiểm dịch MAFF hiện tại là ${baseResult.overallRisk} (chỉ trả về JSON {"neoComment": "..."}).`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
            signal: AbortSignal.timeout(10000),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            const parsed = JSON.parse(text);
            if (mode === "ADMIN" && baseResult.adminCustomsDeclaration) {
              if (typeof parsed.invoiceEn === "string" && parsed.invoiceEn.trim()) {
                baseResult.adminCustomsDeclaration.invoiceSummaryEn = parsed.invoiceEn.trim();
              }
              if (typeof parsed.invoiceJp === "string" && parsed.invoiceJp.trim()) {
                baseResult.adminCustomsDeclaration.invoiceSummaryJp = parsed.invoiceJp.trim();
              }
            } else if (typeof parsed.neoComment === "string" && parsed.neoComment.trim()) {
              baseResult.neoKuudereComment = parsed.neoComment.trim();
            }
          }
        } else {
          if ([401, 403, 429, 500, 503].includes(response.status)) {
            activePool.markError(apiKey, response.status);
          }
        }
      } catch {
        // Fallback an toàn về kết quả Deterministic nếu Gemini quá tải hoặc mất mạng
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      keyPoolUsed: mode === "ADMIN" ? "adminKeyPool" : "chatKeyPool",
      inspection: baseResult,
    });
  } catch (error) {
    console.error("[API VN-JP AI Inspect] Lỗi:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi máy chủ khi thực thi AI kiểm dịch VN → JP." },
      { status: 500 }
    );
  }
}
