export type OrderStatus =
  | "PENDING_DEPOSIT"  // Chờ đặt cọc
  | "PURCHASING_JP"    // Đang mua tại Nhật
  | "WAREHOUSE_JP"     // Đã về kho Tokyo/Osaka
  | "IN_TRANSIT_AIR"   // Đang bay quốc tế JP -> VN
  | "WAREHOUSE_VN"     // Đã về kho Hà Nội / TP.HCM
  | "LOCAL_DELIVERY"   // Đang giao hàng nội địa
  | "COMPLETED";       // Giao hàng thành công

export type PaymentStatus = "UNPAID" | "DEPOSITED_50" | "PAID_100";
export type PaymentMethod = "VIETQR" | "VNPAY" | "MOMO" | "COD";
export type AIPersonality = "omotenashi" | "vietnamese";

export interface ProductCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  badge: string;
}

export interface CuratedProduct {
  id: string;
  name: string;
  slug: string;
  category: "cosmetics" | "health" | "gadgets" | "anime";
  categoryName: string;
  priceJpy: number;
  priceVnd: number;
  weightKg: number;
  imageUrl: string;
  description: string;
  originalStore: string;
  stockSlots: number;
  isHot: boolean;
  featuredNote?: string;
  voltageNote?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  categoryName: string;
  excerpt: string;
  content: string;
  coverImage: string;
  readTime: string;
  publishedAt: string;
}

export interface PriceCalculationResult {
  priceJpy: number;
  exchangeRate: number;
  productPriceVnd: number;
  serviceFeeVnd: number;
  shippingFeeVnd: number;
  weightKg: number;
  totalVnd: number;
  deposit50Vnd: number;
  isUnderMinOrder: boolean;
  minOrderDiffVnd: number;
  canGroupBuy: boolean;
}

export interface TrackingStep {
  status: OrderStatus;
  title: string;
  description: string;
  location: string;
  date?: string;
  isDone: boolean;
  isCurrent: boolean;
}
