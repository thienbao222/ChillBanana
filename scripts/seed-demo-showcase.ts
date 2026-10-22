// FILE: scripts/seed-demo-showcase.ts
// Script khởi tạo bộ dữ liệu mẫu toàn diện (Showcase Demo Data) cho buổi bảo vệ Tiểu luận & Live Demo.
// Bảo đảm an toàn: KHÔNG xóa tài khoản AdminUser, Product catalog hay SystemConfig/PricingConfig hiện có.
// Bơm dữ liệu chuẩn chỉnh 100% theo schema.prisma vào:
//   - Customer: 2 khách hàng thành viên có email verified
//   - Order: 5 đơn mua hộ JP -> VN rải đều các trạng thái
//   - VnJpShipment: 5 vận đơn gửi hàng VN -> JP rải đều 5 cột Kanban
//   - ChatSession & ChatMessage: 2 phiên AI Lead kèm tin nhắn tư vấn
//   - AuditLog & PaymentTransaction: Nhật ký kiểm toán và thanh toán mẫu

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Bắt đầu nạp bộ dữ liệu mẫu Live Demo (Showcase Data) cho ChillBanana...");

  const passwordHash = hashPassword("Chill@2026");

  // 1. Tạo 2 Khách hàng thành viên mẫu (Customer)
  console.log("👤 [1/5] Đang tạo tài khoản khách hàng mẫu (Customer)...");
  const customerBao = await prisma.customer.upsert({
    where: { email: "baodt.tdmu@gmail.com" },
    update: {
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: "baodt.tdmu@gmail.com",
      name: "Đỗ Thiên Bảo",
      phone: "0912345678",
      address: "Số 06 Trần Văn Ơn, Phường Phú Hòa, TP. Thủ Dầu Một, Bình Dương",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const customerLan = await prisma.customer.upsert({
    where: { email: "lan.nguyen.jp@gmail.com" },
    update: {
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: "lan.nguyen.jp@gmail.com",
      name: "Nguyễn Phương Lan",
      phone: "0987654321",
      address: "Khu đô thị Sala, Phường An Lợi Đông, TP. Thủ Đức, TP.HCM",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`   ✅ Đã tạo/cập nhật 2 khách hàng: ${customerBao.email}, ${customerLan.email}`);

  // Lấy danh sách sản phẩm Catalog để gắn vào OrderItem nếu có
  const catalogProducts = await prisma.product.findMany({ take: 4 });

  // 2. Tạo 5 Đơn hàng mua hộ chiều JP -> VN (Order)
  console.log("📦 [2/5] Đang nạp 5 đơn hàng mua hộ chiều JP ➔ VN (Order)...");
  const demoOrders = [
    {
      orderCode: "CB-2026-DEMO-101",
      customerName: customerBao.name,
      customerEmail: customerBao.email,
      customerPhone: customerBao.phone || "0912345678",
      customerAddress: customerBao.address || "Thủ Dầu Một, Bình Dương",
      customerId: customerBao.id,
      customerType: "REGISTERED",
      originalUrl: "https://jp.mercari.com/item/m98765432101",
      productName: catalogProducts[0]?.name || "Mô hình Figure Luffy Gear 5 Bandai Spirits Chính Hãng",
      category: "anime",
      priceJpy: 6800,
      weightKg: 0.8,
      exchangeRate: 175,
      productPriceVnd: 1190000,
      serviceFeeVnd: 47600,
      shippingFeeVnd: 148000,
      totalVnd: 1385600,
      depositPercent: 50,
      depositAmountVnd: 618800,
      paymentStatus: "DEPOSITED_50",
      paymentMethod: "VIETQR",
      status: "PURCHASING_JP",
      isPriceVerified: true,
      priceVerifiedAt: new Date(Date.now() - 3600000 * 24),
      isGroupBuy: false,
      adminNote: "Đã liên hệ người bán Mercari JP, nhân viên tại Tokyo chuẩn bị thanh toán và nhận hàng.",
      customerNote: "Hộp mô hình nhớ bọc thêm xốp chống sốc giúp mình nhé shop.",
    },
    {
      orderCode: "CB-2026-DEMO-102",
      customerName: customerLan.name,
      customerEmail: customerLan.email,
      customerPhone: customerLan.phone || "0987654321",
      customerAddress: customerLan.address || "TP. Thủ Đức, TP.HCM",
      customerId: customerLan.id,
      customerType: "REGISTERED",
      originalUrl: "https://www.amazon.co.jp/dp/B09V3KXJPB",
      productName: catalogProducts[1]?.name || "Bình giữ nhiệt Zojirushi SM-WA48 Nội Địa Nhật 480ml",
      category: "other",
      priceJpy: 4200,
      weightKg: 0.4,
      exchangeRate: 175,
      productPriceVnd: 735000,
      serviceFeeVnd: 29400,
      shippingFeeVnd: 55500, // Đã giảm 25% nhờ Gộp đơn
      totalVnd: 819900,
      depositPercent: 50,
      depositAmountVnd: 382200,
      paymentStatus: "DEPOSITED_50",
      paymentMethod: "VNPAY",
      status: "WAREHOUSE_JP",
      isPriceVerified: true,
      priceVerifiedAt: new Date(Date.now() - 3600000 * 18),
      isGroupBuy: true,
      groupBuyCode: "GRP-TOKYO-04",
      jpDomesticTrack: "JP-YMT-88291044",
      adminNote: "Hàng đã nhập kho Tokyo an toàn, cân thực tế 0.38kg, đủ điều kiện gộp đơn giảm 25% cước bay.",
    },
    {
      orderCode: "CB-2026-DEMO-103",
      customerName: customerBao.name,
      customerEmail: customerBao.email,
      customerPhone: customerBao.phone || "0912345678",
      customerAddress: customerBao.address || "Thủ Dầu Một, Bình Dương",
      customerId: customerBao.id,
      customerType: "REGISTERED",
      originalUrl: "https://item.rakuten.co.jp/biccamera/4549980652916/",
      productName: "Máy cạo râu Panasonic ES-RT19 Nội Địa Nhật (Lưu ý điện 100V)",
      category: "gadgets",
      priceJpy: 5500,
      weightKg: 0.6,
      exchangeRate: 175,
      productPriceVnd: 962500,
      serviceFeeVnd: 38500,
      shippingFeeVnd: 111000,
      totalVnd: 1112000,
      depositPercent: 100,
      depositAmountVnd: 1112000,
      paymentStatus: "PAID_100",
      paymentMethod: "VIETQR",
      status: "IN_TRANSIT_VN",
      isPriceVerified: true,
      priceVerifiedAt: new Date(Date.now() - 3600000 * 48),
      isGroupBuy: false,
      jpDomesticTrack: "JP-SGW-77412900",
      adminNote: "Đang bay trên chuyến JL752 Narita -> Nội Bài, dự kiến thông quan trong 12 giờ tới.",
    },
    {
      orderCode: "CB-2026-DEMO-104",
      customerName: "Trần Minh Quân (Khách vãng lai)",
      customerEmail: "quantm.guest@gmail.com",
      customerPhone: "0903112233",
      customerAddress: "Số 120 Nguyễn Huệ, Quận 1, TP.HCM",
      customerId: null,
      customerType: "GUEST",
      originalUrl: "https://www.suruga-ya.jp/product/detail/602194821",
      productName: "[Link Sàn Surugaya] Mô hình Gunpla RG 1/144 RX-78-2 Gundam Ver 2.0",
      category: "anime",
      priceJpy: 4800,
      weightKg: 0.7,
      exchangeRate: 175,
      productPriceVnd: 840000,
      serviceFeeVnd: 33600,
      shippingFeeVnd: 129500,
      totalVnd: 1003100,
      depositPercent: 50,
      depositAmountVnd: 436800,
      paymentStatus: "UNPAID",
      paymentMethod: "VIETQR",
      status: "PENDING_DEPOSIT",
      isPriceVerified: false, // Chờ Admin duyệt báo giá link ngoài
      isGroupBuy: false,
      customerNote: "Shop kiểm tra giúp mình web Surugaya có ship nhanh được không nhé.",
      adminNote: "Đơn link ngoài sàn Surugaya — Chờ Admin kiểm tra tồn kho và bấm Duyệt báo giá.",
    },
    {
      orderCode: "CB-2026-DEMO-105",
      customerName: customerLan.name,
      customerEmail: customerLan.email,
      customerPhone: customerLan.phone || "0987654321",
      customerAddress: customerLan.address || "TP. Thủ Đức, TP.HCM",
      customerId: customerLan.id,
      customerType: "REGISTERED",
      originalUrl: "https://www.amazon.co.jp/dp/B08L5V9T32",
      productName: "Combo Kem chống nắng Anessa Gold Milk 60ml & Dầu tẩy trang DHC Deep Cleansing Oil",
      category: "cosmetics",
      priceJpy: 5200,
      weightKg: 0.5,
      exchangeRate: 175,
      productPriceVnd: 910000,
      serviceFeeVnd: 36400,
      shippingFeeVnd: 92500,
      totalVnd: 1038900,
      depositPercent: 100,
      depositAmountVnd: 1038900,
      paymentStatus: "PAID_100",
      paymentMethod: "VNPAY",
      status: "COMPLETED",
      isPriceVerified: true,
      priceVerifiedAt: new Date(Date.now() - 3600000 * 72),
      isGroupBuy: false,
      jpDomesticTrack: "JP-YMT-55192011",
      vnDomesticTrack: "GHN-VN8891204",
      adminNote: "Đơn hoàn tất — Khách đã nhận hàng thành công qua GHN và đánh giá 5 sao.",
    },
  ];

  for (const ord of demoOrders) {
    const savedOrder = await prisma.order.upsert({
      where: { orderCode: ord.orderCode },
      update: {
        status: ord.status,
        paymentStatus: ord.paymentStatus,
        isPriceVerified: ord.isPriceVerified,
        jpDomesticTrack: ord.jpDomesticTrack,
        vnDomesticTrack: ord.vnDomesticTrack,
        adminNote: ord.adminNote,
      },
      create: ord,
    });

    // Thêm OrderItem tương ứng
    const existingItem = await prisma.orderItem.findFirst({ where: { orderId: savedOrder.id } });
    if (!existingItem) {
      await prisma.orderItem.create({
        data: {
          orderId: savedOrder.id,
          productId: catalogProducts[0]?.id || null,
          itemType: "EXTERNAL",
          productName: ord.productName,
          quantity: 1,
          priceJpy: ord.priceJpy,
          weightKg: ord.weightKg,
        },
      });
    }

    // Nếu là đơn hoàn tất CB-2026-DEMO-105, gắn thêm PaymentTransaction VNPAY mẫu
    if (ord.orderCode === "CB-2026-DEMO-105") {
      await prisma.paymentTransaction.upsert({
        where: {
          provider_providerTransactionId: {
            provider: "VNPAY",
            providerTransactionId: "VNPAY-DEMO-14829105",
          },
        },
        update: {},
        create: {
          orderId: savedOrder.id,
          provider: "VNPAY",
          amountVnd: ord.totalVnd,
          status: "CONFIRMED",
          providerTransactionId: "VNPAY-DEMO-14829105",
          reference: "VNPAY-ORDER-105",
          confirmedByAdmin: "system:vnpay",
          confirmedAt: new Date(Date.now() - 3600000 * 70),
        },
      });
    }
  }
  console.log(`   ✅ Đã nạp 5 đơn hàng mua hộ JP ➔ VN (${demoOrders.map((o) => o.orderCode).join(", ")})`);

  // 3. Tạo 5 Vận đơn ký gửi chiều VN -> JP (VnJpShipment) rải đều 5 cột Kanban
  console.log("✈️ [3/5] Đang nạp 5 vận đơn ký gửi chiều VN ➔ JP (VnJpShipment)...");
  const demoShipments = [
    {
      trackingCode: "VNJP-2026-DEMO-0001",
      senderName: "Đỗ Thiên Bảo",
      senderPhone: "0912345678",
      senderAddress: "Số 06 Trần Văn Ơn, Phường Phú Hòa, TP. Thủ Dầu Một",
      senderCity: "Bình Dương",
      pickupDate: "Sáng mai (8h - 12h)",
      receiverName: "NGUYEN VAN AN",
      receiverPhone: "08012345678",
      receiverPostalCode: "160-0022",
      receiverPrefecture: "Tokyo",
      receiverAddress: "Shinjuku-ku, Shinjuku 3-chome, Sakura Mansion 402",
      cargoType: "food",
      cargoDetails: "4 gói cà phê rang xay Trung Nguyên, 3 hộp bánh đậu xanh Hải Dương, 1kg hạt điều rang muối Bình Phước",
      estimatedWeightKg: 3.5,
      unitPricePerKg: 220000,
      totalShippingFeeVnd: 770000,
      maffAgreement: true,
      status: "PENDING_CONFIRMATION",
      paymentStatus: "UNPAID",
      dispatcherNote: "Khách đã quét Neo AI MAFF (100% thực phẩm khô có nhãn mác thương mại, không thịt/trứng).",
    },
    {
      trackingCode: "VNJP-2026-DEMO-0002",
      senderName: "Lê Hoàng Nam",
      senderPhone: "0938112244",
      senderAddress: "Số 45 Lê Lợi, Phường Bến Nghé, Quận 1",
      senderCity: "TP. Hồ Chí Minh",
      pickupDate: "Chiều mai (13h - 17h)",
      receiverName: "LE HOANG MINH",
      receiverPhone: "09099887766",
      receiverPostalCode: "542-0076",
      receiverPrefecture: "Osaka",
      receiverAddress: "Chuo-ku, Namba 2-1-5, Namba Sky Residence 805",
      cargoType: "doc",
      cargoDetails: "1 bộ hồ sơ du học Nhật Bản bản gốc, bằng tốt nghiệp đại học và bảng điểm dịch thuật công chứng",
      estimatedWeightKg: 1.0,
      unitPricePerKg: 210000,
      totalShippingFeeVnd: 210000,
      maffAgreement: true,
      status: "CONFIRMED_PICKUP",
      paymentStatus: "PAID",
      dispatcherNote: "Hồ sơ du học khẩn EMS 48h đi Osaka — Đã hẹn bưu tá qua lấy tận nhà lúc 14h00.",
    },
    {
      trackingCode: "VNJP-2026-DEMO-0003",
      senderName: "Phạm Thị Thu Hà",
      senderPhone: "0977554433",
      senderAddress: "Số 88 Cầu Giấy, Quận Cầu Giấy",
      senderCity: "Hà Nội",
      pickupDate: "Tôi sẽ tự mang qua kho ChillBanana",
      receiverName: "PHAM DUC ANH",
      receiverPhone: "07033445566",
      receiverPostalCode: "460-0008",
      receiverPrefecture: "Aichi",
      receiverAddress: "Nagoya-shi, Naka-ku, Sakae 3-15, Nagoya LeoPalace 203",
      cargoType: "gift",
      cargoDetails: "3 áo khoác phao mùa đông, 2 khăn choàng len, 1 hộp quà lưu niệm gốm sứ",
      estimatedWeightKg: 2.5,
      actualWeightKg: 2.8,
      dimensionLengthCm: 50.0,
      dimensionWidthCm: 40.0,
      dimensionHeightCm: 30.0,
      chargeableWeightKg: 12.0, // Cân thể tích IATA (50x40x30)/5000 = 12.0 kg > 2.8 kg thực tế!
      unitPricePerKg: 180000,
      totalShippingFeeVnd: 2160000,
      maffAgreement: true,
      status: "WAREHOUSE_VN_INSPECTED",
      paymentStatus: "PAID",
      dispatcherNote: "[CN23 EN]: Personal Apparel & Knitted Winter Coats [HS:6110.20]\n[CN23 JP]: 個人用冬物衣類・贈答品\n[Lộ trình]: Cân IATA 12.0kg áp dụng theo chuẩn hàng không quốc tế.",
    },
    {
      trackingCode: "VNJP-2026-DEMO-0004",
      senderName: "Nguyễn Phương Lan",
      senderPhone: "0987654321",
      senderAddress: "Khu đô thị Sala, TP. Thủ Đức",
      senderCity: "TP. Hồ Chí Minh",
      pickupDate: "Sáng mai (8h - 12h)",
      receiverName: "TAKAHASHI KENJI",
      receiverPhone: "08044556677",
      receiverPostalCode: "220-0011",
      receiverPrefecture: "Kanagawa",
      receiverAddress: "Yokohama-shi, Nishi-ku, Takashima 2-19, Yokohama Bay Tower 1204",
      cargoType: "food",
      cargoDetails: "5 hộp trà sen Tây Hồ thượng hạng, 3 gói mít sấy giòn Vinamit hút chân không",
      estimatedWeightKg: 4.0,
      actualWeightKg: 4.5,
      dimensionLengthCm: 40.0,
      dimensionWidthCm: 30.0,
      dimensionHeightCm: 20.0,
      chargeableWeightKg: 4.8, // Cân thể tích (40x30x20)/5000 = 4.8 kg
      unitPricePerKg: 220000,
      totalShippingFeeVnd: 1056000,
      maffAgreement: true,
      status: "IN_FLIGHT_TO_JP",
      paymentStatus: "PAID",
      flightNumber: "VN300 (SGN ➔ NRT)",
      japanCourier: "Yamato Transport (Kuroneko)",
      japanTrackingCode: "YMT-4910-8821-3309",
      dispatcherNote: "[CN23 EN]: Vacuum-Sealed Lotus Tea & Dried Jackfruit [HS:0902.30]\n[CN23 JP]: 高級ハスの茶・乾燥ジャックフルーツ（真空パック済）\n[Lộ trình]: Chuyến bay VN300 SGN-NRT bàn giao kho Yamato Tokyo.",
    },
    {
      trackingCode: "VNJP-2026-DEMO-0005",
      senderName: "Võ Quốc Hưng",
      senderPhone: "0918223344",
      senderAddress: "Số 210 Đại lộ Bình Dương, TP. Thủ Dầu Một",
      senderCity: "Bình Dương",
      pickupDate: "Chiều mai (13h - 17h)",
      receiverName: "VO MINH KHOI",
      receiverPhone: "08066778899",
      receiverPostalCode: "812-0011",
      receiverPrefecture: "Fukuoka",
      receiverAddress: "Fukuoka-shi, Hakata-ku, Hakata Ekimae 3-2, Hakata Mansion 501",
      cargoType: "gift",
      cargoDetails: "2 bộ áo dài truyền thống may đo, 4 cuốn sách chuyên ngành CNTT tiếng Việt",
      estimatedWeightKg: 3.0,
      actualWeightKg: 3.2,
      dimensionLengthCm: 35.0,
      dimensionWidthCm: 25.0,
      dimensionHeightCm: 15.0,
      chargeableWeightKg: 3.2, // Cân thực tế 3.2 kg > Cân thể tích 2.63 kg
      unitPricePerKg: 180000,
      totalShippingFeeVnd: 576000,
      maffAgreement: true,
      status: "DELIVERED_JP",
      paymentStatus: "PAID",
      flightNumber: "VN320 (SGN ➔ KIX)",
      japanCourier: "Sagawa Express",
      japanTrackingCode: "SGW-7712-9901-4412",
      dispatcherNote: "[CN23 EN]: Traditional Silk Ao Dai & IT Reference Books [HS:6204.49]\n[CN23 JP]: ベトナム伝統衣装・IT専門書籍（無償贈答品）\n[Lộ trình]: Đã giao thành công tận tay người nhận tại Hakata, Fukuoka (Sagawa ký nhận).",
    },
  ];

  for (const shp of demoShipments) {
    await prisma.vnJpShipment.upsert({
      where: { trackingCode: shp.trackingCode },
      update: {
        status: shp.status,
        paymentStatus: shp.paymentStatus,
        actualWeightKg: shp.actualWeightKg,
        dimensionLengthCm: shp.dimensionLengthCm,
        dimensionWidthCm: shp.dimensionWidthCm,
        dimensionHeightCm: shp.dimensionHeightCm,
        chargeableWeightKg: shp.chargeableWeightKg,
        totalShippingFeeVnd: shp.totalShippingFeeVnd,
        flightNumber: shp.flightNumber,
        japanCourier: shp.japanCourier,
        japanTrackingCode: shp.japanTrackingCode,
        dispatcherNote: shp.dispatcherNote,
      },
      create: shp,
    });
  }
  console.log(`   ✅ Đã nạp 5 vận đơn ký gửi VN ➔ JP (${demoShipments.map((s) => s.trackingCode).join(", ")})`);

  // 4. Tạo 2 Phiên tư vấn AI mẫu (ChatSession - CHAT_LEAD)
  console.log("💬 [4/5] Đang tạo 2 phiên ChatSession tư vấn (AI Lead)...");

  // Phiên 1: Lead Gửi Hàng Đi Nhật
  const session1 = await prisma.chatSession.upsert({
    where: { sessionId: "demo-session-vn-jp-lead-01" },
    update: {
      topic: "Vận chuyển VN -> Nhật",
      detectedKeywords: "gửi hàng vn -> nhật, tuyến vn-jp, thực phẩm khô maff, tokyo",
      customerType: "CHAT_LEAD",
      customerName: "Hoàng Gia Huy (Lead Gửi Hàng Đi Nhật)",
      customerPhone: "0945678910",
      customerEmail: "huy.hoang.lead@gmail.com",
    },
    create: {
      sessionId: "demo-session-vn-jp-lead-01",
      personality: "omotenashi",
      customerType: "CHAT_LEAD",
      customerName: "Hoàng Gia Huy (Lead Gửi Hàng Đi Nhật)",
      customerPhone: "0945678910",
      customerEmail: "huy.hoang.lead@gmail.com",
      topic: "Vận chuyển VN -> Nhật",
      detectedKeywords: "gửi hàng vn -> nhật, tuyến vn-jp, thực phẩm khô maff, tokyo",
      sentiment: "inquiry",
    },
  });

  // Xóa tin nhắn cũ của session1 nếu có và tạo lại
  await prisma.chatMessage.deleteMany({ where: { sessionId: session1.sessionId } });
  await prisma.chatMessage.createMany({
    data: [
      {
        sessionId: session1.sessionId,
        role: "user",
        content: "Chào shop, mình muốn gửi 4kg thực phẩm khô (cà phê rang xay, bánh đậu xanh, hạt điều) sang Tokyo cho người nhà thì cước tính thế nào và có bị cấm không ạ? SĐT mình 0945678910.",
        categoryTag: "vn-jp-shipping",
      },
      {
        sessionId: session1.sessionId,
        role: "assistant",
        content: "Dạ ChillBanana xin chào anh Huy! Tuyến hàng không chuyên biệt VN ➔ JP của bên em nhận gửi thực phẩm khô có nhãn mác thương mại và hút chân không kín ạ. Hệ thống Neo AI kiểm soát kiểm dịch MAFF nghiêm ngặt, cam kết 100% không giữ hàng tại sân bay Narita. Cước hàng thực phẩm là 220.000đ/kg. Bưu tá có thể qua lấy tận nơi và giao tận tay qua Yamato tại Tokyo trong 3-5 ngày làm việc ạ!",
        categoryTag: "vn-jp-shipping",
      },
      {
        sessionId: session1.sessionId,
        role: "user",
        content: "Tuyệt vời quá, để mình đóng gói rồi tạo đơn trên web nhé!",
        categoryTag: "vn-jp-shipping",
      },
    ],
  });

  // Phiên 2: Lead Mua Hộ Hàng Nhật
  const session2 = await prisma.chatSession.upsert({
    where: { sessionId: "demo-session-jp-vn-lead-02" },
    update: {
      topic: "Mua hộ hàng Nhật",
      detectedKeywords: "mua hộ nhật, mercari figure, luffy gear 5, cước bay, tỷ giá yên",
      customerType: "CHAT_LEAD",
      customerName: "Phan Hải Yến (Lead Mua Hộ Hàng Nhật)",
      customerPhone: "0933221100",
      customerEmail: "haiyen.phan@gmail.com",
    },
    create: {
      sessionId: "demo-session-jp-vn-lead-02",
      personality: "omotenashi",
      customerType: "CHAT_LEAD",
      customerName: "Phan Hải Yến (Lead Mua Hộ Hàng Nhật)",
      customerPhone: "0933221100",
      customerEmail: "haiyen.phan@gmail.com",
      topic: "Mua hộ hàng Nhật",
      detectedKeywords: "mua hộ nhật, mercari figure, luffy gear 5, cước bay, tỷ giá yên",
      sentiment: "positive",
    },
  });

  await prisma.chatMessage.deleteMany({ where: { sessionId: session2.sessionId } });
  await prisma.chatMessage.createMany({
    data: [
      {
        sessionId: session2.sessionId,
        role: "user",
        content: "Shop ơi, mình muốn đặt mô hình Luffy Gear 5 trên Mercari giá tầm 7.000 Yên, bên mình tính tỷ giá và phí mua hộ ra sao vậy? Zalo mình 0933221100.",
        categoryTag: "purchasing",
      },
      {
        sessionId: session2.sessionId,
        role: "assistant",
        content: "Dạ chào chị Hải Yến! Phí mua hộ sàn Mercari bên em hiện chỉ 4% giá trị hàng, tỷ giá yên áp dụng sát thị trường. Kiện hàng dưới 0.5kg còn được giảm 25% cước bay quốc tế khi chị chọn Gộp đơn tiết kiệm ạ. Chị chỉ cần dán link sản phẩm vào công cụ Báo giá là hệ thống tính trọn gói không phát sinh phụ phí ạ!",
        categoryTag: "purchasing",
      },
    ],
  });

  console.log("   ✅ Đã tạo 2 phiên ChatSession tư vấn (Lead VN-JP & Lead JP-VN)");

  // 5. Tạo các bản ghi Nhật ký Kiểm toán mẫu (AuditLog)
  console.log("📝 [5/5] Đang tạo các bản ghi AuditLog mẫu...");
  const sampleLogs = [
    {
      actor: "admin",
      actorType: "ADMIN",
      action: "VN_JP_SHIPMENT_STATUS_CHANGED",
      entityType: "VnJpShipment",
      entityId: "VNJP-2026-DEMO-0004",
      summary: "Cập nhật vận đơn #VNJP-2026-DEMO-0004: WAREHOUSE_VN_INSPECTED -> IN_FLIGHT_TO_JP (Chuyến bay VN300 SGN->NRT, Cân IATA: 4.8 kg)",
      ip: "127.0.0.1",
    },
    {
      actor: "admin",
      actorType: "ADMIN",
      action: "VN_JP_SHIPMENT_PAID_CONFIRMED",
      entityType: "VnJpShipment",
      entityId: "VNJP-2026-DEMO-0003",
      summary: "Admin xác nhận thu cước vận đơn #VNJP-2026-DEMO-0003: 2.160.000 VND (Cân thể tích IATA 12.0 kg)",
      ip: "127.0.0.1",
    },
    {
      actor: "admin",
      actorType: "ADMIN",
      action: "ORDER_PRICE_VERIFIED",
      entityType: "Order",
      entityId: "CB-2026-DEMO-103",
      summary: "Admin duyệt giá đơn hàng #CB-2026-DEMO-103 (Máy cạo râu Panasonic ES-RT19): 1.112.000 VND",
      ip: "127.0.0.1",
    },
    {
      actor: "admin",
      actorType: "ADMIN",
      action: "ADMIN_LOGIN",
      summary: "Đăng nhập quản trị thành công qua phiên bảo mật (SUPER_ADMIN).",
      ip: "127.0.0.1",
    },
  ];

  for (const log of sampleLogs) {
    await prisma.auditLog.create({ data: log });
  }
  console.log(`   ✅ Đã nạp ${sampleLogs.length} bản ghi nhật ký kiểm toán AuditLog.`);

  console.log("\n🎉 HOÀN TẤT NẠP DỮ LIỆU MẪU SHOWCASE!");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi seed dữ liệu demo:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
