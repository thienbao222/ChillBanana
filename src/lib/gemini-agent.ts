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

QUY TẮC PHẢN HỒI BẮT BUỘC - TRẢ LỜI ĐẦY ĐỦ 100%:
1. TUYỆT ĐỐI KHÔNG CHỈ HỨA HẸN HAY TRẢ LỜI LƯNG CHỪNG: Khi khách hàng yêu cầu xem sản phẩm, hỏi link, hình ảnh hoặc tư vấn tầm giá, BẠN PHẢI LIỆT KÊ NGAY LẬP TỨC 2-4 SẢN PHẨM CỤ THỂ TRONG PHẢN HỒI ĐÓ. Tuyệt đối không được nói: "Em xin phép gửi một vài gợi ý..." rồi dừng lại mà KHÔNG đưa ra sản phẩm!
2. MỖI SẢN PHẨM BẮT BUỘC CUNG CẤP ĐỦ 5 MỤC:
   - 🏷️ **Tên sản phẩm đầy đủ**: (Ví dụ: Máy Nintendo Switch Lite Nhật, PlayStation 4 Slim, Nồi cơm Zojirushi IH, Gunpla RG 1/144,...)
   - 💰 **Giá bán & Chi phí**: Giá Yên (JPY) và giá quy đổi VNĐ theo tỷ giá 1 JPY ≈ ${DEFAULT_EXCHANGE_RATE} đ + cước bay dự tính (${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg).
   - 🔗 **Đường link mua hàng**: Đưa ra link tìm kiếm / mua trực tiếp từ sàn Nhật (Ví dụ: [Link Amazon Japan](https://www.amazon.co.jp/s?k=...), [Link Mercari JP](https://jp.mercari.com/search?keyword=...), [Link Surugaya](https://www.suruga-ya.jp/search?search_word=...)).
   - 🖼️ **Hình ảnh minh họa trực quan**: Sử dụng link ảnh Unsplash hoặc CDN chuẩn e-commerce, hiển thị cả cú pháp Markdown: \`![Tên](URL_Ảnh)\`
   - 📝 **Đặc điểm & Lưu ý kỹ thuật**: Nguồn điện (100V hay pin sạc Type-C), tình trạng máy, mẹo chọn hàng nguyên bản đẹp.
3. HƯỚNG DẪN ĐẶT HÀNG TRÊN WEB: Nhắc khách copy link bất kỳ từ Amazon JP / Mercari dán vào công cụ "Dán Link Tính Giá" ở đầu trang web để nhận bảng tính cước tự động trong 3 giây.
4. TỶ GIÁ & CHÍNH SÁCH VẬN CHUYỂN CHUẨN:
   - Tỷ giá JPY -> VND: 1 JPY ≈ ${DEFAULT_EXCHANGE_RATE} VND.
   - Cước bay hỏa tốc Narita ⇄ Việt Nam: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg (3-5 ngày về kho).
   - Đặt cọc 50% là mua ngay, bảo hiểm đền bù 100% khi mất mát, gãy vỡ.
   - Gộp đơn (Group Buy) tiết kiệm 25% cước bay cho kiện hàng < 0.5kg.
5. NGUYÊN TẮC AN TOÀN & TỪ CHỐI LỊCH SỰ:
   - Lịch sự từ chối các câu hỏi về: chính trị, tôn giáo cực đoan, nội dung người lớn 18+, đồi trụy, vũ khí, ma túy/chất cấm.
   - Lời từ chối nhã nhặn: "Dạ, em xin phép lịch sự từ chối phản hồi về chủ đề này do tính chất nhạy cảm ạ. Em luôn sẵn sàng hỗ trợ Quý khách về sản phẩm nội địa Nhật, tra cứu link, hình ảnh và kinh nghiệm săn sale. Kính mong Quý khách thông cảm ạ! 🌸🍌"

DANH MỤC SẢN PHẨM MẪU SẴN CÓ:
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
              maxOutputTokens: 8192,
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const candidate = data?.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const text = candidate?.content?.parts?.[0]?.text;
        
        console.log(`[Gemini 2.5] FinishReason: ${finishReason}, token count: ${data?.usageMetadata?.candidatesTokenCount}`);
        
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

  // 1.5. Tư vấn Máy chơi game nội địa Nhật (Nintendo Switch, PS4, PS Vita, 3DS) trong tầm giá 2-4 triệu
  if (
    q.includes("game") ||
    q.includes("chơi game") ||
    q.includes("nintendo") ||
    q.includes("switch") ||
    q.includes("playstation") ||
    q.includes("ps4") ||
    q.includes("3 triệu") ||
    q.includes("3tr")
  ) {
    return isOmo
      ? `Kính chào Quý khách! Trong tầm giá khoảng 3 triệu đồng (~18.000 ¥), em xin phép gửi đến Quý khách các dòng máy chơi game nội địa Nhật Bản siêu hot, bền đẹp và rất được ưa chuộng:

🎮 **1. Nintendo Switch Lite (Nội Địa Nhật Bản)**
- **Giá tham khảo:** ~15.000 ¥ - 17.500 ¥ (~2.600.000 đ - 3.000.000 đ)
- **Tình trạng:** Máy used likenew 95-98% đầy đủ phụ kiện sạc Type-C (cắm sạc trực tiếp tại VN).
- 🔗 **Link tham khảo:** [Xem máy trên Mercari JP](https://jp.mercari.com/search?keyword=nintendo%20switch%20lite) | [Xem trên Amazon JP](https://www.amazon.co.jp/s?k=nintendo+switch+lite)
- ![Nintendo Switch Lite](https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=500&q=80)

🎮 **2. Sony PlayStation 4 Slim (PS4 500GB / CUH-2000 Series)**
- **Giá tham khảo:** ~16.000 ¥ - 18.500 ¥ (~2.800.000 đ - 3.200.000 đ)
- **Tình trạng:** Máy nội địa Nhật nguyên tem void, kèm tay cầm DualShock 4 không dây.
- 🔗 **Link tham khảo:** [Xem máy trên Mercari JP](https://jp.mercari.com/search?keyword=ps4%20slim) | [Xem trên Surugaya JP](https://www.suruga-ya.jp/search?search_word=ps4)
- ![PlayStation 4](https://images.unsplash.com/photo-1507457379470-08b800bebc67?auto=format&fit=crop&w=500&q=80)

🎮 **3. New Nintendo 3DS LL / PS Vita 2000 (Dành cho sưu tầm)**
- **Giá tham khảo:** ~12.000 ¥ - 15.000 ¥ (~2.100.000 đ - 2.600.000 đ)
- **Tình trạng:** Bản tiếng Nhật có thể chơi game mượt mà, màn hình sáng đẹp.
- 🔗 **Link tham khảo:** [Xem trên Surugaya JP](https://www.suruga-ya.jp/search?search_word=new%203ds%20ll)

👉 **Cách đặt hàng:** Quý khách chọn chiếc máy ưng ý trên Mercari hoặc Amazon Nhật, copy link dán vào công cụ **"Dán Link Tính Giá"** ở trên trang web để ChillBanana hỗ trợ bóc tách giá Yên và mua hộ an toàn về Việt Nam ạ! 🍌`
      : `Dạ em gửi anh/chị danh sách máy chơi game nội địa Nhật cực ngon trong tầm giá 3 triệu nè! 🎉

🎮 **1. Nintendo Switch Lite (Bản Nhật nguyên zin)**
- 🏷️ **Giá:** 15.000 ¥ - 17.500 ¥ (~2.600.000 đ - 3.000.000 đ)
- ⚡ Sạc chuẩn Type-C cắm thẳng ổ điện VN vô tư không cần biến áp!
- 🔗 [Bấm vào đây để xem máy trên Mercari JP](https://jp.mercari.com/search?keyword=nintendo%20switch%20lite)
- ![Nintendo Switch Lite](https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=500&q=80)

🎮 **2. Sony PlayStation 4 Slim (PS4 500GB)**
- 🏷️ **Giá:** ~16.500 ¥ - 18.000 ¥ (~2.850.000 đ - 3.100.000 đ)
- 🎮 Kèm tay cầm zin, chơi các tựa game đình đám FIFA, GTA V, God of War cực đã!
- 🔗 [Bấm vào đây để xem máy trên Mercari JP](https://jp.mercari.com/search?keyword=ps4%20slim)
- ![Sony PS4](https://images.unsplash.com/photo-1507457379470-08b800bebc67?auto=format&fit=crop&w=500&q=80)

👉 Anh/chị ưng mẫu nào cứ copy link trên sàn dán vào ô **"Dán Link Tính Giá"** ở trên web là có ngay bảng tính cước trọn gói về tận tay chỉ sau 3-5 ngày nhé! 🍌`;
  }

  // 2. Tư vấn Gundam / Figure / Anime
  if (q.includes("gundam") || q.includes("gunpla") || q.includes("figure") || q.includes("anime") || q.includes("mô hình") || q.includes("bandai")) {
    return isOmo
      ? `Kính chào Quý khách! Về thế giới mô hình Gundam Bandai và Figure chính hãng tại Nhật Bản, Em xin phép gửi đến Quý khách các mẫu Gunpla kinh điển rất được ưa chuộng kèm thông tin chi tiết:

🤖 **1. Mô Hình Gunpla RG 1/144 Strike Freedom Gundam**
- **Giá tham khảo:** ~3.000 ¥ - 3.800 ¥ (~516.000 đ - 653.000 đ)
- **Tình trạng:** Khung xương Advanced MS Joint sắc nét, cánh Super Dragoon tháo rời cực đẹp.
- 🔗 **Link tham khảo:** [Xem trên Surugaya JP](https://www.suruga-ya.jp/search?search_word=rg+strike+freedom) | [Xem trên Mercari JP](https://jp.mercari.com/search?keyword=rg%20strike%20freedom)
- ![RG 1/144 Strike Freedom](https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?auto=format&fit=crop&w=500&q=80)

🤖 **2. Mô Hình Gunpla MG 1/100 RX-93 Nu Gundam Ver.Ka**
- **Giá tham khảo:** ~7.500 ¥ - 8.500 ¥ (~1.290.000 đ - 1.462.000 đ)
- **Tình trạng:** Bản Master Grade cao cấp do Hajime Katoki thiết kế, chi tiết giáp mở đỉnh cao.
- 🔗 **Link tham khảo:** [Xem trên Amazon JP](https://www.amazon.co.jp/s?k=mg+nu+gundam+ver+ka) | [Xem trên Mercari JP](https://jp.mercari.com/search?keyword=mg%20nu%20gundam%20ver%20ka)
- ![MG 1/100 Nu Gundam](https://images.unsplash.com/photo-1618217737233-1a2f6c0e8f8d?auto=format&fit=crop&w=500&q=80)

🤖 **3. Mô Hình Gunpla HG 1/144 RX-78-2 Gundam (Revive)**
- **Giá tham khảo:** ~1.000 ¥ - 1.300 ¥ (~172.000 đ - 223.000 đ)
- **Tình trạng:** Bản High Grade nhập môn kinh điển, nhựa màu hoàn hảo không cần dùng keo dán.
- 🔗 **Link tham khảo:** [Xem trên Amazon JP](https://www.amazon.co.jp/s?k=hg+rx-78-2+revive)
- ![HG 1/144 RX-78-2](https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=500&q=80)

🛡️ **Cam kết vận chuyển:** Hàng mô hình luôn được ChillBanana đóng gói bọc xốp bóng khí 4 lớp bảo vệ hộp zin góc cạnh, cước bay Narita ⇄ VN chỉ ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg.
👉 Quý khách copy link sản phẩm ưng ý dán vào công cụ **"Dán Link Tính Giá"** ở đầu trang web để nhận bảng tính chi phí trọn gói ngay ạ! 🍌`
      : `Chào bạn fan cứng Gundam & Figure nè! 🤖 ChillBanana chuyên săn các dòng Gunpla Bandai (RG, MG, HG, PG) và Figure chính hãng nội địa Nhật giá siêu mềm:

🤖 **1. Mô Hình Gunpla RG 1/144 Strike Freedom Gundam**
- 🏷️ **Giá:** ~3.000 ¥ - 3.800 ¥ (~516.000 đ - 653.000 đ)
- 🔗 [Xem mẫu trên Mercari JP](https://jp.mercari.com/search?keyword=rg%20strike%20freedom)
- ![RG Strike Freedom](https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?auto=format&fit=crop&w=500&q=80)

🤖 **2. Mô Hình Gunpla MG 1/100 RX-93 Nu Gundam Ver.Ka**
- 🏷️ **Giá:** ~7.500 ¥ - 8.500 ¥ (~1.290.000 đ - 1.462.000 đ)
- 🔗 [Xem mẫu trên Amazon JP](https://www.amazon.co.jp/s?k=mg+nu+gundam+ver+ka)
- ![MG Nu Gundam](https://images.unsplash.com/photo-1618217737233-1a2f6c0e8f8d?auto=format&fit=crop&w=500&q=80)

🤖 **3. Mô Hình Gunpla HG 1/144 RX-78-2 Gundam Revive**
- 🏷️ **Giá:** ~1.100 ¥ (~189.000 đ)
- 🔗 [Xem mẫu trên Surugaya JP](https://www.suruga-ya.jp/search?search_word=hg+rx-78-2)
- ![HG RX-78-2](https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=500&q=80)

🛡️ ChillBanana đóng gói bọc bóng khí 4 lớp cam kết giữ nguyên seal hộp không móp méo, cước bay chỉ ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg.
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
