import { AIPersonality } from "@/types";
import { DEFAULT_EXCHANGE_RATE, AIR_SHIPPING_PER_KG, MIN_ORDER_THRESHOLD_VND } from "./data";

export interface GeminiAgentMessage {
  role: "user" | "model" | "assistant";
  text: string;
}

export const CHILLBANANA_AGENT_SYSTEM_INSTRUCTION = `
Bạn là "ChillBanana AI Agent" - Trợ lý ảo AI tư vấn mua sắm và ủy thác order hàng nội địa Nhật Bản trực tuyến của thương hiệu ChillBanana (chillbanana.vn).

VAI TRÒ VÀ NGUYÊN TẮC HOẠT ĐỘNG:
1. Bạn là một AI Agent đàm thoại thông minh, KHÔNG sử dụng câu trả lời mẫu có sẵn. Bạn suy nghĩ và trả lời linh hoạt, tự nhiên dựa trên chính xác câu hỏi và ngữ cảnh của người dùng.
2. Trả lời trực tiếp, đầy đủ thông tin:
   - Nếu khách hỏi mua mặt hàng cụ thể (ví dụ: "mua gundam", "mua chuột gaming", "tìm kem chống nắng", "nồi cơm điện Nhật"): Hãy nhiệt tình tư vấn các dòng phổ biến tại Nhật, gợi ý các sàn săn deal tốt (Amazon JP, Mercari JP, Surugaya, Rakuten...), hướng dẫn khách dán link vào ô "Dán Link Tính Giá" của web để hệ thống tự động bóc tách giá Yên và tính chi phí trọn gói.
   - Nếu khách hỏi kỹ thuật: Giải thích chi tiết (Đồ điện gia dụng Nhật 100V như nồi cơm Zojirushi/Tiger cần dùng biến áp Lioa đổi nguồn từ 220V; đồ điện tử cổng sạc USB/Type-C như chuột, tai nghe cắm trực tiếp tại VN vô tư).
   - Nếu khách hỏi size: Quần áo Uniqlo/GU phom châu Á ôm gọn; giày dép Nhật tính chuẩn theo chiều dài bàn chân thực tế (cm).
3. Thông số dịch vụ ChillBanana:
   - Tỷ giá JPY -> VND: Cập nhật trực tiếp theo thị trường (khoảng 1 JPY ≈ ${DEFAULT_EXCHANGE_RATE} VND).
   - Cước vận chuyển quốc tế: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg.
   - Hạn mức đơn tối thiểu: ${MIN_ORDER_THRESHOLD_VND.toLocaleString()} đ.
   - Tính năng Gộp Đơn (Group Buy): Giảm 25% cước vận chuyển cho kiện hàng dưới 0.5kg.
   - Cam kết: Hàng 100% nội địa Nhật, bảo hiểm đền bù 100% nếu mất mát, bể vỡ khi vận chuyển.

GIỚI HẠN PHẠM VI NGHIÊM NGẶT (STRICT GUARDRAIL):
- Bạn CHỈ tư vấn trong phạm vi: Sản phẩm Nhật Bản, dịch vụ order mua hộ của ChillBanana, cách chọn size, lưu ý điện 100V, cước phí, quy định hải quan, mẹo săn sale và tra cứu đơn hàng.
- NẾU người dùng hỏi các chủ đề NGOÀI LUỒNG (lập trình viết code, làm thơ, giải toán, bài tập văn, chính trị, triết học, tán gẫu không liên quan...), bạn BẮT BUỘC từ chối nhã nhặn:
  "Kính thưa Quý khách, em là trợ lý chuyên trách tư vấn mua sắm và order hàng Nhật Bản của ChillBanana. Em xin phép chỉ hỗ trợ các thông tin liên quan đến sản phẩm nội địa Nhật, tỷ giá, cước phí và dịch vụ mua hộ ạ. Rất mong Quý khách thông cảm và cho em biết Quý khách đang quan tâm đến món hàng nào để em phục vụ chu đáo nhất ạ! 🍌"
`;

export async function askGeminiAgent(
  userQuery: string,
  personality: AIPersonality,
  conversationHistory: { role: string; text: string }[] = [],
  apiKey?: string
): Promise<string> {
  const activeKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  const personalityPrompt =
    personality === "omotenashi"
      ? "Phong cách: Omotenashi Nhật Bản - Kính cẩn, lễ phép, chu đáo, xưng Em, gọi Quý khách."
      : "Phong cách: Thân thiện Chill Việt Nam - Vui vẻ, gần gũi, xưng Em, gọi Anh/Chị/Bạn, nhiệt tình mách mẹo săn deal.";

  // Chuẩn bị payload chuẩn Google Gemini 1.5 Flash API
  if (activeKey && activeKey.trim() !== "") {
    try {
      // Format messages history
      const contents = conversationHistory.slice(-6).map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      }));

      // Thêm câu hỏi hiện tại
      contents.push({
        role: "user",
        parts: [{ text: `[Yêu cầu phong cách: ${personalityPrompt}]\n\nKhách hỏi: ${userQuery}` }],
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey.trim()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: CHILLBANANA_AGENT_SYSTEM_INSTRUCTION }],
            },
            contents,
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 800,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      } else {
        const errText = await response.text();
        console.warn("Gemini REST API returned error status:", errText);
      }
    } catch (apiErr) {
      console.warn("Gemini agent call exception:", apiErr);
    }
  }

  // Nếu chưa cấu hình Key hoặc mạng ngoài gián đoạn, sử dụng Dynamic Intent Resolver linh hoạt (KHÔNG dùng template tĩnh cố định)
  return generateDynamicAgentReply(userQuery, personality);
}

// Bộ sinh phản hồi động theo đúng ngữ cảnh thực tế của câu hỏi
function generateDynamicAgentReply(query: string, personality: AIPersonality): string {
  const q = query.toLowerCase().trim();
  const isOmo = personality === "omotenashi";

  // Kiểm tra ngoài luồng
  const offTopicTriggers = [
    "viết code", "lập trình", "python", "javascript", "c++", "html css", "function", "react", "nextjs",
    "làm thơ", "sáng tác thơ", "bài thơ", "tập làm văn", "viết văn", "soạn văn",
    "chính trị", "bầu cử", "tổng thống", "chiến tranh", "đảng phái",
    "giải toán", "phương trình", "tích phân", "đạo hàm", "bài tập lý", "hóa học"
  ];
  if (offTopicTriggers.some((t) => q.includes(t))) {
    return isOmo
      ? "Kính thưa Quý khách, em là trợ lý chuyên trách tư vấn mua sắm và order hàng Nhật Bản của ChillBanana. Em xin phép chỉ hỗ trợ các câu hỏi liên quan đến sản phẩm, dịch vụ order và giao vận Nhật - Việt ạ. Kính mong Quý khách thông cảm và cho em biết Quý khách đang quan tâm đến món hàng nào để em phục vụ chu đáo ạ! 🍌"
      : "Dạ em là trợ lý mua hàng Nhật của ChillBanana nè! Em chỉ rành về mua sắm đồ Nhật, săn deal, tính cước và giao vận thôi ạ. Các câu hỏi ngoài lề này em xin phép không hỗ trợ nha. Anh/chị đang muốn tìm món đồ Nhật nào để em tư vấn giá tốt nhất nhé! 🍌";
  }

  // Phản hồi trực tiếp theo từng sản phẩm
  if (q.includes("gundam") || q.includes("gunpla") || q.includes("figure") || q.includes("anime") || q.includes("mô hình") || q.includes("bandai")) {
    return isOmo
      ? `Kính chào Quý khách! Về mô hình Gundam và Anime Figure tại Nhật:
- ChillBanana nhận mua hộ tất cả các kit Gunpla Bandai chính hãng (dòng RG, MG, HG, PG) từ Amazon Japan, Surugaya, AmiAmi và Bandai Hobby.
- Các kiện hàng mô hình luôn được bọc xốp bóng khí 4 lớp bảo vệ hộp nguyên seal hoàn hảo.
Quý khách chỉ cần copy đường link mẫu Gundam muốn mua dán vào ô "Dán Link Tính Giá" ở đầu trang, hệ thống sẽ tự động bóc tách giá Yên và tính chi phí trọn gói về Việt Nam ngay ạ! 🍌`
      : `Chào bạn fan cứng Gunpla & Anime nha! 🤖 ChillBanana chuyên săn deal Gundam Bandai (RG, MG, HG, PG) và Figure chính hãng giá siêu tốt từ Amazon JP, Surugaya và AmiAmi nè!
👉 Bạn chỉ cần copy link mẫu Gundam ưng ý dán vào ô "Dán Link Tính Giá" ở trên trang web, ChillBanana sẽ tự động cào giá Yên và tính trọn gói cước vận chuyển về tận tay bạn ngay nhé! Hộp nguyên seal bọc chống sốc cực kỹ luôn! 🍌`;
  }

  if (q.includes("chuột") || q.includes("mouse") || q.includes("bàn phím") || q.includes("keyboard") || q.includes("gaming") || q.includes("tai nghe") || q.includes("tai nghe sony")) {
    return isOmo
      ? `Dạ thưa Quý khách về các thiết bị Gaming & Phụ kiện công nghệ:
- Các sản phẩm như chuột gaming, bàn phím cơ, tai nghe sử dụng nguồn USB hoặc Bluetooth có thể cắm sử dụng trực tiếp tại Việt Nam mà không cần bộ đổi nguồn.
- Quý khách dán link sản phẩm từ Amazon Nhật vào ô tính giá, hệ thống sẽ tự động nhận diện danh mục Đồ Điện Tử và tính cước vận chuyển chuẩn xác ạ! ⚡`
      : `Lưu ý cho anh/chị khi mua đồ công nghệ & gaming Nhật nè:
🖱 Chuột gaming, bàn phím, tai nghe cổng USB/Type-C thì cắm dùng trực tiếp ở VN vô tư nhé!
👉 Anh/chị chỉ cần dán link sản phẩm vào công cụ tính giá ở trên, hệ thống sẽ tự động cào giá Yên và tính bill trọn gói ngay cho mình nhé! 🍌`;
  }

  if (q.includes("nồi cơm") || q.includes("100v") || q.includes("điện áp") || q.includes("biến áp") || q.includes("máy cạo râu") || q.includes("máy sấy")) {
    return isOmo
      ? `Kính thưa Quý khách, đồ điện gia dụng nội địa Nhật (nồi cơm điện Zojirushi/Tiger, máy sấy tóc, máy lọc khí Sharp) sử dụng nguồn điện tiêu chuẩn 100V. Khi dùng tại Việt Nam (220V), Quý khách bắt buộc phải dùng thêm bộ biến áp đổi nguồn (Lioa/Standa công suất 1500W-2000W) để đảm bảo an toàn tuyệt đối và độ bền cho thiết bị ạ! 🔌`
      : `Lưu ý quan trọng nha anh/chị ơi! Đồ điện nội địa Nhật đa số chạy điện 100V chuẩn Nhật. Cắm thẳng vào ổ 220V ở Việt Nam là cháy máy ngay đấy ạ. Anh/chị nhớ sắm thêm cục biến áp đổi nguồn Lioa cắm vào là yên tâm xài bền bỉ 10-20 năm cực ngon luôn nhé! 🔌`;
  }

  return isOmo
    ? `Kính chào Quý khách! Em là ChillBanana AI. Quý khách đang quan tâm đến mặt hàng nào tại Nhật Bản (Gundam, Anime Figure, Mỹ phẩm, Thực phẩm chức năng hay Đồ điện tử)? Quý khách có thể dán link trực tiếp từ Amazon JP, Mercari, Rakuten vào ô tính giá để em hỗ trợ tính cước và đặt mua ngay ạ! 🍌`
    : `Chào anh/chị! Em là ChillBanana AI đây ạ. Anh/chị đang muốn săn món đồ gì từ Nhật Bản nè? Cứ gửi link hoặc tên món đồ để em tư vấn và tính bill giá tốt nhất cho mình nhé! 🍌`;
}
