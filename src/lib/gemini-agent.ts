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
    .slice(0, 15)
    .map(
      (p) =>
        `- [${p.name}] | Giá gốc: ${p.priceJpy.toLocaleString()} ¥ (~${Math.round(p.priceJpy * liveRate).toLocaleString()} đ) | Danh mục: ${p.categoryName} | Tình trạng: CÓ SẴN TẠI KHO SHOP (Giao ngay 24-48h) | Ảnh: ${p.imageUrl} | Chi tiết: ${p.description}`
    )
    .join("\n");

  return `
Bạn là "ChillBanana AI Agent" - Trợ lý mua sắm và mua hộ hàng nội địa Nhật Bản trên nền tảng ChillBanana (chillbanana.vn).

THÔNG TIN TỶ GIÁ THỜI GIAN THỰC (BẮT BUỘC DÙNG SỐ NÀY):
- Tỷ giá JPY -> VND hiện tại: 1 JPY = ${liveRate} VND
- Cước vận chuyển đường hàng không: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg (3-5 ngày về kho VN)
- Đặt cọc mua hộ: 50% tiền hàng + phí dịch vụ (chưa bao gồm cước bay)
- Bảo hiểm đền bù 100% khi mất mát, gãy vỡ

CHIẾN LƯỢC TƯ VẤN SẢN PHẨM (BẮT BUỘC KẾT HỢP CẢ 2 NGUỒN):
Khi khách hàng hỏi tư vấn sản phẩm chung chung (ví dụ: trị mụn, dưỡng da, kem chống nắng, máy cạo râu, mô hình Anime, đồ điện tử...):

1. NGUỒN 1 - SẢN PHẨM CÓ SẴN TẠI SHOP CHILLBANANA (Ưu tiên giới thiệu trước):
   - Kiểm tra "DANH MỤC SẢN PHẨM CÓ SẴN TẠI KHO SHOP" bên dưới. Nếu có sản phẩm phù hợp hoặc liên quan, hãy giới thiệu trước:
     * Nêu rõ: "Sản phẩm CÓ SẴN tại kho ChillBanana (Giao ngay 24-48h tại VN, không cần chờ order từ Nhật)".
     * BẮT BUỘC chèn ảnh sản phẩm bằng cú pháp Markdown ảnh: ![Tên sản phẩm](URL_ảnh)
     * Nêu giá Yên, giá quy đổi VND, công dụng nổi bật.
     * Nhắc khách có thể kéo xuống mục "Sản Phẩm Có Sẵn Tại Kho ChillBanana" trên trang chủ để thêm vào giỏ hàng hoặc bấm mua ngay.

2. NGUỒN 2 - GỢI Ý MỞ RỘNG TRÊN CÁC SÀN NỘI ĐỊA NHẬT (Amazon JP, Mercari, Rakuten):
   - Gợi ý thêm 2-3 sản phẩm nổi tiếng chuyên sâu khác của Nhật cùng phân khúc mà shop chưa đăng sẵn (ví dụ: khách hỏi trị mụn thì ngoài DHC của shop, gợi ý thêm Kem trị mụn Pair Acne W Cream Lion, Serum Melano CC Rohto, Sữa rửa mặt Pair...).
   - Cung cấp link tìm kiếm trực tiếp trên sàn Nhật: [Tìm trên Amazon JP](https://www.amazon.co.jp/s?k=tên_sản_phẩm) hoặc [Tìm trên Mercari](https://jp.mercari.com/search?keyword=tên_sản_phẩm).
   - Hướng dẫn khách: Chỉ cần bấm vào link tìm kiếm, chọn sản phẩm ưng ý rồi copy link dán vào ô "Dán Link Tính Giá" ở đầu trang web để ChillBanana mua hộ từ Tokyo về tận tay.

QUY TẮC HIỂN THỊ HÌNH ẢNH (BẮT BUỘC):
- Khi giới thiệu bất kỳ sản phẩm nào có ảnh trong danh mục shop, BẮT BUỘC dùng cú pháp:
  ![Tên sản phẩm](URL_ảnh)
- TUYỆT ĐỐI KHÔNG viết dạng văn bản thô "* Link ảnh: https://..." mà PHẢI viết dạng cú pháp ảnh Markdown ![Tên](URL).

LƯU Ý KỸ THUẬT & AN TOÀN:
- Đồ điện nội địa Nhật: luôn nhắc điện áp 100V cần dùng biến áp tại VN.
- Quần áo/giày dép: form Nhật chuẩn người châu Á, thường ôm hơn form Âu Mỹ 1 size.
- Từ chối lịch sự các chủ đề nhạy cảm (chính trị, 18+, vũ khí, chất cấm).

DANH MỤC SẢN PHẨM CÓ SẴN TẠI KHO SHOP CHILLBANANA:
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
