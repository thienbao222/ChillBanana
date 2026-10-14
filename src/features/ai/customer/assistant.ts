import { AIPersonality, CuratedProduct } from "@/types";
import { AIR_SHIPPING_PER_KG } from "@/features/pricing/calculator";
import { fetchLiveExchangeRate } from "@/features/pricing/exchange-rate";
import { chatKeyPool } from "@/lib/api-key-manager";
import { prisma } from "@/lib/prisma";
import { hasGuestOrderAccessForEmail, verifyGuestOrderAccessToken } from "@/lib/auth-session";

// ─────────────────────────────────────────────────────────────────────────────
// Agent 1.4: Order Lookup Tool
// Phát hiện mã đơn hàng trong tin nhắn khách → tra cứu DB → trả context text
// để inject vào system prompt Gemini khi trả lời.
// ─────────────────────────────────────────────────────────────────────────────

/** Regex nhận diện mã đơn ChillBanana. Ví dụ: CB-2026-abc123-45678 */
const ORDER_CODE_REGEX = /\bCB-\d{4}-[A-Z0-9]+-\d{4,6}\b/gi;

/** Map trạng thái đơn hàng sang tiếng Việt thân thiện */
const STATUS_LABEL: Record<string, string> = {
  PENDING_DEPOSIT: "⏳ Chờ đặt cọc",
  PURCHASING_JP:   "🛒 Đang mua tại Nhật Bản",
  WAREHOUSE_JP:    "📦 Đã vào kho Nhật (Tokyo/Osaka)",
  IN_TRANSIT_AIR:  "✈️ Đang bay về Việt Nam",
  WAREHOUSE_VN:    "🏭 Đã về kho Việt Nam",
  LOCAL_DELIVERY:  "🚚 Đang giao hàng nội địa",
  COMPLETED:       "✅ Giao hàng thành công",
  CANCELLED:       "❌ Đã hủy đơn hàng",
};

/**
 * Tra cứu đơn hàng từ tin nhắn của khách.
 * Chỉ cho phép chủ tài khoản hoặc khách guest có link xác minh còn hạn.
 * Trả về chuỗi context hoặc null nếu không tìm thấy mã đơn.
 */
export async function lookupOrderContext(
  message: string,
  customerId: string | null,
  guestOrderAccessToken: string | null
): Promise<string | null> {
  const codes = message.match(ORDER_CODE_REGEX);
  if (!codes || codes.length === 0) return null;

  // Chỉ lookup mã đầu tiên tìm thấy để tránh spam DB
  const orderCode = codes[0].toUpperCase();
  const guestAccess = guestOrderAccessToken ? verifyGuestOrderAccessToken(guestOrderAccessToken) : null;
  if (!customerId && guestAccess?.orderCode !== orderCode) {
    return `[BẢO MẬT: Không xác nhận đơn hàng có tồn tại hay không và không tiết lộ chi tiết. Hướng dẫn khách đăng nhập đúng tài khoản hoặc yêu cầu liên kết xác minh qua email.]`;
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderCode },
      select: {
        orderCode: true,
        productName: true,
        status: true,
        paymentStatus: true,
        totalVnd: true,
        depositAmountVnd: true,
        jpDomesticTrack: true,
        vnDomesticTrack: true,
        customerId: true,
        customerEmail: true,
        createdAt: true,
        trackingLogs: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { title: true, description: true, location: true, createdAt: true },
        },
      },
    });

    if (!order) {
      return `[KHÔNG THỂ TRA CỨU ĐƠN: Không xác nhận mã đơn có tồn tại hay không. Hướng dẫn khách kiểm tra mã, đăng nhập đúng tài khoản hoặc mở liên kết xác minh được gửi qua email.]`;
    }

    // Kiểm tra quyền truy cập
    const isOwner = Boolean(
      (customerId && order.customerId === customerId) ||
      hasGuestOrderAccessForEmail(guestOrderAccessToken, order.orderCode, order.customerEmail)
    );

    if (!isOwner) {
      return `[BẢO MẬT: Không xác nhận đơn hàng có tồn tại hay không và không tiết lộ chi tiết. Hướng dẫn khách đăng nhập đúng tài khoản hoặc yêu cầu liên kết xác minh qua email.]`;
    }

    // Format context đơn hàng
    const statusLabel = STATUS_LABEL[order.status] ?? order.status;
    const latestLog = order.trackingLogs[0];
    const trackingInfo = [
      order.jpDomesticTrack ? `Mã vận đơn Nhật: ${order.jpDomesticTrack}` : null,
      order.vnDomesticTrack ? `Mã vận đơn VN: ${order.vnDomesticTrack}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const lines = [
      `[DỮ LIỆU ĐƠN HÀNG THỰC TẾ TỪ HỆ THỐNG — Dùng để trả lời chính xác cho khách:]`,
      `📋 Mã đơn: ${order.orderCode}`,
      `🛍️ Sản phẩm: ${order.productName}`,
      `📊 Trạng thái hiện tại: ${statusLabel}`,
      `💳 Thanh toán: ${order.paymentStatus}`,
      `💰 Tổng đơn: ${order.totalVnd.toLocaleString("vi-VN")}đ | Đã cọc: ${order.depositAmountVnd.toLocaleString("vi-VN")}đ`,
      trackingInfo ? `🔍 ${trackingInfo}` : null,
      latestLog
        ? `📍 Cập nhật mới nhất (${new Date(latestLog.createdAt).toLocaleDateString("vi-VN")}): ${latestLog.title} — ${latestLog.description} (${latestLog.location})`
        : null,
      `📅 Ngày tạo đơn: ${new Date(order.createdAt).toLocaleDateString("vi-VN")}`,
    ]
      .filter(Boolean)
      .join("\n");

    return lines;
  } catch (err) {
    console.warn("[lookupOrderContext] DB error:", err);
    return null;
  }
}


export interface GeminiAgentMessage {
  role: "user" | "model" | "assistant";
  text: string;
}

// Danh sách các từ khóa nhạy cảm cần lịch sự từ chối
const SENSITIVE_KEYWORDS = [
  "chính trị", "chinh tri", "bầu cử", "biểu tình", "bạo động",
  "khiêu dâm", "sex", "đồi trụy", "người lớn 18+", "phim sex", "gái gọi",
  "vũ khí", "súng", "đạn", "thuốc nổ", "bom", "ma túy", "chất cấm", "cần sa",
  "xúc phạm", "chửi bới", "xuyên tạc", "lừa đảo làm giàu", "cờ bạc", "cá độ"
];

export function isSensitiveTopic(text: string): boolean {
  const lower = text.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function buildSystemInstruction(products: CuratedProduct[], liveRate: number, isRateStale = false): string {
  const catalogSummary = products
    .slice(0, 15)
    .map(
      (p) =>
        `- [${p.name}] | Giá gốc tham khảo: ${p.priceJpy.toLocaleString()} ¥ (~${Math.round(p.priceJpy * liveRate).toLocaleString()} đ, chưa gồm phí/cước) | Danh mục: ${p.categoryName} | Suất đặt mua hộ còn lại trên website: ${p.stockSlots} | Ảnh: ${p.imageUrl} | Chi tiết: ${p.description}`
    )
    .join("\n");

  return `
Bạn là "ChillBanana AI Agent" - Trợ lý mua sắm và mua hộ hàng nội địa Nhật Bản trên nền tảng ChillBanana (chillbanana.vn).

THÔNG TIN TỶ GIÁ THAM KHẢO (KHÔNG TỰ BỊA HOẶC BỎ QUA TRẠNG THÁI):
- Tỷ giá JPY -> VND: 1 JPY = ${liveRate} VND (${isRateStale ? "DỮ LIỆU DỰ PHÒNG/CŨ, KHÔNG PHẢI TỶ GIÁ HIỆN TẠI" : "dữ liệu tham khảo mới nhất lấy được"})
- ${isRateStale ? "Không được khẳng định đây là tỷ giá hiện tại hoặc tạo báo giá chốt; nếu khách hỏi giá, hãy nói tỷ giá đang được cập nhật và hướng dẫn kiểm tra lại sau." : "Có thể dùng tỷ giá này để đưa ra ước tính, nhưng nhắc khách đây là giá tham khảo."}
- Cước vận chuyển đường hàng không tham khảo: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg; thời gian phụ thuộc lịch vận chuyển thực tế.
- Đặt cọc mua hộ: 50% tiền hàng + phí dịch vụ (chưa bao gồm cước bay)
- Bảo hiểm đền bù 100% khi mất mát, gãy vỡ

CHIẾN LƯỢC TƯ VẤN SẢN PHẨM (BẮT BUỘC KẾT HỢP CẢ 2 NGUỒN):
Khi khách hàng hỏi tư vấn sản phẩm chung chung (ví dụ: trị mụn, dưỡng da, kem chống nắng, máy cạo râu, mô hình Anime, đồ điện tử...):

1. NGUỒN 1 - SẢN PHẨM CÓ SUẤT ĐẶT MUA HỘ TRÊN WEBSITE:
   - Chỉ giới thiệu sản phẩm có "Suất đặt mua hộ còn lại" lớn hơn 0. Đây là suất nhận yêu cầu mua hộ, KHÔNG đồng nghĩa hàng đang ở kho Việt Nam hay đã xác nhận tồn kho tại sàn Nhật.
     * Không cam kết thời gian giao hàng hoặc tình trạng hàng ngoài thông tin hiện có.
     * BẮT BUỘC chèn ảnh sản phẩm bằng cú pháp Markdown ảnh: ![Tên sản phẩm](URL_ảnh)
     * Nêu giá Yên, giá quy đổi VND, công dụng nổi bật.
     * Nhắc khách kiểm tra suất đặt trên website hoặc gửi link để được kiểm tra lại trước khi xác nhận.

2. NGUỒN 2 - GỢI Ý MỞ RỘNG TRÊN CÁC SÀN NỘI ĐỊA NHẬT (Amazon JP, Mercari, Rakuten):
   - Gợi ý thêm 2-3 sản phẩm nổi tiếng chuyên sâu khác của Nhật cùng phân khúc mà shop chưa đăng sẵn.
   - Cung cấp link tìm kiếm trực tiếp trên sàn Nhật: [Tìm trên Amazon JP](https://www.amazon.co.jp/s?k=tên_sản_phẩm) hoặc [Tìm trên Mercari](https://jp.mercari.com/search?keyword=tên_sản_phẩm).
   - Hướng dẫn khách: Copy link rồi dán vào ô "Dán Link Tính Giá" ở đầu trang web để ChillBanana mua hộ từ Tokyo về tận tay.

QUY TẮC HIỂN THỊ HÌNH ẢNH (BẮT BUỘC):
- Khi giới thiệu bất kỳ sản phẩm nào có ảnh trong danh mục shop, BẮT BUỘC dùng cú pháp:
  ![Tên sản phẩm](URL_ảnh)
- TUYỆT ĐỐI KHÔNG viết dạng văn bản thô "* Link ảnh: https://..." mà PHẢI viết dạng cú pháp ảnh Markdown ![Tên](URL).

TƯ VẤN GIÁ AN TOÀN:
- Không tự tính tổng tiền, cước bay, tiền cọc hoặc cam kết có hàng. Chỉ lặp lại con số trong khối báo giá do máy chủ cung cấp; không sửa, làm tròn lại hoặc suy diễn thêm.
- Khối báo giá của máy chủ có thể chưa gồm cước vận chuyển nếu chưa biết cân nặng. Báo giá cuối cùng được xác nhận sau khi nhân viên kiểm tra đơn.
- Không tự tạo link thanh toán hay nói khách đã đặt cọc; hướng khách sang form yêu cầu mua hộ trên website.

LƯU Ý KỸ THUẬT, AN TOÀN & ĐÁNH GIÁ TỪ BÊN THỨ 3 (QUAN TRỌNG):
- Đồ điện nội địa Nhật: LUÔN NHẮC điện áp 100V cần dùng biến áp tại VN.
- Quần áo/giày dép: form Nhật chuẩn người châu Á, thường ôm hơn form Âu Mỹ 1 size.
- Tư vấn chéo chuyên trang: Nếu khách hỏi mỹ phẩm, hãy nhắc đến "Top xếp hạng @cosme Nhật Bản". Nếu hỏi đồ công nghệ, nhắc đến "đánh giá trên Kakaku".
- Uy tín người bán (Mercari/Yahoo): Hãy chủ động nhắc khách "Lưu ý kiểm tra số sao đánh giá (review) của người bán trên sàn, tránh mua từ tài khoản 0 đánh giá hoặc nhiều đánh giá xấu (bad ratings)".
- Từ chối lịch sự các chủ đề nhạy cảm (chính trị, 18+, vũ khí, chất cấm).

DANH MỤC SẢN PHẨM CÒN SUẤT ĐẶT MUA HỘ TRÊN WEBSITE:
${catalogSummary}
`;
}

export async function askGeminiAgent(
  userQuery: string,
  personality: AIPersonality,
  conversationHistory: { role: string; text: string }[] = []
): Promise<string> {
  const isOmo = personality === "omotenashi";

  if (isSensitiveTopic(userQuery)) {
    return isOmo
      ? `Dạ kính thưa Quý khách, em xin phép lịch sự từ chối phản hồi về chủ đề này do tính chất nhạy cảm và không nằm trong quy tắc phục vụ cộng đồng ạ. Em luôn sẵn sàng hỗ trợ Quý khách hết mình về tìm kiếm sản phẩm nội địa Nhật, tra cứu link, hình ảnh, kiến thức sale và cách tính cước vận chuyển. Kính mong Quý khách thông cảm cho em ạ! 🌸🍌`
      : `Dạ em xin phép từ chối trả lời về nội dung nhạy cảm này nha anh/chị ơi! ChillBanana AI ưu tiên hỗ trợ tìm kiếm sản phẩm Nhật xịn sò, link mua hàng, hình ảnh, kinh nghiệm săn sale và tính bill cước vận chuyển nè. Anh/chị cần hỏi mua món gì từ Nhật cứ nhắn em ngay nhé! 🍌✨`;
  }

  const personalityPrompt =
    personality === "omotenashi"
      ? "Phong cách: Omotenashi Nhật Bản - Kính cẩn, lễ phép, chu đáo, xưng Em, gọi Quý khách."
      : "Phong cách: Thân thiện Chill Việt Nam - Vui vẻ, gần gũi, xưng Em, gọi Anh/Chị/Bạn, nhiệt tình mách mẹo săn deal, tư vấn sale hời.";

  const products = (await prisma.product.findMany({
    where: { stockSlots: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: 30, // Limit context to 30 products to avoid huge prompt
  })) as unknown as CuratedProduct[];
  const liveRateData = await fetchLiveExchangeRate();
  const liveRate = liveRateData.rate;
  const systemInstruction = buildSystemInstruction(products, liveRate, liveRateData.isStale);

  const contents = conversationHistory.slice(-8).map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.text }],
  }));
  contents.push({
    role: "user",
    parts: [{ text: `[Phong cách yêu cầu: ${personalityPrompt}]\n\nKhách hỏi: ${userQuery}` }],
  });

  // Sprint 2: Multi-API Key Failover
  let attemptCount = 0;
  const maxAttempts = 3;

  while (attemptCount < maxAttempts) {
    attemptCount++;
    const activeKey = chatKeyPool.getNextKey();

    if (!activeKey) {
      console.warn(`[GeminiPool] Tất cả chat keys đang bị rate-limit. Trả về fallback.`);
      break;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const candidate = data?.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const textPart = parts.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).pop();
        const text = textPart?.text;

        if (text && text.trim().length > 0) {
          return text.trim();
        }
      } else {
        chatKeyPool.markError(activeKey, response.status);
      }
    } catch {
      chatKeyPool.markError(activeKey, 500);
    }
  }

  return isOmo
    ? `Dạ xin lỗi Quý khách, hiện tại hệ thống AI đang tạm gián đoạn kết nối. Quý khách vui lòng thử lại sau ít phút hoặc dán link sản phẩm từ Amazon JP / Mercari vào công cụ **"Dán Link Tính Giá"** ở đầu trang web để tính giá tự động ạ! 🍌`
    : `Dạ xin lỗi anh/chị, hệ thống AI đang tạm gián đoạn. Anh/chị thử lại sau ít phút hoặc dán link sản phẩm vào ô **"Dán Link Tính Giá"** ở trên trang web để tính giá tự động nha! 🍌`;
}
