import { NextRequest, NextResponse } from "next/server";
import { visionKeyPool, chatKeyPool, scrapeKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS, getFeatureModels } from "@/lib/gemini-models";
import { prisma } from "@/lib/prisma";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";
import {
  rankImageCatalogCandidates,
  normalizeImageCatalogText,
} from "@/features/ai/customer/image-catalog-matcher";

import curatedSeedProducts from "../../../../lib/curated-products.json";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function buildMarketplaceSearchLinks(keywordsJa: string, minJpy?: number, maxJpy?: number) {
  const cleanKw = (keywordsJa || "日本 人気 商品").trim();
  const encoded = encodeURIComponent(cleanKw);
  const amazonUrl = `https://www.amazon.co.jp/s?k=${encoded}`;
  let mercariUrl = `https://jp.mercari.com/search?keyword=${encoded}`;
  let rakutenUrl = `https://search.rakuten.co.jp/search/mall/${encoded}/`;

  if (minJpy && maxJpy) {
    mercariUrl += `&price_min=${minJpy}&price_max=${maxJpy}`;
    rakutenUrl += `?min=${minJpy}&max=${maxJpy}`;
  } else if (maxJpy) {
    mercariUrl += `&price_max=${maxJpy}`;
  }

  return {
    amazon: { label: "Amazon JP", url: amazonUrl },
    mercari: { label: "Mercari JP (Săn đồ lướt/hiếm)", url: mercariUrl },
    rakuten: { label: "Rakuten Ichiba", url: rakutenUrl },
  };
}

/**
 * Lấy API Key khả dụng từ visionKeyPool; nếu hết thì mượn tạm từ chatKeyPool hoặc scrapeKeyPool
 */
function getAvailableVisionApiKey(model?: string): string | null {
  return (
    visionKeyPool?.getNextKey?.(model) ||
    chatKeyPool?.getNextKey?.(model) ||
    scrapeKeyPool?.getNextKey?.(model) ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    null
  );
}

/**
 * Bộ giải mã JSON siêu bền cho AI Vision:
 * - Xử lý markdown code fences (```json ... ```)
 * - Xử lý ký tự xuống dòng thô bên trong chuỗi JSON
 * - Tự động khôi phục các trường chính bằng Regex nếu JSON bị cắt cụt ở cuối
 */
function safeParseVisionJson(rawText: string): Record<string, unknown> | null {
  if (!rawText || typeof rawText !== "string") return null;

  const cleaned = rawText
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  // 1. Thử parse trực tiếp
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}

  // 2. Cắt từ dấu { đầu tiên đến dấu } cuối cùng và chuẩn hóa khoảng trắng điều khiển
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx !== -1 && endIdx > startIdx) {
    const jsonSlice = cleaned.slice(startIdx, endIdx + 1);
    try {
      const parsed = JSON.parse(jsonSlice);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Thử thay thế các ký tự xuống dòng không hợp lệ bên trong chuỗi
      try {
        const sanitized = jsonSlice
          .replace(/[\u0000-\u0019]+/g, " ")
          .replace(/,\s*([}\]])/g, "$1");
        const parsed = JSON.parse(sanitized);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {}
    }
  }

  // 3. Fallback Cứu hộ bằng Regex (Khi JSON bị cắt cụt do giới hạn token)
  const extractStringField = (field: string): string | null => {
    const m = cleaned.match(new RegExp(`"${field}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, "i"));
    return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim() : null;
  };

  const extractStringArrayField = (field: string): string[] => {
    const m = cleaned.match(new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, "i"));
    if (!m) return [];
    return Array.from(m[1].matchAll(/"([^"]+)"/g))
      .map((item) => item[1].trim())
      .filter(Boolean);
  };

  const nameJp = extractStringField("nameJp");
  const nameVi = extractStringField("nameVi");
  const category = extractStringField("category") || "other";
  const description = extractStringField("description") || cleaned.replace(/[{}"]/g, " ").slice(0, 300).trim();
  const riskNotes = extractStringField("riskNotes") || "";
  const searchKeywords = extractStringArrayField("searchKeywords");
  const matchedCatalogIds = extractStringArrayField("matchedCatalogIds");

  if (nameJp || nameVi || searchKeywords.length > 0 || matchedCatalogIds.length > 0 || description.length > 10) {
    return {
      nameJp,
      nameVi: nameVi || "Sản phẩm nhận diện từ hình ảnh",
      visiblePriceJpy: null,
      category,
      voltageWarning: /100v|ac100/i.test(cleaned),
      riskNotes,
      searchKeywords: searchKeywords.length > 0 ? searchKeywords : [nameJp || nameVi || "フィギュア グッズ"].filter(Boolean),
      matchedCatalogIds,
      description,
    };
  }

  return null;
}

// Rate limit: 10 image analyses per minute per IP
const IMAGE_ANALYZE_LIMIT = { max: 10, windowMs: 60 * 1000, blockMs: 60 * 1000 };

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const retryAfter = await checkAndRecordHit(`image-analyze:${ip}`, IMAGE_ANALYZE_LIMIT).catch(() => 0);
  if (retryAfter > 0) {
    return NextResponse.json(
      { success: false, error: "Bạn phân tích ảnh quá nhiều lần. Vui lòng chờ 1 phút." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const imageData = body?.imageData;
    const question =
      typeof body?.question === "string"
        ? body.question.replace(/[<>]/g, " ").trim().slice(0, 500)
        : "";

    if (!imageData) {
      return NextResponse.json({ success: false, error: "imageData is required" }, { status: 400 });
    }

    if (typeof imageData !== "string" || imageData.length > 4_300_000) {
      return NextResponse.json(
        {
          success: false,
          error: "Ảnh gửi lên vượt giới hạn xử lý. Vui lòng chọn ảnh nhỏ hơn hoặc chụp màn hình vùng sản phẩm.",
        },
        { status: 413 }
      );
    }

    const apiKey = getAvailableVisionApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Hệ thống AI phân tích ảnh đang quá tải, vui lòng thử lại sau 1 phút." },
        { status: 503 }
      );
    }

    // Parse imageData an toàn
    let mimeType = "image/jpeg";
    let base64Data = imageData.trim();
    if (base64Data.includes(";base64,")) {
      const parts = base64Data.split(";base64,");
      const mimeMatch = parts[0].match(/data:(image\/[a-zA-Z0-9.+-]+)/i);
      if (mimeMatch) mimeType = mimeMatch[1].toLowerCase();
      base64Data = parts[1].replace(/\s+/g, "");
    } else {
      base64Data = base64Data.replace(/\s+/g, "");
    }

    if (!base64Data) {
      return NextResponse.json({ success: false, error: "Invalid imageData format" }, { status: 400 });
    }

    // ── BƯỚC 1: Tải danh sách sản phẩm trong kho ChillBanana để AI đối chiếu trực tiếp ──
    let catalogProducts: Array<{
      id?: string;
      name: string;
      category?: string;
      categoryName: string;
      priceJpy: number;
      description: string;
      imageUrl?: string;
      originalStore?: string;
    }> = [];
    let catalogLookupFailed = false;

    try {
      const dbProducts = await prisma.product.findMany({
        take: 60,
        select: {
          name: true,
          categoryName: true,
          priceJpy: true,
          description: true,
        },
      });
      catalogProducts = Array.isArray(dbProducts) ? (dbProducts as any) : [];
    } catch {
      console.warn("[ImageAnalysis] Catalog lookup unavailable.");
      catalogLookupFailed = true;
      catalogProducts = [];
    }

    const promptProducts = catalogProducts.length > 0 ? catalogProducts : curatedSeedProducts;
    const catalogDigestForPrompt = promptProducts
      .slice(0, 40)
      .map(
        (p) =>
          `- ID: "${(p as any).id || p.name}" | Tên: "${p.name}" | Danh mục: ${(p as any).category || p.categoryName} (${p.categoryName}) | Giá: ¥${p.priceJpy} | Mô tả: ${(p.description || "").slice(0, 90)}`
      )
      .join("\n");

    const prompt = `Bạn là trợ lý AI Vision tìm hàng Nhật của ChillBanana, hỗ trợ nhận diện sản phẩm trong kho ChillBanana và tạo từ khóa tìm mua hộ trên Amazon JP, Mercari và Rakuten.

DANH MỤC SẢN PHẨM ĐANG CÓ SẴN TẠI KHO CHILLBANANA:
${catalogDigestForPrompt}

NHIỆM VỤ QUAN TRỌNG:
1. Quan sát kỹ hình ảnh khách gửi (bao gồm cả mô hình Anime/Nendoroid/Figure, mỹ phẩm, đồ gia dụng, đồng hồ, hoặc tranh vẽ/phác họa như tranh vẽ Elon Musk / SpaceX / Tesla / Stonk...).
2. Đối chiếu hình ảnh với "DANH MỤC SẢN PHẨM ĐANG CÓ SẴN TẠI KHO CHILLBANANA" ở trên:
   - Nếu hình ảnh khớp hoặc tương đồng rõ rệt với bất kỳ sản phẩm nào trong kho (ví dụ: tranh vẽ tay nhân vật mặc vest kèm xe Tesla/tên lửa SpaceX/chữ Stonk khớp với sản phẩm "Tranh errormusk tự pháp họa..." trong kho; hoặc mô hình Luffy/Gundam/đồng hồ Citizen...), hãy đưa ID hoặc Tên của sản phẩm đó vào mảng "matchedCatalogIds", đồng thời ưu tiên đặt "nameVi" theo tên sản phẩm trong kho.
   - Nếu là sản phẩm Nhật chưa có trong kho (ví dụ: mô hình Nendoroid nhân vật Anime, mỹ phẩm, máy chơi game...), hãy mô tả chính xác ngoại hình nhân vật/sản phẩm (màu tóc, trang phục, dòng mô hình như ねんどろいど / Nendoroid / Figure) và tạo 3-5 từ khóa tiếng Nhật chuẩn xác nhất trong "searchKeywords" để khách bấm tìm ngay trên Mercari JP, Amazon JP và Rakuten!
3. Quy tắc an toàn:
   - Chỉ điền visiblePriceJpy nếu con số JPY thực sự nhìn thấy trong ảnh; không tự đoán giá.
   - Cảnh báo điện 100V (voltageWarning: true) nếu là thiết bị điện gia dụng Nhật hoặc thấy 100V/AC100V.
   - Luôn tạo ít nhất 2-5 từ khóa tìm kiếm tiếng Nhật hữu ích trong "searchKeywords" (ví dụ: ["ねんどろいど フィギュア", "アニメ フィギュア", "グッドスマイルカンパニー"] cho mô hình chibi Nendoroid).

Yêu cầu bổ sung của khách:
<customer_request>${question || "Tìm mặt hàng trong kho ChillBanana hoặc trên các sàn Nhật có hình ảnh tương tự."}</customer_request>

BẮT BUỘC chỉ trả về đúng 1 JSON object hợp lệ (không bọc markdown, không xuống dòng bên trong giá trị chuỗi):
{
  "nameJp": "tên tiếng Nhật hoặc dòng sản phẩm bằng tiếng Nhật (ví dụ: ねんどろいど フィギュア)",
  "nameVi": "tên nhận diện tiếng Việt rõ ràng",
  "visiblePriceJpy": null,
  "category": "cosmetics" | "health" | "gadgets" | "anime" | "other",
  "voltageWarning": false,
  "riskNotes": "lưu ý ngắn gọn khi mua hàng",
  "searchKeywords": ["từ khóa tiếng Nhật 1", "từ khóa tiếng Nhật 2", "từ khóa tiếng Anh/Việt 3"],
  "matchedCatalogIds": ["id hoặc tên sản phẩm khớp trong kho nếu có"],
  "description": "mô tả ngắn gọn đặc điểm nhận diện sản phẩm trong ảnh"
}`;

    // ── BƯỚC 2: Gọi Gemini Vision với cơ chế Fallback 3 Model (vision, neoFallback, lightweight) & thinkingLevel: low ──
    const candidateModels = typeof getFeatureModels === "function"
      ? getFeatureModels("vision")
      : [
          GEMINI_MODELS.vision,
          GEMINI_MODELS.neoFallback,
          GEMINI_MODELS.lightweight,
        ];
    const uniqueModels = Array.from(new Set(candidateModels));

    let parsedResult: Record<string, unknown> | null = null;
    let lastStatus = 500;
    const readResponseBody = async (response: Response) =>
      typeof response.text === "function"
        ? response.text().catch(() => "")
        : JSON.stringify(await response.json().catch(() => ({})));
    const parseVisionResponse = async (response: Response, modelName: string) => {
      const body = await readResponseBody(response);
      let data: any;
      try {
        data = JSON.parse(body);
      } catch {
        console.warn(`[ImageAnalyze] Model ${modelName} HTTP ${response.status}: ${body.slice(0, 200)}`);
        return null;
      }
      const parts = data.candidates?.[0]?.content?.parts || [];
      const textPart = parts.filter((part: any) => typeof part.text === "string" && !part.thought).pop();
      const textOutput = textPart?.text || "";
      const parsed = safeParseVisionJson(textOutput);
      if (!parsed) {
        console.warn(`[ImageAnalyze] Model ${modelName} HTTP ${response.status}, malformed JSON: ${(textOutput || body).slice(0, 200)}`);
      }
      return parsed;
    };

    const deadline = Date.now() + 24_000;

    for (let modelIdx = 0; modelIdx < uniqueModels.length; modelIdx++) {
      const modelName = uniqueModels[modelIdx];
      const remaining = deadline - Date.now();
      if (remaining < 3000) {
        console.warn(`[ImageAnalyze] Ngân sách thời gian còn lại ${remaining}ms < 3000ms. Dừng thử.`);
        break;
      }

      const apiKey = getAvailableVisionApiKey(modelName);
      if (!apiKey) continue;

      const modelTimeout = modelIdx === 0
        ? Math.min(12_000, remaining)
        : Math.min(8_000, remaining);

      const requestBody = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.15,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "low" },
        },
      };

      let responseStatus: number | null = null;
      try {
        let res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(modelTimeout),
          }
        );

        lastStatus = res.status;
        responseStatus = res.status;
        if (!res.ok) {
          const errText = await readResponseBody(res);
          console.warn(`[ImageAnalyze] Model ${modelName} lỗi HTTP ${res.status}: ${errText.slice(0, 200)}`);
          visionKeyPool?.markModelError?.(apiKey, modelName, res.status, errText);

          // Retry lỗi request một lần; giữ cấu hình thinking như yêu cầu ban đầu.
          if (res.status === 400) {
            const retryRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(18000),
              }
            );
            lastStatus = retryRes.status;
            responseStatus = retryRes.status;
            if (retryRes.ok) {
              parsedResult = await parseVisionResponse(retryRes, modelName);
              if (parsedResult) break;
              const malformedJsonRetry = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(requestBody),
                  signal: AbortSignal.timeout(18000),
                }
              );
              lastStatus = malformedJsonRetry.status;
              responseStatus = malformedJsonRetry.status;
              if (malformedJsonRetry.ok) {
                parsedResult = await parseVisionResponse(malformedJsonRetry, modelName);
                if (parsedResult) break;
              } else {
                const retryErrText = await readResponseBody(malformedJsonRetry);
                console.warn(`[ImageAnalyze] Model ${modelName} JSON retry HTTP ${malformedJsonRetry.status}: ${retryErrText.slice(0, 200)}`);
                visionKeyPool?.markError?.(apiKey, malformedJsonRetry.status, modelName);
              }
            } else {
              const retryErrText = await readResponseBody(retryRes);
              console.warn(`[ImageAnalyze] Model ${modelName} retry lỗi HTTP ${retryRes.status}: ${retryErrText.slice(0, 200)}`);
              visionKeyPool?.markError?.(apiKey, retryRes.status, modelName);
            }
          }
          continue;
        }

        visionKeyPool?.markModelSuccess?.(apiKey, modelName);
        parsedResult = await parseVisionResponse(res, modelName);
        if (parsedResult) break;
        const retryRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(18000),
          }
        );
        lastStatus = retryRes.status;
        responseStatus = retryRes.status;
        if (!retryRes.ok) {
          const retryErrText = await readResponseBody(retryRes);
          console.warn(`[ImageAnalyze] Model ${modelName} retry lỗi HTTP ${retryRes.status}: ${retryErrText.slice(0, 200)}`);
          visionKeyPool?.markError?.(apiKey, retryRes.status, modelName);
          continue;
        }
        parsedResult = await parseVisionResponse(retryRes, modelName);
        if (parsedResult) break;
      } catch (err) {
        console.warn(`[ImageAnalyze] Model ${modelName} HTTP ${responseStatus ?? "n/a"}: ${err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)}`);
        visionKeyPool?.markError?.(apiKey, 503, modelName);
        lastStatus = 503;
      }
    }

    if (!parsedResult) {
      if ([401, 403, 429, 500, 503].includes(lastStatus)) {
        visionKeyPool?.markError?.(apiKey, lastStatus);
      }
      if (lastStatus === 429) {
        return NextResponse.json(
          { success: false, error: "AI Vision đang bận. Vui lòng chờ một chút rồi thử lại." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { success: false, error: "AI chưa phân tích được ảnh này. Hãy gửi ảnh rõ, chụp thẳng vào sản phẩm hoặc thử lại sau." },
        { status: 502 }
      );
    }

    const validCategories = ["cosmetics", "health", "gadgets", "anime", "other"];
    const matchedCatalogIds = Array.isArray(parsedResult.matchedCatalogIds)
      ? parsedResult.matchedCatalogIds
          .filter((id: unknown): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    const normalizedResult = {
      nameJp: typeof parsedResult.nameJp === "string" ? parsedResult.nameJp.slice(0, 160) : null,
      nameVi: typeof parsedResult.nameVi === "string" ? parsedResult.nameVi.slice(0, 160) : null,
      visiblePriceJpy:
        typeof parsedResult.visiblePriceJpy === "number" &&
        Number.isFinite(parsedResult.visiblePriceJpy) &&
        parsedResult.visiblePriceJpy > 0
          ? Math.round(parsedResult.visiblePriceJpy)
          : null,
      category: validCategories.includes(String(parsedResult.category))
        ? String(parsedResult.category)
        : "other",
      voltageWarning: parsedResult.voltageWarning === true,
      riskNotes: typeof parsedResult.riskNotes === "string" ? parsedResult.riskNotes.slice(0, 400) : "",
      searchKeywords: Array.isArray(parsedResult.searchKeywords)
        ? parsedResult.searchKeywords
            .filter((keyword: unknown): keyword is string => typeof keyword === "string")
            .map((keyword: string) =>
              keyword
                .replace(/[\u0000-\u001F\[\]()*<>`]/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 100)
            )
            .filter(Boolean)
            .slice(0, 5)
        : [],
      matchedCatalogIds,
      description: typeof parsedResult.description === "string" ? parsedResult.description.slice(0, 800) : "",
    };

    // Thêm quy tắc nhận diện nhanh cho các sản phẩm đặc thù trong kho (ví dụ tranh vẽ Elon Musk / Tesla / SpaceX / Stonk -> errormusk)
    const fullVisionCorpus = normalizeImageCatalogText(
      `${normalizedResult.nameJp || ""} ${normalizedResult.nameVi || ""} ${normalizedResult.description || ""} ${normalizedResult.searchKeywords.join(" ")} ${question}`
    );

    for (const prod of catalogProducts) {
      const prodNorm = normalizeImageCatalogText(`${prod.name} ${prod.description}`);
      if (
        (prodNorm.includes("errormusk") || prodNorm.includes("phap hoa") || prodNorm.includes("ban goc")) &&
        /\b(elon|musk|tesla|spacex|stonk|errormusk|tranh|sketch|drawing|phac hoa|ve tay)\b/i.test(fullVisionCorpus)
      ) {
        const prodId = (prod as any).id || prod.name;
        if (!normalizedResult.matchedCatalogIds.includes(prodId)) {
          normalizedResult.matchedCatalogIds.unshift(prodId);
        }
      }
    }

    // ── BƯỚC 3: Xếp hạng sản phẩm khớp trong kho ChillBanana ──
    let catalogMatches: {
      status: "matched" | "no_match" | "unavailable" | "not_searched";
      products: Array<{
        id?: string;
        name: string;
        category: string;
        priceJpy: number;
        imageUrl?: string;
        originalStore?: string;
        isExactMatch?: boolean;
      }>;
    };

    if (catalogLookupFailed) {
      catalogMatches = { status: "unavailable", products: [] };
    } else {
      const ranked = rankImageCatalogCandidates(catalogProducts, normalizedResult, 3);
      catalogMatches = {
        status: ranked.length > 0 ? "matched" : "no_match",
        products: ranked.map((product) => ({
          id: (product as any).id,
          name: product.name.slice(0, 120),
          category: product.categoryName.slice(0, 80),
          priceJpy: product.priceJpy,
          imageUrl: (product as any).imageUrl,
          originalStore: (product as any).originalStore,
          isExactMatch: Boolean(
            ((product as any).id && normalizedResult.matchedCatalogIds.includes((product as any).id)) ||
            normalizedResult.matchedCatalogIds.includes(product.name)
          ),
        })),
      };
    }

    // Nếu khớp chính xác với 1 sản phẩm có sẵn trong kho, đồng bộ luôn tên và giá tham khảo
    if (catalogMatches.products.length > 0 && catalogMatches.products[0].isExactMatch) {
      const topMatch = catalogMatches.products[0];
      if (!normalizedResult.nameVi || normalizedResult.nameVi.length < 5) {
        normalizedResult.nameVi = topMatch.name;
      }
    }

    // Nhận diện đồ điện gia dụng Nhật (ấm đun nước, nồi cơm, máy sấy tóc...)
    const textCorpus = `${normalizedResult.nameJp || ""} ${normalizedResult.nameVi || ""} ${normalizedResult.description || ""} ${question}`.toLowerCase();
    const isElectricAppliance =
      normalizedResult.category === "gadgets" &&
      /ấm|kettle|nồi cơm|rice cooker|máy sấy|dryer|bàn ủi|iron|lò nướng|t-fal|tfal|zojirushi|tiger|panasonic|100v/i.test(
        textCorpus
      );

    if (isElectricAppliance) {
      normalizedResult.voltageWarning = true;
      if (!normalizedResult.riskNotes.includes("100V")) {
        normalizedResult.riskNotes =
          `⚠️ Thiết bị điện gia dụng nội địa Nhật dùng nguồn điện 100V. Cần sử dụng qua biến áp đổi nguồn Lioa (từ 1500VA - 2000VA) tại Việt Nam, tuyệt đối không cắm trực tiếp vào điện 220V. ${normalizedResult.riskNotes}`.trim();
      }
    }

    // Tự động tạo link tìm kiếm sàn Nhật (Amazon JP, Mercari JP, Rakuten)
    const effectiveKeywordsJa =
      normalizedResult.nameJp ||
      (normalizedResult.searchKeywords && normalizedResult.searchKeywords[0]) ||
      normalizedResult.nameVi ||
      question ||
      "日本 人気 商品";
    const marketplaceLinks = buildMarketplaceSearchLinks(
      effectiveKeywordsJa,
      undefined,
      normalizedResult.visiblePriceJpy ? Math.round(normalizedResult.visiblePriceJpy * 1.2) : undefined
    );

    return NextResponse.json({
      success: true,
      analysis: {
        ...normalizedResult,
        catalogMatches,
        marketplaceLinks,
        keywordsJa: effectiveKeywordsJa,
      },
    });
  } catch (error) {
    console.error("[ImageAnalyze] HTTP n/a:", error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200));
    return NextResponse.json({ success: false, error: "Không thể xử lý yêu cầu phân tích ảnh. Hãy kiểm tra định dạng ảnh rồi thử lại." }, { status: 500 });
  }
}
