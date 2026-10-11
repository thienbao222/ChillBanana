import type { CuratedProduct, NewsItem, ProductCategory } from "@/types";
import curatedProducts from "./curated-products.json";

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

export const CURATED_PRODUCTS: CuratedProduct[] = curatedProducts as CuratedProduct[];

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
  weightKg: number = 0,
  exchangeRate: number = DEFAULT_EXCHANGE_RATE,
  isGroupBuy: boolean = false
) {
  const productPriceVnd = Math.round(priceJpy * exchangeRate);
  const serviceFeeVnd = Math.max(20000, Math.round(productPriceVnd * SERVICE_FEE_RATE));
  
  // Tiền cọc đợt 1 (50% tiền hàng + phí dịch vụ mua hộ)
  const baseOrderCostVnd = productPriceVnd + serviceFeeVnd;
  const deposit50Vnd = Math.round(baseOrderCostVnd * 0.5);

  // Cước bay quốc tế: Chỉ tính khi có cân nặng thực tế từ kho hoặc khách tự nhập tham khảo
  let shippingFeeVnd = 0;
  if (weightKg > 0) {
    let shippingRate = AIR_SHIPPING_PER_KG;
    if (isGroupBuy && weightKg <= 0.5) {
      shippingRate = Math.round(AIR_SHIPPING_PER_KG * 0.75);
    }
    shippingFeeVnd = Math.round(weightKg * shippingRate);
  }

  const totalVnd = baseOrderCostVnd + shippingFeeVnd;
  const isUnderMinOrder = baseOrderCostVnd < MIN_ORDER_THRESHOLD_VND;
  const minOrderDiffVnd = Math.max(0, MIN_ORDER_THRESHOLD_VND - baseOrderCostVnd);

  return {
    priceJpy,
    exchangeRate,
    productPriceVnd,
    serviceFeeVnd,
    baseOrderCostVnd,
    shippingFeeVnd,
    weightKg,
    totalVnd,
    deposit50Vnd,
    isUnderMinOrder,
    minOrderDiffVnd,
    canGroupBuy: weightKg <= 0.8 || isUnderMinOrder,
  };
}
