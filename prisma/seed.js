const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "chillbanana_secure_admin_salt_2026";

function hashPassword(password) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(password).digest("hex");
}

async function main() {
  console.log("🌱 Bắt đầu khởi tạo dữ liệu mẫu cho ChillBanana (Prisma SQLite)...");

  // 1. Tạo tài khoản Admin mặc định
  const adminPassword = "ChillBanana@2026";
  const adminHash = hashPassword(adminPassword);

  const admin = await prisma.adminUser.upsert({
    where: { username: "admin" },
    update: { passwordHash: adminHash },
    create: {
      username: "admin",
      passwordHash: adminHash,
      name: "Quản Trị Viên ChillBanana",
      role: "SUPER_ADMIN",
    },
  });
  console.log(`✅ Đã tạo tài khoản quản trị: ${admin.username} / ${adminPassword}`);

  // 2. Tạo đơn hàng mẫu
  const sampleOrders = [
    {
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
      depositAmountVnd: 525000,
      paymentStatus: "DEPOSITED_50",
      paymentMethod: "VIETQR",
      isGroupBuy: false,
      status: "IN_TRANSIT_AIR",
      jpDomesticTrack: "SGW-88219412",
      vnDomesticTrack: "GHTK-VN0982341",
    },
    {
      orderCode: "CB-2026-9042",
      customerName: "Trần Thị Mai Phương",
      customerEmail: "maiphuong.tran@gmail.com",
      customerPhone: "0912567890",
      customerAddress: "Toà nhà Landmark 81, 720A Điện Biên Phủ, Quận Bình Thạnh, TP.HCM",
      originalUrl: "https://www.amazon.co.jp/dp/B08XYZ1234",
      productName: "Kem Chống Nắng Anessa Perfect UV Skincare Milk 60ml",
      category: "cosmetics",
      priceJpy: 2680,
      weightKg: 0.2,
      exchangeRate: 172,
      productPriceVnd: 460960,
      serviceFeeVnd: 20000,
      shippingFeeVnd: 27750,
      totalVnd: 508710,
      depositAmountVnd: 508710,
      paymentStatus: "PAID_100",
      paymentMethod: "VIETQR",
      isGroupBuy: true,
      groupBuyCode: "GB-2026-WK36",
      status: "WAREHOUSE_JP",
      jpDomesticTrack: "YMT-9941203",
    },
    {
      orderCode: "CB-2026-7319",
      customerName: "Lê Hoàng Nam",
      customerEmail: "hoangnam.le@gmail.com",
      customerPhone: "0903456781",
      customerAddress: "Số 12 Lê Duẩn, Quận 1, TP.HCM",
      originalUrl: "https://order.mandarake.co.jp/order/detailPage/item?itemCode=123",
      productName: "Mô Hình Gunpla RG 1/144 RX-78-2 Gundam Ver. 2.0 Bandai",
      category: "anime",
      priceJpy: 3850,
      weightKg: 0.55,
      exchangeRate: 172,
      productPriceVnd: 662200,
      serviceFeeVnd: 26488,
      shippingFeeVnd: 101750,
      totalVnd: 790438,
      depositAmountVnd: 790438,
      paymentStatus: "PAID_100",
      paymentMethod: "VIETQR",
      isGroupBuy: false,
      status: "COMPLETED",
      jpDomesticTrack: "YMT-1029384",
      vnDomesticTrack: "GHN-HCM9912",
    },
  ];

  for (const ord of sampleOrders) {
    await prisma.order.upsert({
      where: { orderCode: ord.orderCode },
      update: {},
      create: ord,
    });
  }
  console.log(`✅ Đã khởi tạo ${sampleOrders.length} đơn hàng mẫu.`);

  // 3. Khởi tạo dữ liệu Chat AI mẫu để phân tích xu hướng ngay lập tức
  const sampleSessions = [
    {
      sessionId: "session-demo-gundam-01",
      personality: "omotenashi",
      topic: "Anime & Mô Hình Figure",
      detectedKeywords: "Gundam/Gunpla, Bandai",
      sentiment: "inquiry",
      messages: [
        {
          role: "user",
          content: "Shop ơi mình muốn order mô hình Gundam RG RX-78-2 trên Amazon JP thì phí vận chuyển tính thế nào?",
          categoryTag: "Anime & Mô Hình Figure",
        },
        {
          role: "assistant",
          content: "Kính chào Quý khách! Mô hình Gundam RG 1/144 RX-78-2 có trọng lượng khoảng 0.55kg. Cước vận chuyển hỏa tốc là 185.000đ/kg (khoảng 101.000đ cước). ChillBanana đóng gói hộp xốp bóng khí 4 lớp bảo vệ góc hộp nguyên seal 100% khi về Việt Nam ạ! 🍌",
          categoryTag: "Anime & Mô Hình Figure",
        },
      ],
    },
    {
      sessionId: "session-demo-ricecooker-02",
      personality: "vietnamese",
      topic: "Gia Dụng & Đồ Điện 100V",
      detectedKeywords: "Nồi cơm điện, Biến áp 100V",
      sentiment: "inquiry",
      messages: [
        {
          role: "user",
          content: "Nồi cơm Zojirushi cao tần của Nhật dùng điện 100V thì mua cục đổi nguồn nào ở VN vậy em?",
          categoryTag: "Gia Dụng & Đồ Điện 100V",
        },
        {
          role: "assistant",
          content: "Dạ anh nên mua cục biến áp Lioa hoặc Standa loại công suất 1500W - 2000W nha! Vì nồi cơm cao tần Nhật đun nhiệt rất khỏe nên cần biến áp đủ tải để không bị sụt áp hay chập cháy ạ! ⚡🍌",
          categoryTag: "Gia Dụng & Đồ Điện 100V",
        },
      ],
    },
    {
      sessionId: "session-demo-cosmetics-03",
      personality: "omotenashi",
      topic: "Mỹ Phẩm & Chăm Sóc Da",
      detectedKeywords: "Kem chống nắng, Anessa",
      sentiment: "positive",
      messages: [
        {
          role: "user",
          content: "Kem chống nắng Anessa màu vàng bản nội địa Nhật có sẵn slot gom đơn không bạn?",
          categoryTag: "Mỹ Phẩm & Chăm Sóc Da",
        },
        {
          role: "assistant",
          content: "Dạ thưa Quý khách, Anessa Perfect UV Milk hiện đang có trong danh mục 4 sản phẩm chủ lực của ChillBanana và đang mở slot Gộp Đơn (Group Buy) giảm 25% cước vận chuyển quốc tế ạ! 🌸🍌",
          categoryTag: "Mỹ Phẩm & Chăm Sóc Da",
        },
      ],
    },
  ];

  for (const s of sampleSessions) {
    const existing = await prisma.chatSession.findUnique({
      where: { sessionId: s.sessionId },
    });
    if (!existing) {
      await prisma.chatSession.create({
        data: {
          sessionId: s.sessionId,
          personality: s.personality,
          topic: s.topic,
          detectedKeywords: s.detectedKeywords,
          sentiment: s.sentiment,
          messages: {
            create: s.messages,
          },
        },
      });
    }
  }
  console.log(`✅ Đã khởi tạo ${sampleSessions.length} phiên chat AI mẫu cho Module Thống kê xu hướng.`);
}

main()
  .catch((e) => {
    console.error("Lỗi seed dữ liệu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
