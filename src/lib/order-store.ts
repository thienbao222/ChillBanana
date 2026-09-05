import { OrderStatus } from "@/types";

export interface StoredOrder {
  id: string;
  orderCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  originalUrl: string;
  productName: string;
  category: string;
  priceJpy: number;
  weightKg: number;
  exchangeRate: number;
  productPriceVnd: number;
  serviceFeeVnd: number;
  shippingFeeVnd: number;
  totalVnd: number;
  depositAmountVnd: number;
  paymentStatus: "UNPAID" | "DEPOSITED_50" | "PAID_100";
  paymentMethod: string;
  isGroupBuy: boolean;
  groupBuyCode?: string;
  status: OrderStatus;
  jpDomesticTrack?: string;
  vnDomesticTrack?: string;
  customerNote?: string;
  adminNote?: string;
  trackingLogs: {
    id: string;
    status: OrderStatus;
    title: string;
    description: string;
    location: string;
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

// Không dùng dữ liệu mẫu - Lưu trữ đơn hàng thực tế phát sinh từ người dùng
const INITIAL_SAMPLE_ORDERS: StoredOrder[] = [];

// Singleton in-memory storage
const globalForOrders = global as unknown as { ordersStore: StoredOrder[] };
export const ordersStore = globalForOrders.ordersStore || [];
if (process.env.NODE_ENV !== "production") globalForOrders.ordersStore = ordersStore;

export function getAllOrders(): StoredOrder[] {
  return ordersStore;
}

export function getOrderByCode(code: string): StoredOrder | undefined {
  const cleanCode = code.trim().toUpperCase();
  return ordersStore.find((o) => o.orderCode.toUpperCase() === cleanCode || o.id === code);
}

export function createOrder(data: Partial<StoredOrder>): StoredOrder {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderCode = `CB-${new Date().getFullYear()}-${randomSuffix}`;
  
  const now = new Date().toISOString();
  const nowFormatted = new Date().toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const newOrder: StoredOrder = {
    id: "ord-" + Date.now(),
    orderCode,
    customerName: data.customerName || "Khách hàng",
    customerEmail: data.customerEmail || "khachhang@chillbanana.vn",
    customerPhone: data.customerPhone || "0900000000",
    customerAddress: data.customerAddress || "Việt Nam",
    originalUrl: data.originalUrl || "",
    productName: data.productName || "Sản phẩm Nhật Bản",
    category: data.category || "cosmetics",
    priceJpy: data.priceJpy || 0,
    weightKg: data.weightKg || 0.5,
    exchangeRate: data.exchangeRate || 172,
    productPriceVnd: data.productPriceVnd || 0,
    serviceFeeVnd: data.serviceFeeVnd || 0,
    shippingFeeVnd: data.shippingFeeVnd || 0,
    totalVnd: data.totalVnd || 0,
    depositAmountVnd: data.depositAmountVnd || 0,
    paymentStatus: data.depositAmountVnd === data.totalVnd ? "PAID_100" : "DEPOSITED_50",
    paymentMethod: data.paymentMethod || "VIETQR",
    isGroupBuy: !!data.isGroupBuy,
    status: "PENDING_DEPOSIT",
    customerNote: data.customerNote || "",
    trackingLogs: [
      {
        id: "log-" + Date.now(),
        status: "PENDING_DEPOSIT",
        title: "Khởi tạo đơn hàng & Sinh mã VietQR",
        description: `Đơn hàng #${orderCode} đã được khởi tạo thành công trên hệ thống ChillBanana.`,
        location: "Hệ thống ChillBanana",
        createdAt: nowFormatted,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  ordersStore.unshift(newOrder);
  return newOrder;
}

export function updateOrderStatus(
  orderCode: string,
  newStatus: OrderStatus,
  title: string,
  description: string,
  location: string,
  extra?: { jpTrack?: string; vnTrack?: string; weightKg?: number }
): StoredOrder | null {
  const order = getOrderByCode(orderCode);
  if (!order) return null;

  const nowFormatted = new Date().toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  order.status = newStatus;
  order.updatedAt = new Date().toISOString();

  if (extra?.jpTrack) order.jpDomesticTrack = extra.jpTrack;
  if (extra?.vnTrack) order.vnDomesticTrack = extra.vnTrack;
  if (extra?.weightKg) order.weightKg = extra.weightKg;

  order.trackingLogs.push({
    id: "log-" + Date.now(),
    status: newStatus,
    title,
    description,
    location,
    createdAt: nowFormatted,
  });

  return order;
}
