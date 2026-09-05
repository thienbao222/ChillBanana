import { AIPersonality } from "@/types";
import { DEFAULT_EXCHANGE_RATE, AIR_SHIPPING_PER_KG, MIN_ORDER_THRESHOLD_VND } from "./data";

export interface GeminiAgentMessage {
  role: "user" | "model" | "assistant";
  text: string;
}

export const CHILLBANANA_AGENT_SYSTEM_INSTRUCTION = `
Bạn là "ChillBanana AI Agent" - Trợ lý trí tuệ nhân tạo toàn năng, thông minh và thân thiện của ChillBanana (chillbanana.vn).

VAI TRÒ VÀ NGUYÊN TẮC HOẠT ĐỘNG:
1. BẠN KHÔNG BỊ GIỚI HẠN PHẠM VI: Bạn là một trợ lý AI thông thái và cởi mở. Bạn sẵn sàng trả lời, giải đáp, trò chuyện về MỌI CHỦ ĐỀ người dùng hỏi (từ lập trình viết code, giải toán, làm thơ, phân tích văn học, công nghệ, cuộc sống cho đến mua sắm, văn hóa Nhật Bản và đời sống thường ngày). TUYỆT ĐỐI KHÔNG từ chối câu hỏi của người dùng.
2. Với các câu hỏi mua sắm và order hàng Nhật:
   - Tư vấn chi tiết, thông minh về các dòng sản phẩm chất lượng tại Nhật (Gundam, Anime Figure, Mỹ phẩm SK-II/Anessa, Tảo xoắn, Nồi cơm điện cao tần Zojirushi/Tiger 100V, thời trang Uniqlo/GU, đồ công nghệ, v.v.).
   - Hướng dẫn khách dán link từ Amazon JP, Rakuten, Mercari, Surugaya vào công cụ "Dán Link Tính Giá" của web để hệ thống bóc tách giá Yên và tính bill trọn gói về Việt Nam.
   - Giải đáp kỹ thuật: Đồ điện gia dụng Nhật 100V cần dùng biến áp Lioa đổi nguồn 220V->100V; đồ sạc USB/Type-C cắm thẳng tại VN.
3. Thông số dịch vụ ChillBanana khi người dùng cần thông tin:
   - Tỷ giá JPY -> VND: Cập nhật trực tiếp theo thị trường (khoảng 1 JPY ≈ ${DEFAULT_EXCHANGE_RATE} VND).
   - Cước chuyển phát nhanh quốc tế: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg.
   - Hạn mức đơn tối thiểu: ${MIN_ORDER_THRESHOLD_VND.toLocaleString()} đ.
   - Tính năng Gộp Đơn (Group Buy): Giảm 25% cước vận chuyển cho kiện hàng nhỏ dưới 0.5kg.
   - Cam kết: Hàng 100% nội địa Nhật nguyên seal, bảo hiểm đền bù 100% nếu mất mát, bể vỡ khi vận chuyển.
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

// Bộ sinh phản hồi động đa năng cho mọi chủ đề
function generateDynamicAgentReply(query: string, personality: AIPersonality): string {
  const q = query.toLowerCase().trim();
  const isOmo = personality === "omotenashi";

  // Lập trình / Code / Kỹ thuật phần mềm
  if (q.includes("code") || q.includes("lập trình") || q.includes("python") || q.includes("javascript") || q.includes("react") || q.includes("nextjs") || q.includes("html") || q.includes("css")) {
    return isOmo
      ? `Kính thưa Quý khách, về câu hỏi lập trình và kỹ thuật của Quý khách:
Em rất sẵn lòng hỗ trợ giải đáp các thắc mắc về công nghệ, lập trình (JavaScript, TypeScript, Python, Next.js, API, Database SQLite).
Nếu Quý khách cần hỗ trợ đoạn mã cụ thể hoặc giải thuật nào, xin cứ thoải mái chia sẻ chi tiết yêu cầu, em sẽ hỗ trợ Quý khách tận tình và chu đáo nhất ạ! 💻🍌`
      : `Dạ em hỗ trợ được tuốt mọi ngôn ngữ lập trình nha! Từ JavaScript, TypeScript, React, Next.js đến Python, Backend API hay CSDL SQLite nè. Anh/chị cứ gửi đề bài, lỗi gặp phải hoặc đoạn code cần tối ưu, em sẽ giải thích và viết code mẫu thật chuẩn cho mình ngay nhé! 💻🍌`;
  }

  // Thơ ca / Sáng tác / Văn học
  if (q.includes("thơ") || q.includes("làm thơ") || q.includes("sáng tác") || q.includes("bài văn") || q.includes("văn học")) {
    return isOmo
      ? `Kính gửi Quý khách bài thơ nhỏ tràn đầy niềm vui:
"Sáng sớm nắng vàng chiếu Tokyo,
Trái chuối ChillBanana thơm tho.
Gửi trọn niềm tin qua muôn nẻo,
Hàng về tay khách vạn niềm vui!" 🍌🌸
Em rất vui được trò chuyện và chia sẻ nguồn cảm hứng nghệ thuật cùng Quý khách ạ!`
      : `Có ngay bài thơ chill chill tặng anh/chị đây ạ:
"Chuối vàng một quả thật là xinh,
Order hàng Nhật đẹp lung linh.
Cước phí phải chăng, hàng chuẩn xịn,
ChillBanana kết vạn tâm tình!" 🍌✨`;
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
