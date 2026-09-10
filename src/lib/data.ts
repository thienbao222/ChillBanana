import { CuratedProduct, NewsItem, ProductCategory } from "@/types";

export const DEFAULT_EXCHANGE_RATE = 172; // 1 JPY = 172 VND
export const AIR_SHIPPING_PER_KG = 185000; // 185.000đ / kg
export const MIN_ORDER_THRESHOLD_VND = 300000; // Hạn mức tối thiểu 300k VND
export const SERVICE_FEE_RATE = 0.04; // 4% phí mua hộ & bảo hiểm trọn gói

export const CATEGORIES: ProductCategory[] = [
  {
    id: "cosmetics",
    name: "Mỹ Phẩm & Chăm Sóc Da",
    icon: "Sparkles",
    description: "Hàng chính hãng Cosme Nhật: DHC, Hada Labo, Anessa, Shiseido",
    badge: "Hot Sale",
  },
  {
    id: "health",
    name: "Thực Phẩm Chức Năng",
    icon: "HeartPulse",
    description: "Bảo vệ sức khỏe gia đình: Tảo xoắn, Nattokinase, Orihiro",
    badge: "Bán Chạy",
  },
  {
    id: "gadgets",
    name: "Gia Dụng & Điện Tử Mini",
    icon: "Cpu",
    description: "Bình giữ nhiệt, máy cạo râu, tai nghe (Kèm hướng dẫn điện 100V)",
    badge: "Nội Địa Nhật",
  },
  {
    id: "anime",
    name: "Anime, Manga & Sưu Tầm",
    icon: "Gamepad2",
    description: "Figure chính hãng Bandai, Good Smile, Nendoroid, Gunpla",
    badge: "Authentic 100%",
  },
];

export const CURATED_PRODUCTS: CuratedProduct[] = [
  // 1. Mỹ phẩm
  {
    id: "prod-cos-01",
    name: "Dầu Tẩy Trang DHC Deep Cleansing Oil 200ml",
    slug: "dhc-deep-cleansing-oil-200ml",
    category: "cosmetics",
    categoryName: "Mỹ Phẩm & Chăm Sóc Da",
    priceJpy: 2200,
    priceVnd: 410000,
    weightKg: 0.3,
    imageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80",
    description: "Chiết xuất dầu olive nguyên chất, loại bỏ sạch bụi bẩn và lớp trang điểm chống trôi, giữ ẩm tự nhiên.",
    originalStore: "Amazon JP / Rakuten",
    stockSlots: 15,
    isHot: true,
    featuredNote: "Top 1 Best-Seller @cosme Nhật Bản 3 năm liên tiếp",
  },
  {
    id: "prod-cos-02",
    name: "Kem Chống Nắng Anessa Perfect UV Sunscreen Skincare Milk 60ml",
    slug: "kem-chong-nang-anessa-perfect-uv-60ml",
    category: "cosmetics",
    categoryName: "Mỹ Phẩm & Chăm Sóc Da",
    priceJpy: 2680,
    priceVnd: 515000,
    weightKg: 0.15,
    imageUrl: "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=600&q=80",
    description: "Công nghệ Auto Booster chống nước, mồ hôi và nhiệt độ cao, bảo vệ da vượt trội cả ngày dài.",
    originalStore: "Matsumoto Kiyoshi JP",
    stockSlots: 8,
    isHot: true,
    featuredNote: "Phiên bản nội địa Nhật có tem bảo an",
  },
  {
    id: "prod-cos-03",
    name: "Sữa Rửa Mặt Hada Labo Gokujyun Hyaluronic Acid 100g",
    slug: "sua-rua-mat-hada-labo-gokujyun",
    category: "cosmetics",
    categoryName: "Mỹ Phẩm & Chăm Sóc Da",
    priceJpy: 780,
    priceVnd: 165000,
    weightKg: 0.15,
    imageUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80",
    description: "Bọt mịn siêu dày bổ sung 3 loại Axit Hyaluronic cấp ẩm sâu, độ pH 5.5 an toàn cho da nhạy cảm.",
    originalStore: "Rakuten JP",
    stockSlots: 24,
    isHot: false,
    featuredNote: "Giá nhẹ nhàng - Thích hợp gộp đơn",
  },

  // 2. Thực phẩm chức năng
  {
    id: "prod-hea-01",
    name: "Tảo Xoắn Vàng Spirulina EX DIC Nhật Bản (1000 viên)",
    slug: "tao-xoan-vang-spirulina-ex-dic-1000v",
    category: "health",
    categoryName: "Thực Phẩm Chức Năng",
    priceJpy: 5200,
    priceVnd: 985000,
    weightKg: 0.65,
    imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80",
    description: "Bổ sung hơn 50 loại dưỡng chất, vitamin, collagen và men vi sinh giúp tăng cường miễn dịch và tiêu hóa.",
    originalStore: "Amazon JP Official",
    stockSlots: 6,
    isHot: true,
    featuredNote: "Dòng tảo cao cấp màu vàng có chứng nhận GMP",
  },
  {
    id: "prod-hea-02",
    name: "Viên Uống Bổ Não Orihiro Ginkgo Biloba 120 viên",
    slug: "vien-uong-bo-nao-orihiro-ginkgo-biloba",
    category: "health",
    categoryName: "Thực Phẩm Chức Năng",
    priceJpy: 1850,
    priceVnd: 360000,
    weightKg: 0.2,
    imageUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=600&q=80",
    description: "Chiết xuất lá bạch quả Ginkgo giúp tăng cường tuần hoàn máu não, cải thiện trí nhớ và giảm đau đầu.",
    originalStore: "Orihiro JP Direct",
    stockSlots: 12,
    isHot: false,
    featuredNote: "Hạn sử dụng mới nhất 2028",
  },

  // 3. Gia dụng & Điện tử mini
  {
    id: "prod-gad-01",
    name: "Bình Giữ Nhiệt Zojirushi SM-SF48 (480ml - Giữ Nhiệt 24h)",
    slug: "binh-giu-nhiet-zojirushi-sm-sf48",
    category: "gadgets",
    categoryName: "Gia Dụng & Điện Tử Mini",
    priceJpy: 2980,
    priceVnd: 575000,
    weightKg: 0.35,
    imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80",
    description: "Ruột phủ chống dính công nghệ SlickSteel, giữ nóng/lạnh bền bỉ suốt 24 giờ, chống rò rỉ tuyệt đối.",
    originalStore: "Bic Camera JP",
    stockSlots: 10,
    isHot: true,
    featuredNote: "Chất liệu thép không gỉ SUS304 chuẩn an toàn Nhật Bản",
  },
  {
    id: "prod-gad-02",
    name: "Máy Cạo Râu Nội Địa Nhật Panasonic ES-RT19 (3 Lưỡi Đa Hướng)",
    slug: "may-cao-rau-panasonic-es-rt19",
    category: "gadgets",
    categoryName: "Gia Dụng & Điện Tử Mini",
    priceJpy: 4500,
    priceVnd: 860000,
    weightKg: 0.45,
    imageUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80",
    description: "Lưỡi cắt nanotech góc 30 độ bén ngọt, chống nước IPX7. Đi kèm chân sạc hỗ trợ sạc nhanh.",
    originalStore: "Yodobashi Camera",
    stockSlots: 5,
    isHot: true,
    featuredNote: "Bản sạc dải rộng 100V - 240V tiện lợi không cần cục đổi nguồn",
    voltageNote: "Hỗ trợ điện áp toàn cầu 100V-240V (Cắm trực tiếp tại VN)",
  },
  {
    id: "prod-gad-03",
    name: "Đồng Hồ Nam Citizen Eco-Drive BM8475-26E (Năng Lượng Ánh Sáng)",
    slug: "dong-ho-citizen-eco-drive-bm8475-26e",
    category: "gadgets",
    categoryName: "Gia Dụng & Điện Tử Mini",
    priceJpy: 18500,
    priceVnd: 3180000,
    weightKg: 0.3,
    imageUrl: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80",
    description: "Công nghệ sạc năng lượng ánh sáng Eco-Drive độc quyền Citizen Nhật Bản, mặt kính khoáng chống trầy, chống nước 100m.",
    originalStore: "Amazon JP Official",
    stockSlots: 6,
    isHot: true,
    featuredNote: "Không cần thay pin - Bảo hành chính hãng",
  },

  // 4. Anime & Sưu tầm
  {
    id: "prod-ani-01",
    name: "Mô Hình Figure Luffy Gear 5 MegaHouse Variable Action Heroes",
    slug: "figure-luffy-gear-5-megahouse",
    category: "anime",
    categoryName: "Anime, Manga & Sưu Tầm",
    priceJpy: 12500,
    priceVnd: 2380000,
    weightKg: 0.9,
    imageUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80",
    description: "Mô hình cử động chi tiết sắc nét với hiệu ứng khói và khuôn mặt thay thế, bản quyền Toei Animation.",
    originalStore: "Surugaya JP / AmiAmi",
    stockSlots: 3,
    isHot: true,
    featuredNote: "Hàng nguyên seal chính hãng có tem vàng Toei",
  },
  {
    id: "prod-ani-02",
    name: "Mô Hình Gunpla RG 1/144 RX-78-2 Gundam Ver. 2.0 Bandai Spirits",
    slug: "gunpla-rg-rx-78-2-gundam-ver-2",
    category: "anime",
    categoryName: "Anime, Manga & Sưu Tầm",
    priceJpy: 3850,
    priceVnd: 745000,
    weightKg: 0.55,
    imageUrl: "https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?auto=format&fit=crop&w=600&q=80",
    description: "Khung xương Real Grade thế hệ mới với biên độ khớp cực rộng, độ phân tách màu sắc hoàn hảo.",
    originalStore: "Bandai Hobby JP",
    stockSlots: 7,
    isHot: false,
    featuredNote: "Bản kỷ niệm 45 năm thương hiệu Gundam",
  },
];

export const KIZUNA_NEWS: NewsItem[] = [
  {
    id: "news-01",
    title: "Bí Quyết Săn Deal Giảm Giá Sâu Tới 50% Trên Amazon & Mercari Nhật Bản",
    slug: "bi-quyet-san-deal-giam-gia-amazon-mercari-nhat",
    category: "MeoSangSale",
    categoryName: "Mẹo Săn Deal",
    excerpt: "Cách săn coupon Prime Day, Black Friday Nhật và thương lượng giá với người bán trên Mercari JP để mua hàng chuẩn giá hời.",
    coverImage: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80",
    readTime: "3 phút đọc",
    publishedAt: "2026-09-02",
    content: `
      Săn hàng giảm giá nội địa Nhật Bản là cách tốt nhất để sở hữu sản phẩm cao cấp với chi phí tiết kiệm nhất.
      
      - Amazon Japan: Hãy theo dõi mục "Time Sale Festival" diễn ra hàng tháng và sử dụng extension Keepa để kiểm tra lịch sử biến động giá thực tế.
      - Mercari JP: Thiên đường đồ second-hand và figure sưu tầm như mới (Like New). Khi mua qua ChillBanana, nhân viên tại Nhật sẽ hỗ trợ kiểm tra độ uy tín của người bán trước khi giao dịch.
      - Mẹo gộp đơn: Gom các món phụ kiện nhỏ vào chung 1 kiện để tối ưu chi phí mở kiện và giảm 25% cước vận chuyển.
    `,
  },
  {
    id: "news-02",
    title: "Bảng Quy Đổi Size Quần Áo & Giày Dép Nhật - Việt Chuẩn Nhất",
    slug: "bang-quy-doi-size-quan-ao-giay-dep-nhat-viet",
    category: "KienThucNhat",
    categoryName: "Cẩm Nang Order",
    excerpt: "Cách chọn size chuẩn xác khi mua quần áo Uniqlo, GU, giày Onitsuka Tiger, Asics từ Nhật Bản tránh bị lệch phom người Việt.",
    coverImage: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=600&q=80",
    readTime: "4 phút đọc",
    publishedAt: "2026-08-28",
    content: `
      Khi mua hàng thời trang Nhật, bạn cần lưu ý phom dáng người Nhật thường có phần vai ôm hơn và tay áo vừa vặn.
      
      - Size Áo: Size S Nhật tương đương phom ôm người Việt (48-55kg), Size M Nhật (56-65kg), Size L Nhật (66-75kg).
      - Size Giày: Nhật dùng đơn vị đo Centimet (cm) trên chiều dài bàn chân thực tế. Ví dụ chân dài 26.0cm sẽ tương đương size 41 VN/EU.
    `,
  },
  {
    id: "news-03",
    title: "Cảnh Báo Điện Áp 100V Đồ Điện Gia Dụng Nội Địa Nhật & Cách Dùng",
    slug: "canh-bao-dien-ap-100v-do-dien-noi-dia-nhat",
    category: "Review",
    categoryName: "Kinh Nghiệm",
    excerpt: "Đồ điện tử Nhật Bản thường dùng nguồn 100V. Tuyệt đối không cắm trực tiếp vào điện 220V Việt Nam để tránh chập cháy.",
    coverImage: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=600&q=80",
    readTime: "3 phút đọc",
    publishedAt: "2026-08-20",
    content: `
      Rất nhiều khách hàng yêu thích chất lượng của nồi cơm điện Zojirushi/Tiger, máy lọc không khí Sharp, máy cạo râu hay máy sấy tóc nội địa Nhật.
      Tuy nhiên nguồn điện tại Nhật là 100V/50-60Hz, trong khi Việt Nam là 220V.
      
      Giải pháp: Bạn nên mua kèm bộ chuyển đổi nguồn Lioa hoặc Standa (công suất phù hợp từ 1000W - 2000W cho nồi cơm/bếp từ, hoặc 100W cho máy cạo râu/loa mini).
    `,
  },
  {
    id: "news-04",
    title: "Tiết Kiệm Tới 40% Cước Vận Chuyển Nhờ Tính Năng 'Gộp Đơn' (Group Buy)",
    slug: "tiet-kiem-40-phan-tram-cuoc-van-chuyen-gop-don",
    category: "MeoSangSale",
    categoryName: "Mẹo Săn Deal",
    excerpt: "Tìm hiểu cơ chế ghép các món hàng nhỏ lẻ vào chung 1 kiện bay hàng tuần để tối ưu chi phí mở kiện và cước cân nặng.",
    coverImage: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80",
    readTime: "3 phút đọc",
    publishedAt: "2026-08-15",
    content: `
      Khi mua những món hàng nhẹ dưới 300g như thỏi son, bút chì, hay 1 gói viên uống vitamin, chi phí vận chuyển tối thiểu có thể chiếm tỷ trọng lớn.
      Với tính năng Gộp Đơn của ChillBanana, các gói hàng nhỏ sẽ được ghép chung kiện gửi định kỳ, giúp bạn tiết kiệm cước vận chuyển đáng kể.
    `,
  },
];

// Helper tính toán chi phí trọn gói
export function calculateOrderPrice(
  priceJpy: number,
  weightKg: number = 0.5,
  exchangeRate: number = DEFAULT_EXCHANGE_RATE,
  isGroupBuy: boolean = false
) {
  const safeWeight = Math.max(0.1, weightKg);
  const productPriceVnd = Math.round(priceJpy * exchangeRate);
  const serviceFeeVnd = Math.max(20000, Math.round(productPriceVnd * SERVICE_FEE_RATE));
  
  // Cước bay: Nếu gộp đơn và cân nặng nhẹ (<0.5kg) thì giảm 25% cước bay
  let shippingRate = AIR_SHIPPING_PER_KG;
  if (isGroupBuy && safeWeight <= 0.5) {
    shippingRate = Math.round(AIR_SHIPPING_PER_KG * 0.75);
  }
  const shippingFeeVnd = Math.round(safeWeight * shippingRate);
  const totalVnd = productPriceVnd + serviceFeeVnd + shippingFeeVnd;
  
  const isUnderMinOrder = totalVnd < MIN_ORDER_THRESHOLD_VND;
  const minOrderDiffVnd = Math.max(0, MIN_ORDER_THRESHOLD_VND - totalVnd);
  const deposit50Vnd = Math.round(totalVnd * 0.5);

  return {
    priceJpy,
    exchangeRate,
    productPriceVnd,
    serviceFeeVnd,
    shippingFeeVnd,
    weightKg: safeWeight,
    totalVnd,
    deposit50Vnd,
    isUnderMinOrder,
    minOrderDiffVnd,
    canGroupBuy: safeWeight <= 0.8 || isUnderMinOrder,
  };
}
