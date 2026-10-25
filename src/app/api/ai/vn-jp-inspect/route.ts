// FILE: src/app/api/ai/vn-jp-inspect/route.ts
// API AI Kiểm dịch MAFF, Chuẩn hóa Romaji & Sinh tờ khai Hải quan CN23 cho tuyến VN -> JP.
// - mode = "CUSTOMER": Dùng bể khóa chatKeyPool (Rate limit theo IP, phục vụ khách trên /gui-hang-di-nhat & OrderCalculator)
// - mode = "ADMIN": Yêu cầu requireAdmin + Dùng bể khóa adminKeyPool (Phục vụ Admin trên VnJpDispatchTab)

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";
import { chatKeyPool, adminKeyPool } from "@/lib/api-key-manager";
import { inspectVnJpCargoDeterministic } from "@/features/ai/vn-jp/maff-inspector";
import { GEMINI_MODELS, getFeatureModels } from "@/lib/gemini-models";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

    const prompt =
      mode === "ADMIN"
        ? `Bạn là Chuyên gia Khai báo Hải quan Hàng không Việt - Nhật. Hãy dịch chính xác danh mục hàng hóa sau sang tiếng Anh và tiếng Nhật dùng cho tờ khai CN23 (chỉ trả về JSON {"invoiceEn": "...", "invoiceJp": "..."}): "${cargoDetails}"`
        : `Bạn là linh vật Neo Universe (phong cách Kuudere thông thái, ấm áp, dùng ẩn dụ vũ trụ ngắn gọn 2 câu). Hãy nhận xét kiện hàng gửi đi Nhật gồm "${cargoDetails}" với kết quả kiểm dịch MAFF hiện tại là ${baseResult.overallRisk} (chỉ trả về JSON {"neoComment": "..."}).`;

    const models = typeof getFeatureModels === "function"
      ? (mode === "ADMIN" ? getFeatureModels("admin") : getFeatureModels("inspect"))
      : (mode === "ADMIN"
          ? [GEMINI_MODELS.admin, GEMINI_MODELS.neoFallback, GEMINI_MODELS.lightweight]
          : [GEMINI_MODELS.neo, GEMINI_MODELS.neoFallback, GEMINI_MODELS.lightweight]);
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "low" },
      },
    };
    const readResponseBody = async (response: Response) =>
      typeof response.text === "function"
        ? response.text().catch(() => "")
        : JSON.stringify(await response.json().catch(() => ({})));
    const parseInspectionResponse = async (response: Response, model: string) => {
      const body = await readResponseBody(response);
      let data: any;
      try {
        data = JSON.parse(body);
      } catch {
        console.warn(`[VnJpInspect] Model ${model} HTTP ${response.status}: ${body.slice(0, 200)}`);
        return null;
      }
      const text = data?.candidates?.[0]?.content?.parts
        ?.filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought)
        ?.pop()?.text?.trim();
      try {
        const parsed = JSON.parse(text || "");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected JSON object");
        return parsed as Record<string, unknown>;
      } catch {
        console.warn(`[VnJpInspect] Model ${model} HTTP ${response.status}, malformed JSON: ${(text || body).slice(0, 200)}`);
        return null;
      }
    };

    for (const model of models) {
      const apiKey = activePool.getNextKey(model);
      if (!apiKey) {
        console.warn(`[VnJpInspect] No available API key for model ${model}, skipping.`);
        continue;
      }

      let responseStatus: number | null = null;
      try {
        let response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(10000),
          }
        );
        responseStatus = response.status;

        if (response.status === 429) {
          const errorBody = await readResponseBody(response);
          const retryAfter = response.headers.get("retry-after") ?? undefined;
          console.warn(`[VnJpInspect] Model ${model} HTTP 429: ${errorBody.slice(0, 200)}`);
          activePool.markModelError(apiKey, model, 429, errorBody, retryAfter);
          continue;
        }

        if (response.status === 401 || response.status === 403) {
          const errorBody = await readResponseBody(response);
          console.warn(`[VnJpInspect] Model ${model} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
          activePool.markError(apiKey, response.status, model);
          continue;
        }

        if (response.status === 500 || response.status === 503) {
          const errorBody = await readResponseBody(response);
          console.warn(`[VnJpInspect] Model ${model} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
          try {
            const retryRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(10000),
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
          const errorBody = await readResponseBody(response);
          console.warn(`[VnJpInspect] Model ${model} HTTP 400: ${errorBody.slice(0, 200)}`);
          const retryRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(10000),
            }
          );
          responseStatus = retryRes.status;
          if (retryRes.ok) {
            response = retryRes;
          } else {
            const retryBody = await readResponseBody(retryRes);
            console.warn(`[VnJpInspect] Model ${model} retry HTTP ${retryRes.status}: ${retryBody.slice(0, 200)}`);
            continue;
          }
        }

        if (!response.ok) {
          const errorBody = await readResponseBody(response);
          console.warn(`[VnJpInspect] Model ${model} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
          continue;
        }

        let parsed = await parseInspectionResponse(response, model);
        if (!parsed) {
          const retryRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(10000),
            }
          );
          responseStatus = retryRes.status;
          if (!retryRes.ok) {
            const retryBody = await readResponseBody(retryRes);
            console.warn(`[VnJpInspect] Model ${model} retry HTTP ${retryRes.status}: ${retryBody.slice(0, 200)}`);
            continue;
          }
          parsed = await parseInspectionResponse(retryRes, model);
        }
        if (parsed) {
          activePool.markModelSuccess(apiKey, model);
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
          break;
        }
      } catch (error) {
        const isTimeout = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
        console.warn(`[VnJpInspect] Model ${model} ${isTimeout ? "timeout" : `HTTP ${responseStatus ?? "n/a"}`}: ${error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)}`);
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
    console.error("[VnJpInspect] HTTP n/a:", error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200));
    return NextResponse.json(
      { success: false, error: "Không thể hoàn tất kiểm dịch hàng VN → JP. Vui lòng kiểm tra thông tin hàng hóa rồi thử lại." },
      { status: 500 }
    );
  }
}
