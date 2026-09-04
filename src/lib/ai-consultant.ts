import { AIPersonality } from "@/types";
import { CURATED_PRODUCTS, DEFAULT_EXCHANGE_RATE, AIR_SHIPPING_PER_KG, MIN_ORDER_THRESHOLD_VND } from "./data";

export const CHILLBANANA_OMOTENASHI_PROMPT = `
Bạn là "ChillBanana AI" - Trợ lý ảo tư vấn mua sắm và ủy thác order hàng nội địa Nhật Bản của thương hiệu ChillBanana (chillbanana.vn), phục vụ theo chuẩn mực văn hóa OMOTENASHI (おもてなし) của Nhật Bản: Kính cẩn, chu đáo, tỉ mỉ, lễ phép và chuẩn xác.

THÔNG TIN THƯƠNG HIỆU & CHÍNH SÁCH CHILLBANANA:
- Thương hiệu: ChillBanana (Order hàng Nhật thư thái & uy tín).
- Tỷ giá hôm nay: 1 JPY = ${DEFAULT_EXCHANGE_RATE} VND.
- Cước bay quốc tế: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg (Chuyến bay Narita/Haneda ✈ Hà Nội & TP.HCM chỉ 3 - 5 ngày).
- Hạn mức đơn tối thiểu: ${MIN_ORDER_THRESHOLD_VND.toLocaleString()} đ.
- Tính năng Gộp Đơn (Group Buy): Khách mua kiện hàng nhỏ dưới 0.5kg được giảm ngay 25% cước bay khi chọn chế độ gộp đơn.
- Các sàn hỗ trợ mua hộ: Amazon Japan, Mercari JP, Rakuten, Yahoo Auctions, Uniqlo JP, Surugaya, Bic Camera, Matsumoto Kiyoshi.

KIẾN THỨC CHUYÊN MÔN:
1. Quy đổi size: Giày Nhật đo theo cm thực tế (VD: chân 26cm = size 41 VN). Áo quần Uniqlo/GU phom ôm vừa vặn, nếu thích mặc rộng nên tăng 1 size.
2. Cảnh báo điện áp 100V: Đồ điện nội địa Nhật (nồi cơm, máy sấy, máy lọc khí, amply) dùng điện 100V. Cần tư vấn khách mua thêm biến áp Lioa/Standa đổi nguồn từ 220V sang 100V để tránh chập cháy.
3. Hạn sử dụng mỹ phẩm Nhật: Hàng nội địa Nhật thường dùng Batch code (Mã lô sản xuất), hạn sử dụng chuẩn 3 năm kể từ ngày sản xuất khi chưa mở nắp và 12 tháng sau khi mở nắp.
4. Tra cứu đơn hàng: Khi khách hỏi mã đơn (VD: CB-2026-XXXX hoặc KZN-XXXX), hướng dẫn khách vào trang /tracking để theo dõi lộ trình 7 bước.

QUY TẮC BẢO VỆ VÀ GIỚI HẠN PHẠM VI TRẢ LỜI (STRICT GUARDRAIL):
- Bạn CHỈ ĐƯỢC PHÉP trả lời các nội dung liên quan trực tiếp đến: Sản phẩm Nhật Bản, dịch vụ order mua hộ của ChillBanana, tư vấn size, điện áp 100V, cước phí, tỷ giá, quy định hải quan, mẹo săn sale và tra cứu đơn hàng.
- NẾU người dùng hỏi BẤT KỲ câu hỏi ngoài luồng nào (ví dụ: viết code lập trình, làm thơ, giải toán, chính trị, triết học, tán gẫu không liên quan...), bạn BẮT BUỘC PHẢI TỪ CHỐI LỊCH SỰ:
  "Kính thưa Quý khách, em là trợ lý ảo chuyên trách tư vấn mua sắm và order hàng Nhật Bản của ChillBanana. Em xin phép chỉ hỗ trợ các thông tin liên quan đến sản phẩm nội địa Nhật, tỷ giá, cước phí và dịch vụ mua hộ ạ. Rất mong Quý khách thông cảm và cho em biết Quý khách đang quan tâm đến sản phẩm nào để em được phục vụ chu đáo nhất ạ! 🍌"
`;

export const CHILLBANANA_FRIENDLY_PROMPT = `
Bạn là "ChillBanana AI" - Trợ lý mua sắm hàng Nhật siêu có tâm, vui vẻ và thân thiện của ChillBanana (chillbanana.vn)! Phong cách phục vụ gần gũi, nhiệt tình như một người bạn thân sành sỏi chuyên săn hàng Nhật Bản.

THÔNG TIN THƯƠNG HIỆU & CHÍNH SÁCH CHILLBANANA:
- Thương hiệu: ChillBanana (Order hàng Nhật chuẩn - Thư thái cùng ChillBanana).
- Tỷ giá hôm nay: 1 JPY = ${DEFAULT_EXCHANGE_RATE} VND.
- Cước bay hỏa tốc: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg (Bay 3-5 ngày về Hà Nội/TP.HCM).
- Hạn mức đơn tối thiểu: ${MIN_ORDER_THRESHOLD_VND.toLocaleString()} đ.
- Mẹo tiết kiệm: Mua món nhỏ dưới 0.5kg thì bật "Gộp đơn" ở bảng tính giá để được giảm 25% cước bay nha!

KIẾN THỨC CHUYÊN MÔN:
1. Cách chọn size: Giày Nhật tính chuẩn cm chiều dài chân; quần áo Uniqlo người Việt mặc phom cực đẹp.
2. Cảnh báo điện 100V: Mách khách mua thêm cục biến áp đổi nguồn 100V tầm 100k-200k cắm cho an toàn, không cắm thẳng 220V kẻo nổ nhé.
3. Mỹ phẩm & Đồ Hot: Tư vấn DHC, Anessa, Tảo xoắn Spirulina, Figure Anime chính hãng và thông báo số slot còn lại.

QUY TẮC BẢO VỆ VÀ GIỚI HẠN PHẠM VI TRẢ LỜI (STRICT GUARDRAIL):
- Bạn CHỈ ĐƯỢC PHÉP trả lời các câu hỏi liên quan đến mua sắm, order hàng Nhật Bản, tính cước, săn deal và dịch vụ của ChillBanana.
- NẾU người dùng hỏi các câu hỏi ngoài lề (viết code, làm văn/thơ, giải bài tập, bàn luận chính trị, tán gẫu ngoài luồng...), bạn BẮT BUỘC TỪ CHỐI THÂN THIỆN:
  "Dạ em là trợ lý mua hàng Nhật Bản của ChillBanana nè! Em chỉ rành nhất về mua sắm đồ Nhật, săn sale, tính cước và giao vận thôi ạ. Các chủ đề ngoài lề này em xin phép không dám 'chém gió' đâu nha. Anh/chị đang muốn tìm mua món đồ Nhật nào để em tư vấn và tìm deal giá tốt nhất cho mình nhé! 🍌"
`;

// Danh sách từ khóa ngoài luồng để chặn
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

// Fallback Knowledge Engine thông minh cho ChillBanana
export function getChillBananaSmartFallback(
  userQuery: string,
  personality: AIPersonality
): string {
  const q = userQuery.toLowerCase();
  const isOmo = personality === "omotenashi";

  // 1. Chặn câu hỏi ngoài luồng
  if (isQueryOutOfDomain(userQuery)) {
    if (isOmo) {
      return `Kính thưa Quý khách, em là trợ lý ảo chuyên trách tư vấn mua sắm và ủy thác mua hàng Nhật Bản của ChillBanana. Em xin phép chỉ hỗ trợ các thông tin liên quan đến sản phẩm nội địa Nhật, tỷ giá, cước phí và dịch vụ mua hộ ạ. Rất mong Quý khách thông cảm và cho em biết Quý khách đang quan tâm đến sản phẩm nào để em được phục vụ chu đáo nhất ạ! 🍌`;
    } else {
      return `Dạ em là trợ lý mua hàng Nhật Bản của ChillBanana nè! Em chỉ rành về mua sắm đồ Nhật, săn sale, tính cước và ship hàng thôi ạ. Mấy chủ đề ngoài lề này em xin phép không hỗ trợ nha. Anh/chị đang muốn tìm mua món đồ Nhật nào để em tư vấn giá tốt nhất nhé! 🍌`;
    }
  }

  // 2. Tra cứu mã đơn hàng
  if (q.includes("cb-") || q.includes("kzn-") || q.includes("đơn hàng") || q.includes("tra cứu") || q.includes("mã đơn")) {
    if (isOmo) {
      return `Dạ thưa Quý khách, để tra cứu hành trình chi tiết 7 bước của đơn hàng ChillBanana, Quý khách vui lòng nhập mã đơn hàng (ví dụ: CB-2026-8921) tại mục "Tra Cứu Đơn Hàng" hoặc truy cập trực tiếp /tracking ạ. Đội ngũ tại Tokyo và Việt Nam luôn cập nhật trạng thái liên tục từng chặng ạ! 📦`;
    } else {
      return `Dạ anh/chị chỉ cần nhập mã đơn hàng vào trang /tracking là xem được toàn bộ tiến độ 7 bước từ lúc nhân viên Tokyo mua hàng đến khi shipper giao tận nhà luôn nhé! Cần kiểm tra đơn nào cứ nhắn mã cho em nha! 🚀`;
    }
  }

  // 3. Tư vấn Điện áp 100V
  if (q.includes("điện áp") || q.includes("100v") || q.includes("220v") || q.includes("cắm điện") || q.includes("biến áp") || q.includes("nồi cơm") || q.includes("máy cạo râu")) {
    if (isOmo) {
      return `Kính thưa Quý khách, đồ điện gia dụng nội địa Nhật (như nồi cơm Zojirushi/Tiger, máy lọc không khí Sharp, máy sấy) sử dụng nguồn điện tiêu chuẩn 100V. Khi sử dụng tại Việt Nam (220V), Quý khách bắt buộc phải dùng thêm bộ đổi nguồn (biến áp Lioa/Standa) có công suất tương ứng để tránh bị chập cháy thiết bị ạ. Riêng một số dòng máy cạo râu và tai nghe cao cấp bên em có hỗ trợ dải điện 100V-240V có thể cắm trực tiếp ạ! ⚡`;
    } else {
      return `Lưu ý cực quan trọng nha anh/chị ơi! Đồ điện nội địa Nhật đa phần chạy điện 100V chuẩn Nhật. Cắm thẳng vào ổ 220V ở Việt Nam là cháy máy ngay đấy ạ. Anh/chị nhớ sắm thêm cục biến áp đổi nguồn (Lioa tầm 100k-250k) cắm vào là yên tâm xài bền bỉ 10-20 năm luôn nhé! 🔌`;
    }
  }

  // 4. Tư vấn Size quần áo & giày dép
  if (q.includes("size") || q.includes("kích thước") || q.includes("quần áo") || q.includes("giày") || q.includes("uniqlo") || q.includes("gu")) {
    if (isOmo) {
      return `Dạ thưa Quý khách về cách chọn size hàng Nhật:
- Quần áo Uniqlo / GU nội địa Nhật: Phom dáng rất chuẩn với người châu Á. Nếu Quý khách 50-58kg nên chọn Size S/M; 60-70kg chọn Size M/L; trên 72kg chọn Size XL.
- Giày dép: Nhật Bản sử dụng đơn vị đo Centimet (cm) trên chiều dài bàn chân thực tế (VD: chân dài 26cm sẽ chọn Size 26.0, tương đương 41 VN).
Quý khách có thể cho em xin số đo chiều cao, cân nặng để em tư vấn size vừa vặn nhất ạ! 👔`;
    } else {
      return `Mẹo chọn size đồ Nhật chuẩn đét cùng ChillBanana nè:
👕 Quần áo Uniqlo/GU: Phom người Nhật rất hợp dáng người Việt. Dưới 58kg mặc S hoặc M; 60-70kg chọn M hoặc L là đẹp chuẩn!
👟 Giày dép: Giày Nhật tính bằng cm (chiều dài chân). Anh/chị cứ đo bàn chân từ gót đến ngón dài nhất bao nhiêu cm thì chọn đúng size số đó là vừa khít luôn! ✨`;
    }
  }

  // 5. Cước phí & Gộp đơn
  if (q.includes("gộp đơn") || q.includes("tối thiểu") || q.includes("cước") || q.includes("phí ship") || q.includes("tỷ giá")) {
    if (isOmo) {
      return `Kính thưa Quý khách, biểu phí mua hộ tại ChillBanana như sau:
- Tỷ giá Yên Nhật: 1 JPY = ${DEFAULT_EXCHANGE_RATE} VND.
- Cước bay quốc tế hỏa tốc: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg (bay 3-5 ngày về Hà Nội/TP.HCM).
- Hạn mức đơn tối thiểu: ${MIN_ORDER_THRESHOLD_VND.toLocaleString()} đ.
- Chính sách Gộp Đơn (Group Buy): Với các món hàng nhỏ dưới 0.5kg, Quý khách chỉ cần tích chọn "Bật Chế Độ Gộp Đơn" tại bảng tính giá để được giảm ngay 25% cước bay ạ! ✈`;
    } else {
      return `Bảng giá cước siêu ưu đãi tại ChillBanana đây ạ:
💰 Tỷ giá hôm nay: 1 Yên = ${DEFAULT_EXCHANGE_RATE} đ.
✈ Cước bay hỏa tốc: ${AIR_SHIPPING_PER_KG.toLocaleString()} đ/kg (bay 3 chuyến/tuần, chỉ 3-5 ngày có mặt ở VN).
🌟 Mẹo siêu hời: Nếu anh/chị mua món nhỏ dưới 0.5kg (son, mỹ phẩm, vitamin), nhớ tick chọn "Gộp đơn" ở bảng tính giá để được giảm 25% cước bay nhé! 🍌`;
    }
  }

  // 6. Gợi ý 4 danh mục hot
  if (q.includes("mỹ phẩm") || q.includes("tảo xoắn") || q.includes("figure") || q.includes("anime") || q.includes("sản phẩm") || q.includes("gợi ý")) {
    if (isOmo) {
      return `Dạ thưa Quý khách, ChillBanana hiện đang có sẵn slot gom đơn giá tốt cho 4 nhóm hàng chủ lực:
1. 🌸 Mỹ Phẩm: Dầu tẩy trang DHC Deep Cleansing Oil, Kem chống nắng Anessa UV Milk.
2. 🌿 Thực Phẩm Chức Năng: Tảo xoắn vàng Spirulina EX 1000 viên, Viên bổ não Orihiro Ginkgo.
3. ⚡ Gia Dụng Mini: Bình giữ nhiệt Zojirushi 480ml, Máy cạo râu Panasonic ES-RT19.
4. 🎎 Anime Sưu Tầm: Figure Luffy Gear 5 MegaHouse tem vàng, Mô hình Gunpla RG RX-78-2 Ver 2.0.
Quý khách có thể xem và đặt mua trực tiếp tại trang chủ hoặc dán link bất kỳ từ Amazon/Mercari để em tính giá ạ! 🛍`;
    } else {
      return `ChillBanana đang có 4 danh mục hàng Nhật cực hot đang sẵn slot gom đây ạ:
🌸 Mỹ phẩm: DHC Tẩy trang, Kem chống nắng Anessa chuẩn nội địa.
🌿 Sức khỏe: Tảo xoắn vàng Spirulina EX và Viên Ginkgo bổ não Orihiro.
⚡ Gia dụng công nghệ: Bình giữ nhiệt Zojirushi 24h, máy cạo râu Panasonic sạc nhanh.
🎎 Anime Figure: Luffy Gear 5 MegaHouse chính hãng và mô hình Gundam RG RX-78-2 siêu nét!
Anh/chị ưng món nào nhắn em giữ slot gom ngay nha! 🔥`;
    }
  }

  // Mặc định
  if (isOmo) {
    return `Kính chào Quý khách! Em là ChillBanana AI - Chuyên viên tư vấn mua sắm và order hàng Nhật Bản. Em có thể hỗ trợ Quý khách:
1. Dán link sản phẩm (Amazon JP, Mercari, Rakuten...) và báo giá trọn gói về Việt Nam.
2. Tư vấn chọn size quần áo, giày dép chuẩn Nhật.
3. Hướng dẫn sử dụng đồ điện 100V an toàn.
4. Tiết kiệm 25% cước bay với tính năng Gộp Đơn (Group Buy).
Kính mời Quý khách đặt câu hỏi để em được phục vụ chu đáo nhất ạ! 🍌`;
  } else {
    return `Chào anh/chị nha! Em là ChillBanana AI đây ạ! 🍌 Anh/chị cần em hỗ trợ gì nè:
👉 Tính giá theo link sản phẩm (Amazon, Rakuten, Mercari...)?
👉 Tư vấn size đồ, hạn sử dụng mỹ phẩm Nhật?
👉 Lưu ý cắm điện 100V đồ gia dụng Nhật?
👉 Chỉ cách Gộp Đơn tiết kiệm tối đa cước bay?
Cứ thoải mái hỏi em nha, em giải đáp liền tay trong tích tắc! ✨`;
  }
}
