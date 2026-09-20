import { AIPersonality, CuratedProduct } from "@/types";
import { AIR_SHIPPING_PER_KG } from "./data";
import { getAllProducts } from "./product-store";
import { fetchLiveExchangeRate } from "./exchange-rate";

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

export function buildSystemInstruction(products: CuratedProduct[], liveRate: number): string {
  const catalogSummary = products
    .slice(0, 12)
    .map(
      (p) =>
        `- [${p.name}] | Giá: ${p.priceJpy.toLocaleString()} ¥ (~${Math.round(p.priceJpy * liveRate).toLocaleString()} đ) | Danh mục: ${p.categoryName} | Kho: ${p.originalStore} | Link ảnh: ${p.imageUrl} | Chi tiết: ${p.description}`
    )
    .join("\n");

  return `
Bạn là "ChillBanana AI Agent" - Trợ lý mua hộ hàng Nhật Bản cho nền tảng chillbanana.vn.

THÔNG TIN TỶ GIÁ THỜI GIAN THỰC (BẮT BUỘC DÙNG SỐ NÀY):
- Tỷ giá JPY -> VND hiện tại: 1 JPY = ${liveRate} VND
- Cước vận chuyển đường hàng không: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg (3-5 ngày về kho)
- Đặt cọc: 50% tổng giá sản phẩm + phí dịch vụ
- Bảo hiểm đền bù 100% khi mất mát, gãy vỡ

NGUYÊN TẮC TRẢ LỜI:
1. TỰ SUY NGHĨ VÀ TRẢ LỜI TỰ NHIÊN: Hãy suy nghĩ và phản hồi bằng lời của bạn dựa trên kiến thức thực tế. KHÔNG dùng câu mẫu, văn mẫu soạn sẵn. Trả lời ngắn gọn, đúng trọng tâm.
2. KHI TƯ VẤN SẢN PHẨM: Đưa ra gợi ý cụ thể với giá JPY và quy đổi VND theo tỷ giá ${liveRate} đ/JPY ở trên. Cung cấp link tìm kiếm trên các sàn Nhật (Amazon JP, Mercari, Surugaya).
3. HƯỚNG DẪN ĐẶT HÀNG: Nhắc khách dán link sản phẩm vào công cụ "Dán Link Tính Giá" ở đầu trang web để tính giá tự động.
4. AN TOÀN: Lịch sự từ chối các câu hỏi nhạy cảm (chính trị, 18+, vũ khí, ma túy).
5. ĐIỆN ÁP: Nhắc khách về điện áp 100V của đồ gia dụng Nhật khi được hỏi.

DANH MỤC SẢN PHẨM HIỆN CÓ TRÊN HỆ THỐNG:
${catalogSummary}
`;
}

export async function askGeminiAgent(
  userQuery: string,
  personality: AIPersonality,
  conversationHistory: { role: string; text: string }[] = [],
  apiKey?: string
): Promise<string> {
  const isOmo = personality === "omotenashi";

  // 1. Kiểm tra an toàn trước: Lịch sự từ chối các vấn đề nhạy cảm
  if (isSensitiveTopic(userQuery)) {
    return isOmo
      ? `Dạ kính thưa Quý khách, em xin phép lịch sự từ chối phản hồi về chủ đề này do tính chất nhạy cảm và không nằm trong quy tắc phục vụ cộng đồng ạ. Em luôn sẵn sàng hỗ trợ Quý khách hết mình về tìm kiếm sản phẩm nội địa Nhật, tra cứu link, hình ảnh, kiến thức sale và cách tính cước vận chuyển. Kính mong Quý khách thông cảm cho em ạ! 🌸🍌`
      : `Dạ em xin phép từ chối trả lời về nội dung nhạy cảm này nha anh/chị ơi! ChillBanana AI ưu tiên hỗ trợ tìm kiếm sản phẩm Nhật xịn sò, link mua hàng, hình ảnh, kinh nghiệm săn sale và tính bill cước vận chuyển nè. Anh/chị cần hỏi mua món gì từ Nhật cứ nhắn em ngay nhé! 🍌✨`;
  }

  const activeKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  const personalityPrompt =
    personality === "omotenashi"
      ? "Phong cách: Omotenashi Nhật Bản - Kính cẩn, lễ phép, chu đáo, xưng Em, gọi Quý khách."
      : "Phong cách: Thân thiện Chill Việt Nam - Vui vẻ, gần gũi, xưng Em, gọi Anh/Chị/Bạn, nhiệt tình mách mẹo săn deal, tư vấn sale hời.";

  const products = getAllProducts();
  
  // Lấy tỷ giá live trước khi truyền vào system instruction
  const liveRateData = await fetchLiveExchangeRate();
  const liveRate = liveRateData.rate;
  const systemInstruction = buildSystemInstruction(products, liveRate);

  // 2. Gọi Google Gemini 2.5 Flash API
  if (activeKey && activeKey.trim() !== "") {
    try {
      const contents = conversationHistory.slice(-8).map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      }));

      // Thêm câu hỏi hiện tại kèm chỉ dẫn phong cách
      contents.push({
        role: "user",
        parts: [{ text: `[Phong cách yêu cầu: ${personalityPrompt}]\n\nKhách hỏi: ${userQuery}` }],
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey.trim()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
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
        const finishReason = candidate?.finishReason;
        // Khi thinking bật, Gemini trả về nhiều parts: thought parts trước, text part cuối
        const parts = candidate?.content?.parts || [];
        const textPart = parts.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).pop();
        const text = textPart?.text;
        
        console.log(`[Gemini 2.5] FinishReason: ${finishReason}, parts: ${parts.length}, liveRate: ${liveRate}`);
        
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      } else {
        const errText = await response.text();
        console.warn("Gemini 2.5 Flash API returned error, falling back:", errText);
      }
    } catch (apiErr) {
      console.warn("Gemini 2.5 agent exception:", apiErr);
    }
  }

  // 3. Fallback ngắn gọn khi API không khả dụng
  return isOmo
    ? `Dạ xin lỗi Quý khách, hiện tại hệ thống AI đang tạm gián đoạn kết nối. Quý khách vui lòng thử lại sau ít phút hoặc dán link sản phẩm từ Amazon JP / Mercari vào công cụ **"Dán Link Tính Giá"** ở đầu trang web để tính giá tự động ạ! 🍌`
    : `Dạ xin lỗi anh/chị, hệ thống AI đang tạm gián đoạn. Anh/chị thử lại sau ít phút hoặc dán link sản phẩm vào ô **"Dán Link Tính Giá"** ở trên trang web để tính giá tự động nha! 🍌`;
}
