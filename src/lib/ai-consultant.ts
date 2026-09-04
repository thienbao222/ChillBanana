import { AIPersonality } from "@/types";
import { CURATED_PRODUCTS, DEFAULT_EXCHANGE_RATE, AIR_SHIPPING_PER_KG, MIN_ORDER_THRESHOLD_VND } from "./data";

export const CHILLBANANA_OMOTENASHI_PROMPT = `
Bạn là "ChillBanana AI" - Trợ lý tư vấn mua sắm và ủy thác order hàng nội địa Nhật Bản trực tuyến của thương hiệu ChillBanana (chillbanana.vn), phục vụ theo chuẩn mực văn hóa OMOTENASHI (おもてなし) của Nhật Bản: Kính cẩn, chu đáo, lễ phép, tận tâm và trả lời trực tiếp đúng trọng tâm câu hỏi của khách hàng.

THÔNG TIN THƯƠNG HIỆU & BIỂU PHÍ:
- Tỷ giá quy đổi hôm nay: 1 JPY = ${DEFAULT_EXCHANGE_RATE} VND.
- Cước bay hỏa tốc Narita/Haneda ✈ Nội Bài & Tân Sơn Nhất: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg (Bay 3-5 ngày).
- Hạn mức đơn tối thiểu: ${MIN_ORDER_THRESHOLD_VND.toLocaleString()} đ.
- Tính năng Gộp Đơn (Group Buy): Giảm 25% cước bay cho kiện hàng dưới 0.5kg.
- Hỗ trợ order từ: Amazon Japan, Mercari JP, Rakuten, Yahoo Auctions, Surugaya, AmiAmi, Bandai Hobby, Uniqlo JP, Bic Camera.

CÁCH TRẢ LỜI:
- Khi khách hỏi mua một mặt hàng cụ thể (VD: "mua gundam", "mua mỹ phẩm", "mua chuột gaming", "tìm nồi cơm điện"): Hãy nhiệt tình tư vấn các dòng phổ biến tại Nhật (VD: Gundam có các dòng RG, MG, HG từ Bandai Hobby trên Surugaya/Amazon JP), ước tính chi phí, và hướng dẫn khách dán link sản phẩm vào công cụ tính giá của web để hệ thống tự động bóc tách giá Yên và tạo mã VietQR cọc tiền!
- Khi khách hỏi kỹ thuật: Giải thích rõ ràng (Điện 100V cần dùng biến áp Lioa, bảng size giày tính bằng cm).

GIỚI HẠN PHẠM VI (GUARDRAIL):
- Bạn CHỈ tư vấn mua sắm hàng Nhật, cước phí, tỷ giá, dịch vụ order ChillBanana và quy định vận tải.
- Tuyệt đối từ chối lịch sự mọi câu hỏi không liên quan (lập trình, làm thơ, chính trị, toán học).
`;

export const CHILLBANANA_FRIENDLY_PROMPT = `
Bạn là "ChillBanana AI" - Trợ lý mua sắm hàng Nhật siêu nhiệt tình, vui tính và thân thiện của ChillBanana! Phong cách gần gũi, xưng "em", gọi "anh/chị/bạn", trả lời trúng đích và mách mẹo săn deal hời.

THÔNG TIN & CƯỚC PHÍ:
- Tỷ giá hôm nay: 1 JPY = ${DEFAULT_EXCHANGE_RATE} đ.
- Cước bay hỏa tốc: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg (3-5 ngày về VN).
- Gộp đơn: Bật gộp đơn giảm 25% tiền cước bay cho hàng nhẹ dưới 0.5kg.

CÁCH TRẢ LỜI:
- Khách hỏi mua gì (Gundam, Anime, Mỹ phẩm, Đồ điện tử, Phụ kiện), trả lời ngay lập tức gợi ý các sàn săn deal tốt nhất (Amazon JP, Mercari, Surugaya), nhắc khách dán link vào ô tính giá ở trang chủ để tự động cào giá Yên và làm mã VietQR đặt cọc nhanh gọn!
`;

// Kiểm tra câu hỏi ngoài luồng
export function isQueryOutOfDomain(query: string): boolean {
  const lower = query.toLowerCase().trim();
  const offTopicTriggers = [
    "viết code", "lập trình", "python", "javascript", "c++", "html css", "function", "react", "nextjs",
    "làm thơ", "sáng tác thơ", "bài thơ", "tập làm văn", "viết văn", "soạn văn",
    "chính trị", "bầu cử", "tổng thống", "chiến tranh", "đảng phái",
    "giải toán", "phương trình", "tích phân", "đạo hàm", "bài tập lý", "hóa học",
    "kể chuyện ma", "kể chuyện cười", "tán gẫu", "bạn là chatgpt à", "ai tạo ra bạn"
  ];

  return offTopicTriggers.some((trigger) => lower.includes(trigger));
}

// Fallback thông minh xử lý theo đúng trọng tâm câu hỏi của khách hàng
export function getChillBananaSmartFallback(
  userQuery: string,
  personality: AIPersonality
): string {
  const q = userQuery.toLowerCase().trim();
  const isOmo = personality === "omotenashi";

  // 1. Chặn câu hỏi ngoài luồng
  if (isQueryOutOfDomain(userQuery)) {
    if (isOmo) {
      return `Kính thưa Quý khách, em là trợ lý chuyên trách tư vấn mua sắm hàng Nhật Bản của ChillBanana. Em xin phép chỉ hỗ trợ các thông tin liên quan đến sản phẩm, tỷ giá, cách chọn size, chi phí và giao vận Nhật - Việt ạ. Kính mong Quý khách thông cảm và cho em biết Quý khách đang quan tâm đến món hàng nào để em phục vụ chu đáo ạ! 🍌`;
    } else {
      return `Dạ em là trợ lý mua hàng Nhật của ChillBanana nè! Em chỉ chuyên về mua sắm đồ Nhật, săn deal, tính cước và ship hàng thôi ạ. Các câu hỏi ngoài lề này em xin phép không hỗ trợ nha. Anh/chị đang muốn tìm món đồ Nhật nào để em hỗ trợ ngay nhé! 🍌`;
    }
  }

  // 2. Hỏi về Gundam / Mô hình / Anime Figure / Gunpla
  if (
    q.includes("gundam") ||
    q.includes("gunpla") ||
    q.includes("figure") ||
    q.includes("anime") ||
    q.includes("mô hình") ||
    q.includes("bandai") ||
    q.includes("luffy") ||
    q.includes("one piece")
  ) {
    if (isOmo) {
      return `Dạ thưa Quý khách, ChillBanana hỗ trợ order tất cả các dòng Gundam/Gunpla Bandai chính hãng (RG, MG, HG, PG) và Anime Figure trực tiếp từ Amazon JP, Surugaya, AmiAmi và Bandai Hobby!
- Giá gốc tại Nhật cực tốt (từ 1.500¥ - 15.000¥ tùy mẫu).
- Tỷ giá hôm nay: 1 JPY = ${DEFAULT_EXCHANGE_RATE} VND.
- Đóng gói bọc xốp bóng khí 4 lớp bảo vệ hộp nguyên seal, không móp méo khi bay về VN.
Quý khách có thể copy link mẫu Gundam muốn mua trên Amazon JP hoặc Surugaya dán vào ô "Dán Link Tính Giá" ở trang chủ để hệ thống tự động bóc tách giá Yên và tính bill trọn gói ngay ạ! 🎎`;
    } else {
      return `Chào bạn fan cứng Gundam & Anime nha! 🤖 ChillBanana chuyên săn deal Gunpla Bandai (RG, MG, HG, PG) và Figure chính hãng giá siêu mềm từ Amazon JP, Surugaya và AmiAmi nè!
🔥 Đóng gói chống sốc chuẩn chỉ, giữ nguyên seal hộp đẹp không tì vết.
👉 Bạn chỉ cần tìm mẫu Gundam ưng ý trên Amazon.co.jp hoặc Surugaya rồi dán link vào ô "Dán Link Tính Giá" ở đầu trang web, ChillBanana sẽ tự động lấy giá gốc và tính trọn gói cước bay về tận tay bạn liền nhé! 🍌`;
    }
  }

  // 3. Hỏi về Đồ điện tử, Chuột Gaming, Bàn phím, Tai nghe, Đồ công nghệ
  if (
    q.includes("chuột") ||
    q.includes("mouse") ||
    q.includes("bàn phím") ||
    q.includes("keyboard") ||
    q.includes("gaming") ||
    q.includes("tai nghe") ||
    q.includes("sony") ||
    q.includes("nồi cơm") ||
    q.includes("máy cạo râu") ||
    q.includes("điện tử") ||
    q.includes("100v") ||
    q.includes("điện áp")
  ) {
    if (isOmo) {
      return `Kính thưa Quý khách về các sản phẩm điện tử & gia dụng Nhật:
- Chuột gaming, bàn phím, tai nghe (kết nối Type-C/USB) có thể cắm sử dụng trực tiếp tại Việt Nam mà không cần biến áp.
- Riêng đồ gia dụng nội địa Nhật (nồi cơm Zojirushi, máy sấy, máy lọc khí dùng điện 100V), Quý khách cần cắm qua bộ biến áp đổi nguồn Lioa 100V để đảm bảo an toàn.
Quý khách chỉ cần dán link sản phẩm vào công cụ tính giá ở trang chủ, ChillBanana sẽ tự động nhận diện và tính cước vận chuyển chi tiết ạ! ⚡`;
    } else {
      return `Lưu ý cho anh/chị khi mua đồ công nghệ Nhật nè:
🖱 Chuột gaming, bàn phím, tai nghe chân USB/Type-C thì cắm dùng trực tiếp ở VN vô tư nhé!
🔌 Với đồ điện gia dụng nội địa chạy điện 100V (nồi cơm, máy cạo râu), nhớ mua kèm cục biến áp đổi nguồn tầm 100k-200k cắm cho an toàn nha.
Anh/chị dán link sản phẩm vào ô tính giá ở trên để em lấy giá Yên và tính bill trọn gói ngay cho mình nhé! 🍌`;
    }
  }

  // 4. Hỏi về Size quần áo / Giày dép (sử dụng regex từ chuẩn để tránh nhầm)
  if (
    q.includes("size") ||
    q.includes("kích thước") ||
    q.includes("quần áo") ||
    q.includes("giày") ||
    /\bgu\b/i.test(q) ||
    /\buniqlo\b/i.test(q)
  ) {
    if (isOmo) {
      return `Dạ thưa Quý khách về bảng size Nhật Bản:
- Quần áo Uniqlo/GU nội địa: Dưới 58kg mặc Size S/M; 60-70kg mặc Size M/L; trên 72kg mặc Size XL.
- Giày dép: Nhật đo theo chiều dài bàn chân (cm). Ví dụ: chân 26cm chọn chuẩn Size 26.0 (tương đương 41 VN).
Quý khách cho em xin chiều cao, cân nặng để em tư vấn size chuẩn xác nhất ạ! 👔`;
    } else {
      return `Mẹo chọn size đồ Nhật chuẩn đét nè:
👕 Quần áo Uniqlo: Dưới 58kg chọn S hoặc M; 60-70kg chọn M hoặc L là đẹp chuẩn!
👟 Giày dép: Giày Nhật tính bằng cm (chiều dài chân thực tế). Cứ đo chân bao nhiêu cm chọn đúng số đó là vừa khít luôn! ✨`;
    }
  }

  // 5. Tra cứu mã đơn hàng
  if (q.includes("cb-") || q.includes("đơn hàng") || q.includes("tra cứu") || q.includes("mã đơn")) {
    return `Dạ thưa Quý khách, để tra cứu hành trình 7 bước của đơn hàng, Quý khách vui lòng nhập mã đơn hàng (ví dụ: CB-2026-8921) tại trang /tracking ạ. Hệ thống cập nhật vị trí kiện hàng liên tục từ Tokyo về Việt Nam! 📦`;
  }

  // Phản hồi tổng quát linh hoạt
  if (isOmo) {
    return `Kính chào Quý khách! Em là ChillBanana AI. Quý khách đang quan tâm đến sản phẩm nào tại Nhật Bản (Gundam, Anime Figure, Mỹ phẩm, Thực phẩm chức năng hay Đồ điện tử)? Quý khách có thể dán link trực tiếp từ Amazon JP, Mercari, Rakuten vào ô tính giá để em báo giá trọn gói và hỗ trợ đặt mua ngay ạ! 🍌`;
  } else {
    return `Chào anh/chị! Em là ChillBanana AI đây ạ. Anh/chị đang muốn săn món đồ gì từ Nhật Bản nè (Mô hình Gundam, Figure, Mỹ phẩm hay Đồ công nghệ)? Cứ gửi link hoặc tên món đồ để em tư vấn và tính giá cước ưu đãi nhất nha! 🍌`;
  }
}
