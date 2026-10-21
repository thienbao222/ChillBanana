import type { CuratedProduct, NewsItem, ProductCategory } from "@/types";
import curatedProducts from "./curated-products.json";
import kizunaNewsData from "./kizuna-news.json";
export {
  AIR_SHIPPING_PER_KG,
  DEFAULT_EXCHANGE_RATE,
  MIN_ORDER_THRESHOLD_VND,
  SERVICE_FEE_RATE,
  calculateOrderPrice,
} from "@/features/pricing/calculator";

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

export const KIZUNA_NEWS: NewsItem[] = kizunaNewsData as NewsItem[];
