import { AIPersonality } from "@/types";
import { DEFAULT_EXCHANGE_RATE, AIR_SHIPPING_PER_KG, MIN_ORDER_THRESHOLD_VND } from "./data";

export const CHILLBANANA_SYSTEM_INSTRUCTION = `
Bạn là "ChillBanana AI Agent" - Trợ lý AI thông minh chuyên gia tư vấn mua sắm, săn deal và ủy thác order hàng nội địa Nhật Bản trực tuyến của thương hiệu ChillBanana (chillbanana.vn).

BỐI CẢNH DỊCH VỤ & THÔNG TIN CHÍNH THỨC CỦA CHILLBANANA:
- Tỷ giá quy đổi hôm nay: 1 JPY = ${DEFAULT_EXCHANGE_RATE} VND (Tự động cập nhật theo thời gian thực).
- Cước vận chuyển hỏa tốc Nhật ⇄ Việt Nam: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg (Thời gian giao hàng từ kho Tokyo về tận tay chỉ 3-5 ngày).
- Hạn mức đơn hàng tối thiểu: ${MIN_ORDER_THRESHOLD_VND.toLocaleString()} đ.
- Tính năng Gộp Đơn (Group Buy): Giảm 25% cước vận chuyển cho các kiện hàng nhẹ dưới 0.5kg (thích hợp mua son, mỹ phẩm nhỏ, phụ kiện mini).
- Các sàn thương mại điện tử Nhật Bản được hỗ trợ: Amazon Japan (amazon.co.jp), Mercari JP, Rakuten, Yahoo Auctions, Surugaya, AmiAmi, Bandai Hobby, Uniqlo JP, Bic Camera, Yodobashi Camera.
- Thanh toán: Quét mã VietQR chuẩn Napas 247 cọc 50% hoặc 100%, bảo hiểm đền bù 100% nếu thất lạc/hư hỏng.

VAI TRÒ & NĂNG LỰC CỦA GEMINI AGENT:
1. Tư vấn chuyên sâu về các dòng sản phẩm nội địa Nhật:
   - Mô hình Anime & Gundam (Bandai Gunpla RG, MG, HG, PG, MegaHouse, Figure AmiAmi/Surugaya).
   - Mỹ phẩm & Skin care chuẩn Cosme Nhật (DHC, Hada Labo, Anessa, Shiseido, SK-II).
   - Thực phẩm chức năng & Dược mỹ phẩm (Tảo xoắn Spirulina, Ginkgo Biloba, Nattokinase Orihiro).
   - Đồ điện tử & Gia dụng mini (Nồi cơm Zojirushi, máy cạo râu Panasonic, tai nghe Sony, bình giữ nhiệt Tiger).
2. Giải thích kỹ thuật & Cảnh báo an toàn:
   - Điện áp nội địa Nhật là 100V: Nếu khách hỏi mua nồi cơm, máy sấy tóc, bếp từ nội địa Nhật, hãy luôn nhắc nhở khách cần dùng bộ biến áp đổi nguồn Lioa 100V (công suất 1500W-2000W) tại Việt Nam để tránh cháy nổ.
   - Bảng quy đổi size: Quần áo Uniqlo Nhật phom ôm hơn VN; giày dép đo bằng Centimet (cm) trên bàn chân thực tế.
3. Hướng dẫn khách hàng dán link vào công cụ tính giá trọn gói ở trang chủ của ChillBanana để hệ thống tự động bóc tách giá Yên và tạo mã VietQR đặt cọc.
4. Phạm vi tư vấn (Guardrail): Giữ phong thái chuyên nghiệp, tập trung 100% vào mua sắm hàng Nhật, cước phí, tỷ giá và quy trình order. Nếu khách hỏi các câu hỏi lập trình, chính trị, làm văn ngoài lề, từ chối lịch sự và khéo léo chuyển hướng về dịch vụ mua hộ ChillBanana.
`;

export const CHILLBANANA_OMOTENASHI_STYLE = `
Phong cách: OMOTENASHI (おもてなし - Chuẩn mực văn hóa phục vụ hiếu khách của Nhật Bản).
- Lời văn: Kính cẩn, chu đáo, lễ phép, tôn trọng khách hàng tuyệt đối (xưng "em", gọi "Quý khách").
- Kết thúc tin nhắn với sự tận tâm và biểu tượng ấm áp 🍌🌸.
`;

export const CHILLBANANA_FRIENDLY_STYLE = `
Phong cách: Chill & Thân Thiện (Gần gũi, năng động).
- Lời văn: Tươi vui, nhiệt tình, xưng "em", gọi "anh/chị/bạn", mách nước mẹo săn deal hời trên Mercari và Amazon JP.
- Kết thúc tin nhắn với năng lượng tích cực 🍌🎉.
`;

// Phân tích trích xuất Topic và Từ khóa tự động từ câu hỏi khách hàng để lưu CSDL phục vụ thống kê xu hướng
export function extractCustomerTrendMetadata(userText: string): {
  topic: string;
  keywords: string[];
  sentiment: string;
} {
  const text = userText.toLowerCase();
  const keywords: string[] = [];
  let topic = "Khác";

  // Phân loại danh mục chính
  if (text.includes("gundam") || text.includes("gunpla") || text.includes("figure") || text.includes("anime") || text.includes("mô hình") || text.includes("bandai") || text.includes("one piece")) {
    topic = "Anime & Mô Hình Figure";
    if (text.includes("gundam") || text.includes("gunpla")) keywords.push("Gundam/Gunpla");
    if (text.includes("figure")) keywords.push("Figure Anime");
    if (text.includes("bandai")) keywords.push("Bandai");
    if (text.includes("one piece")) keywords.push("One Piece");
  } else if (text.includes("mỹ phẩm") || text.includes("son") || text.includes("kem chống nắng") || text.includes("dhc") || text.includes("anessa") || text.includes("hada labo") || text.includes("cosme")) {
    topic = "Mỹ Phẩm & Chăm Sóc Da";
    if (text.includes("kem chống nắng")) keywords.push("Kem chống nắng");
    if (text.includes("anessa")) keywords.push("Anessa");
    if (text.includes("dhc")) keywords.push("DHC");
    if (text.includes("hada labo")) keywords.push("Hada Labo");
  } else if (text.includes("tảo") || text.includes("thực phẩm chức năng") || text.includes("vitamin") || text.includes("orihiro") || text.includes("ginkgo") || text.includes("collagen")) {
    topic = "Thực Phẩm Chức Năng";
    if (text.includes("tảo")) keywords.push("Tảo xoắn");
    if (text.includes("orihiro")) keywords.push("Orihiro");
    if (text.includes("collagen")) keywords.push("Collagen");
  } else if (text.includes("nồi cơm") || text.includes("điện tử") || text.includes("100v") || text.includes("máy cạo râu") || text.includes("tai nghe") || text.includes("bàn phím") || text.includes("chuột") || text.includes("zojirushi")) {
    topic = "Gia Dụng & Đồ Điện 100V";
    if (text.includes("nồi cơm")) keywords.push("Nồi cơm điện");
    if (text.includes("100v") || text.includes("biến áp")) keywords.push("Biến áp 100V");
    if (text.includes("tai nghe") || text.includes("chuột")) keywords.push("Gaming Gear");
  } else if (text.includes("size") || text.includes("quần áo") || text.includes("giày") || text.includes("uniqlo") || text.includes("gu")) {
    topic = "Thời Trang & Quy Đổi Size";
    if (text.includes("uniqlo")) keywords.push("Uniqlo");
    if (text.includes("giày")) keywords.push("Size giày Nhật");
  } else if (text.includes("tỷ giá") || text.includes("yên") || text.includes("cước") || text.includes("phí") || text.includes("gộp đơn") || text.includes("vận chuyển")) {
    topic = "Tỷ Giá & Cước Vận Chuyển";
    if (text.includes("tỷ giá")) keywords.push("Tỷ giá JPY");
    if (text.includes("gộp đơn")) keywords.push("Gộp đơn");
    if (text.includes("cước")) keywords.push("Cước bay");
  }

  // Phân tích sentiment cơ bản
  let sentiment = "inquiry";
  if (text.includes("tuyệt") || text.includes("cảm ơn") || text.includes("thích") || text.includes("oke") || text.includes("ok")) {
    sentiment = "positive";
  } else if (text.includes("lỗi") || text.includes("chậm") || text.includes("khiếu nại") || text.includes("đắt")) {
    sentiment = "complaint";
  }

  return { topic, keywords, sentiment };
}
