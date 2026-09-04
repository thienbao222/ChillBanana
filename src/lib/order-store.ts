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

// Đơn hàng mẫu thực tế cho ChillBanana
const INITIAL_SAMPLE_ORDERS: StoredOrder[] = [
  {
    id: "sample-cb-1",
    orderCode: "CB-2026-8921",
    customerName: "Nguyễn Minh Tuấn",
    customerEmail: "minhtuan.nguyen@gmail.com",
    customerPhone: "0982345678",
    customerAddress: "Số 45 Cầu Giấy, Phường Quan Hoa, Quận Cầu Giấy, Hà Nội",
    originalUrl: "https://www.amazon.co.jp/dp/B000FQ4F86",
    productName: "Tảo Xoắn Vàng Spirulina EX DIC (1000 viên)",
    category: "health",
    priceJpy: 5200,
    weightKg: 0.65,
    exchangeRate: 172,
    productPriceVnd: 894400,
    serviceFeeVnd: 35776,
    shippingFeeVnd: 120250,
    totalVnd: 1050426,
    depositAmountVnd: 525213,
    paymentStatus: "DEPOSITED_50",
    paymentMethod: "VIETQR",
    isGroupBuy: false,
    status: "IN_TRANSIT_AIR",
    jpDomesticTrack: "YAMATO-8921-JP",
    vnDomesticTrack: "GHTK-HN-202688",
    customerNote: "Giao trong giờ hành chính giúp mình",
    createdAt: "2026-09-01T08:30:00.000Z",
    updatedAt: "2026-09-03T14:15:00.000Z",
    trackingLogs: [
      {
        id: "log-1",
        status: "PENDING_DEPOSIT",
        title: "Khởi tạo đơn hàng & Chờ đặt cọc",
        description: "Khách hàng đã tạo đơn mua hộ qua công cụ tính giá tự động của ChillBanana.",
        location: "Hệ thống ChillBanana",
        createdAt: "2026-09-01 08:30",
      },
      {
        id: "log-2",
        status: "PURCHASING_JP",
        title: "Đã xác nhận cọc - Đang mua tại Tokyo",
        description: "Nhân viên văn phòng Tokyo đã tiến hành order trực tiếp từ Amazon JP.",
        location: "Tokyo, Nhật Bản",
        createdAt: "2026-09-01 11:20",
      },
      {
        id: "log-3",
        status: "WAREHOUSE_JP",
        title: "Đã nhập kho Edogawa Tokyo",
        description: "Kiện hàng đã về kho Nhật, kiểm tra seal nguyên vẹn, cân nặng thực tế 0.65kg.",
        location: "Kho Tokyo (Edogawa-ku)",
        createdAt: "2026-09-02 16:45",
      },
      {
        id: "log-4",
        status: "IN_TRANSIT_AIR",
        title: "Đang bay quốc tế Tokyo ✈ Hà Nội",
        description: "Kiện hàng đã được đóng chuyến bay số hiệu VN311 từ Sân bay Quốc tế Narita (NRT) về Sân bay Quốc tế Nội Bài (HAN).",
        location: "Sân bay Quốc tế Narita (NRT)",
        createdAt: "2026-09-03 14:15",
      },
    ],
  },
  {
    id: "sample-cb-2",
    orderCode: "CB-2026-5512",
    customerName: "Trần Mai Phương",
    customerEmail: "maiphuong.tran@gmail.com",
    customerPhone: "0918765432",
    customerAddress: "Căn hộ B12-08 Sunrise City, Quận 7, TP. Hồ Chí Minh",
    originalUrl: "https://jp.mercari.com/item/m789123456",
    productName: "Figure Luffy Gear 5 MegaHouse Variable Action Heroes",
    category: "anime",
    priceJpy: 12500,
    weightKg: 0.9,
    exchangeRate: 172,
    productPriceVnd: 2150000,
    serviceFeeVnd: 86000,
    shippingFeeVnd: 166500,
    totalVnd: 2402500,
    depositAmountVnd: 2402500,
    paymentStatus: "PAID_100",
    paymentMethod: "VIETQR",
    isGroupBuy: true,
    status: "LOCAL_DELIVERY",
    jpDomesticTrack: "SAGAWA-5512-JP",
    vnDomesticTrack: "GHN-SGN-990112",
    createdAt: "2026-08-28T09:15:00.000Z",
    updatedAt: "2026-09-04T08:00:00.000Z",
    trackingLogs: [
      {
        id: "log-21",
        status: "PENDING_DEPOSIT",
        title: "Khởi tạo đơn hàng & Thanh toán 100%",
        description: "Khách hàng thanh toán trọn gói 100% qua mã VietQR Napas 247.",
        location: "Hệ thống ChillBanana",
        createdAt: "2026-08-28 09:15",
      },
      {
        id: "log-22",
        status: "PURCHASING_JP",
        title: "Đã hoàn tất mua hàng tại Tokyo",
        description: "Nhân viên đã mua thành công sản phẩm từ seller Mercari có tem bảo an vàng Toei.",
        location: "Tokyo, Nhật Bản",
        createdAt: "2026-08-28 14:00",
      },
      {
        id: "log-23",
        status: "WAREHOUSE_JP",
        title: "Đã nhập kho & Đóng gói chống sốc",
        description: "Hàng về kho Tokyo, bọc xốp bóng khí 4 lớp bảo vệ hộp Figure hoàn hảo.",
        location: "Kho Tokyo (Edogawa-ku)",
        createdAt: "2026-08-30 11:30",
      },
      {
        id: "log-24",
        status: "IN_TRANSIT_AIR",
        title: "Bay quốc tế Tokyo ✈ TP.HCM",
        description: "Chuyến bay ANA Cargo hạ cánh Sân bay Tân Sơn Nhất (SGN).",
        location: "Sân bay Tân Sơn Nhất (SGN)",
        createdAt: "2026-09-02 18:00",
      },
      {
        id: "log-25",
        status: "WAREHOUSE_VN",
        title: "Đã thông quan & Nhập kho Tân Bình",
        description: "Kiện hàng hoàn tất thông quan hải quan và chuyển về kho phân loại TP.HCM.",
        location: "Kho ChillBanana Tân Bình, TP.HCM",
        createdAt: "2026-09-03 10:00",
      },
      {
        id: "log-26",
        status: "LOCAL_DELIVERY",
        title: "Đang giao hàng chặng cuối (GHN Express)",
        description: "Shipper GHN đang trên đường giao hàng đến địa chỉ Quận 7.",
        location: "Quận 7, TP.HCM",
        createdAt: "2026-09-04 08:00",
      },
    ],
  },
];

// Singleton in-memory storage
const globalForOrders = global as unknown as { ordersStore: StoredOrder[] };
export const ordersStore = globalForOrders.ordersStore || [...INITIAL_SAMPLE_ORDERS];
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
