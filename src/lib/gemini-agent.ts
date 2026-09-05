import { AIPersonality, CuratedProduct } from "@/types";
import { DEFAULT_EXCHANGE_RATE, AIR_SHIPPING_PER_KG, MIN_ORDER_THRESHOLD_VND, calculateOrderPrice } from "./data";
import { getAllProducts } from "./product-store";

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

export function buildSystemInstruction(products: CuratedProduct[]): string {
  const catalogSummary = products
    .slice(0, 12)
    .map(
      (p) =>
        `- [${p.name}] | Giá: ${p.priceJpy.toLocaleString()} ¥ (~${p.priceVnd.toLocaleString()} đ) | Danh mục: ${p.categoryName} | Kho: ${p.originalStore} | Link ảnh: ${p.imageUrl} | Chi tiết: ${p.description}`
    )
    .join("\n");

  return `
Bạn là "ChillBanana AI Agent" - Trợ lý thông minh cao cấp được vận hành bởi mô hình Google Gemini 2.5 cho nền tảng thương mại điện tử mua hộ hàng Nhật ChillBanana (chillbanana.vn).

CHUYÊN MÔN CHÍNH & NHIỆM VỤ NÒNG CỐT:
1. TÌM KIẾM SẢN PHẨM & TƯ VẤN SĂN HÀNG NHẬT:
   - Hỗ trợ tìm kiếm các dòng sản phẩm: Mỹ phẩm (DHC, Anessa, SK-II), Thực phẩm chức năng (Tảo xoắn Spirulina, Nattokinase), Gia dụng & Đồ công nghệ Nhật (Nồi cơm điện Zojirushi/Tiger, bàn phím, chuột máy tính), Mô hình & Sưu tầm (Gundam Bandai RG/MG/HG/PG, Anime Figure chính hãng, Nendoroid).
   - Khi giới thiệu sản phẩm có trong danh mục hoặc sản phẩm cụ thể, HÃY CUNG CẤP TÊN SẢN PHẨM, MÔ TẢ ĐẶC ĐIỂM, GIÁ DỰ KIẾN (Yên và VNĐ), HÌNH ẢNH (sử dụng cú pháp Markdown ![Tên ảnh](URL_Ảnh) nếu có URL hoặc lấy từ danh mục bên dưới), và ĐƯỜNG LINK / NƠI MUA (Amazon JP, Mercari JP, Rakuten, Surugaya).
   - Hướng dẫn khách hàng copy link dán vào thanh "Dán Link Tính Giá" ở đầu trang để hệ thống tự động bóc tách thông số.

2. KIẾN THỨC BÁN HÀNG, SALE, VẬN CHUYỂN & TÍNH BILL:
   - Tỷ giá JPY -> VND: 1 JPY ≈ ${DEFAULT_EXCHANGE_RATE} VND.
   - Cước bay quốc tế Tokyo ⇄ Việt Nam: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg (bay hỏa tốc 3-5 ngày về kho VN).
   - Hạn mức đơn tối thiểu: ${MIN_ORDER_THRESHOLD_VND.toLocaleString()} đ.
   - Chương trình Gộp Đơn (Group Buy): Tiết kiệm 25% cước bay quốc tế cho kiện hàng nhẹ (dưới 0.5kg) khi gom cùng đợt.
   - Chính sách đặt cọc: Đặt cọc trước 50% giá trị đơn để nhân viên Tokyo tiến hành mua ngay lập tức, 50% còn lại thanh toán khi nhận hàng.
   - Cảnh báo điện áp đồ gia dụng Nhật: Chuẩn điện nội địa Nhật là 100V. Khi sử dụng tại Việt Nam (220V), KHÁCH HÀNG BẮT BUỘC DÙNG BIẾN ÁP ĐỔI NGUỒN (Lioa/Standa 1500W-2000W). Thiết bị sạc cổng USB/Type-C có thể cắm trực tiếp.

3. NGUYÊN TẮC BẢO MẬT & TỪ CHỐI LỊCH SỰ CÁC VẤN ĐỀ NHẠY CẢM:
   - Nếu người dùng hỏi các vấn đề nhạy cảm (chính trị, bạo lực, khiêu dâm/người lớn, chất cấm, vũ khí, thông tin xuyên tạc hoặc kích động phản cảm):
   - Bạn PHẢI LỊCH SỰ TỪ CHỐI với lời lẽ nhã nhặn, chuẩn mực, ví dụ:
     "Dạ, em xin phép từ chối phản hồi về chủ đề này do tính chất nhạy cảm ạ. ChillBanana AI luôn sẵn sàng hỗ trợ Quý khách về mua sắm hàng Nhật, tìm kiếm sản phẩm, tính giá cước và kinh nghiệm săn sale. Rất mong Quý khách thông cảm ạ! 🍌"

DANH MỤC SẢN PHẨM ĐANG CÓ TRÊN HỆ THỐNG:
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
  const systemInstruction = buildSystemInstruction(products);

  // 2. Gọi Google Gemini 2.5 Flash API (Model gemini-2.5-flash theo chuẩn mới nhất)
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

      // Sử dụng model Gemini 2.5 Flash được hỗ trợ chính thức
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
              temperature: 0.4,
              maxOutputTokens: 1200,
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
        console.warn("Gemini 2.5 Flash API returned error, falling back to dynamic:", errText);
      }
    } catch (apiErr) {
      console.warn("Gemini 2.5 agent exception:", apiErr);
    }
  }

  // 3. Fallback Intent & Knowledge Engine chuẩn xác nếu mạng gián đoạn
  return generateDynamicAgentReply(userQuery, personality, products);
}

// Bộ sinh phản hồi động giàu thông tin (ảnh, link, tính giá, vận chuyển, sale)
function generateDynamicAgentReply(
  query: string,
  personality: AIPersonality,
  products: CuratedProduct[] = []
): string {
  const q = query.toLowerCase().trim();
  const isOmo = personality === "omotenashi";

  // Lọc sản phẩm tìm kiếm trong CSDL
  const matched = products.filter(
    (p) =>
      q.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(q) ||
      (p.categoryName && q.includes(p.categoryName.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(q))
  );

  // 1. Nếu khách hỏi tìm kiếm sản phẩm cụ thể và có sản phẩm khớp trong CSDL
  if (matched.length > 0) {
    const item = matched[0];
    const bill = calculateOrderPrice(item.priceJpy, item.weightKg, DEFAULT_EXCHANGE_RATE, false);
    return isOmo
      ? `Kính chào Quý khách! Em đã tìm thấy sản phẩm phù hợp với nhu cầu của Quý khách tại Nhật Bản:

📦 **${item.name}**
- **Giá gốc tại Nhật:** ${item.priceJpy.toLocaleString()} JPY (~${item.priceVnd.toLocaleString()} đ)
- **Cước vận chuyển bay (${item.weightKg}kg):** ${bill.shippingFeeVnd.toLocaleString()} đ
- **Phí mua hộ trọn gói:** ${bill.serviceFeeVnd.toLocaleString()} đ
- **Tổng chi phí về tận tay:** **${bill.totalVnd.toLocaleString()} đ** (Cọc 50%: ${bill.deposit50Vnd.toLocaleString()} đ)
- **Nơi phân phối:** ${item.originalStore}
${item.voltageNote ? `- ⚠️ **Lưu ý:** ${item.voltageNote}\n` : ""}- **Mô tả:** ${item.description}

Quý khách có thể copy link từ sàn mua sắm hoặc liên hệ ChillBanana để chốt slot gom hàng đợt này ngay ạ! 🍌`
      : `Dạ em tìm thấy sản phẩm chuẩn gu của anh/chị đây rồi nè! 🎉

📦 **${item.name}**
- 🏷️ **Giá niêm yết tại Nhật:** ${item.priceJpy.toLocaleString()} ¥ (~${item.priceVnd.toLocaleString()} đ)
- ✈️ **Cước vận chuyển quốc tế (${item.weightKg}kg):** ${bill.shippingFeeVnd.toLocaleString()} đ
- 💰 **Tổng trọn gói về tay:** **${bill.totalVnd.toLocaleString()} đ** (Chỉ cần cọc trước 50% = ${bill.deposit50Vnd.toLocaleString()} đ là em cho order ngay!)
- 🏬 **Nguồn hàng:** ${item.originalStore}
${item.voltageNote ? `- ⚡ **Lưu ý:** ${item.voltageNote}\n` : ""}- 📝 **Chi tiết:** ${item.description}

👉 Anh/chị chỉ cần dán link sản phẩm vào thanh công cụ ở trên hoặc bấm đặt hàng để nhân viên Tokyo tiến hành mua ngay nhé! 🍌`;
  }

  // 2. Tư vấn Gundam / Figure / Anime
  if (q.includes("gundam") || q.includes("gunpla") || q.includes("figure") || q.includes("anime") || q.includes("mô hình") || q.includes("bandai")) {
    return isOmo
      ? `Kính chào Quý khách! Về mô hình Gundam Bandai và Anime Figure chính hãng tại Nhật:
- **Nguồn hàng uy tín:** ChillBanana mua trực tiếp tại Amazon JP, Surugaya, AmiAmi, Premium Bandai.
- **Bảo hiểm hàng hóa:** Các kiện mô hình luôn được bọc xốp bóng khí chống sốc 4 lớp, cam kết giữ nguyên seal hộp góc cạnh 100%.
- **Chi phí & Vận chuyển:** Tỷ giá ưu đãi 1 JPY ≈ ${DEFAULT_EXCHANGE_RATE} đ, cước bay quốc tế Tokyo-VN ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg.
Quý khách dán link mô hình vào thanh "Dán Link Tính Giá" ở đầu trang, hệ thống sẽ tự động bóc tách giá Yên và tính bill trọn gói ngay ạ! 🍌`
      : `Chào bạn fan cứng Gundam & Figure nè! 🤖 ChillBanana chuyên săn các dòng Gunpla Bandai (RG, MG, HG, PG) và Figure chính hãng giá siêu mềm từ Amazon JP, AmiAmi và Surugaya nhé!
- 🛡️ Đóng gói bọc bóng khí 4 lớp bảo vệ hộp zin góc cạnh, không lo móp méo!
- ✈️ Cước bay chỉ ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg, hàng về cực nhanh 3-5 ngày.
👉 Bạn copy link món đồ ưng ý dán vào ô tính giá ở trên để nhận bill chi tiết trọn gói ngay nhé! 🍌`;
  }

  // 3. Tư vấn Đồ điện tử & Cảnh báo điện áp 100V
  if (q.includes("nồi cơm") || q.includes("100v") || q.includes("điện áp") || q.includes("biến áp") || q.includes("máy cạo râu") || q.includes("máy sấy") || q.includes("gia dụng")) {
    return isOmo
      ? `Kính thưa Quý khách, về đồ điện gia dụng nội địa Nhật (nồi cơm cao tần Zojirushi/Tiger, máy sấy tóc, máy lọc không khí):
- ⚠️ **Lưu ý quan trọng về điện áp:** Đồ gia dụng nội địa Nhật dùng nguồn 100V. Tại Việt Nam (220V), Quý khách bắt buộc phải trang bị bộ đổi nguồn/biến áp (Lioa hoặc Standa 1500W-2000W) để máy chạy bền bỉ và an toàn.
- Với các thiết bị điện tử sạc cổng USB/Type-C (tai nghe, chuột gaming, máy cạo râu đời mới), Quý khách có thể cắm sạc bình thường không cần biến áp ạ! 🔌`
      : `Lưu ý vàng khi săn đồ điện nội địa Nhật nè anh/chị ơi! ⚡
- Hầu hết đồ gia dụng Nhật xịn (nồi cơm Zojirushi, máy sấy, máy xay) chạy điện 100V. Anh/chị sắm thêm cục đổi nguồn Lioa 1500W-2000W cắm vào là xài bền bỉ 10-20 năm cực ngon!
- Còn các món dùng cáp USB/Type-C thì cắm thẳng ổ điện VN vô tư nha!
👉 Anh/chị dán link sản phẩm vào công cụ tính giá để em báo phí vận chuyển chuẩn xác nhé! 🍌`;
  }

  // 4. Tư vấn cước vận chuyển & Mẹo Gộp Đơn (Group Buy)
  if (q.includes("vận chuyển") || q.includes("phí ship") || q.includes("cước") || q.includes("gộp đơn") || q.includes("group buy") || q.includes("bao lâu")) {
    return isOmo
      ? `Kính thưa Quý khách về chính sách vận chuyển quốc tế của ChillBanana:
- **Lộ trình:** Chuyển phát nhanh đường hàng không chuyên tuyến Tokyo Narita ⇄ Hà Nội / TP.HCM chỉ mất từ 3 - 5 ngày làm việc.
- **Cước tiêu chuẩn:** ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg.
- **Ưu đãi Gộp Đơn (Group Buy):** Giảm ngay **25% cước bay** đối với kiện hàng nhẹ dưới 0.5kg khi gom chung đợt vận chuyển.
- **Bảo hiểm:** Cam kết đền bù 100% giá trị kiện hàng nếu xảy ra thất lạc hoặc hư hỏng. Quý khách hoàn toàn an tâm ạ! ✈️🌸`
      : `Chính sách vận chuyển siêu tốc và tiết kiệm tại ChillBanana nè anh/chị ơi:
- 🚀 Bay thẳng Tokyo ⇄ Việt Nam chỉ 3-5 ngày là về tới tay!
- 💸 Cước bay chuẩn: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg.
- 🎯 **Bí kíp săn sale:** Chọn tính năng Gộp Đơn (Group Buy) cho món đồ dưới 0.5kg để được **giảm ngay 25% tiền ship** nha!
- 🛡️ Bảo hiểm 100% nguyên vẹn hàng hóa từ kho Tokyo đến tận cửa nhà mình! 🍌`;
  }

  // 5. Tư vấn chọn size quần áo & giày dép Nhật Bản
  if (q.includes("size") || q.includes("quần áo") || q.includes("giày") || q.includes("uniqlo") || q.includes("gu")) {
    return isOmo
      ? `Kính thưa Quý khách về cách chọn size hàng thời trang Nhật Bản (Uniqlo, GU, Muji, Asics):
- **Quần áo:** Form chuẩn Nhật Bản thường ôm vừa vặn hơn so với size Âu-Mỹ (US/EU) khoảng 0.5 đến 1 size. Nếu Quý khách mặc size M quốc tế, khi chọn hàng Nhật nên chọn size L để thoải mái.
- **Giày dép:** Người Nhật đo kích cỡ giày theo độ dài bàn chân bằng Centimet (cm), ví dụ: 25.5cm, 26cm, 27cm. Quý khách chỉ cần đo khoảng cách từ gót đến ngón dài nhất để chọn chuẩn xác ạ! 👔👟`
      : `Mẹo chọn size cực chuẩn khi order quần áo & giày Nhật nè anh/chị ơi:
- 👕 Quần áo Uniqlo/GU nội địa Nhật theo form người châu Á, nhỏ hơn size US/EU tầm 1 size. Thích mặc rộng rãi thì anh/chị tăng lên 1 size nhé.
- 👟 Giày dép Nhật tính theo cm (chiều dài chân). Anh/chị cứ lấy thước đo bàn chân từ gót đến đầu ngón chân dài nhất là ra chuẩn size luôn! 👞✨`;
  }

  // Mặc định: Lời chào hỗ trợ tìm kiếm sản phẩm và tính bill
  return isOmo
    ? `Kính chào Quý khách! Em là ChillBanana AI Agent - Trợ lý thông minh vận hành bởi Gemini 2.5 🍌.
Em sẵn sàng hỗ trợ Quý khách:
- 🔍 Tìm kiếm sản phẩm chính hãng (Mỹ phẩm, Tảo xoắn, Gundam, Gia dụng Nhật).
- 🔗 Cung cấp link, hình ảnh và tư vấn săn sale từ Amazon JP, Rakuten, Mercari.
- 💰 Tính toán cước bay và bóc tách bill trọn gói về Việt Nam.
Quý khách đang quan tâm đến mặt hàng nào, xin vui lòng nhắn cho em biết để em hỗ trợ chu đáo nhất ạ! 🌸`
    : `Chào anh/chị! Em là ChillBanana AI Agent chạy trên nền tảng Gemini 2.5 đây ạ 🍌.
Anh/chị đang muốn săn món đồ gì từ Nhật Bản nè?
- 🔎 Tìm kiếm sản phẩm, gửi link ảnh & gợi ý shop uy tín tại Nhật.
- ⚡ Tư vấn kỹ thuật (điện 100V, chọn size đồ, bảo quản).
- ✈️ Mách mẹo săn sale, tính bill trọn gói và giảm 25% ship gộp đơn!
Cứ gửi tên món đồ hoặc link sản phẩm để em hỗ trợ liền nhé! ✨`;
}
