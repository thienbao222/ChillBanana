import { PrismaClient } from "@prisma/client";

export interface SimulationSummary {
  ordersCreated: number;
  transactionsCreated: number;
  costLinesCreated: number;
  campaignsCreated: number;
  vnJpShipmentsCreated: number;
}

/**
 * Sinh dữ liệu mô phỏng 3 tháng cố định cho môi trường dev/demo (WP7.2).
 */
export async function generateSimulationDataset(
  prismaClient: any,
  totalOrders = 300
): Promise<SimulationSummary> {
  const statuses = [
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "LOCAL_DELIVERY",
    "WAREHOUSE_VN",
    "IN_TRANSIT_AIR",
    "PURCHASING_JP",
    "PENDING_DEPOSIT",
    "CANCELLED",
  ];

  const categories = ["cosmetics", "health", "gadgets", "anime", "fashion", "food"];
  const sources = ["CATALOG", "API_RAKUTEN", "API_YAHOO", "EXTENSION", "SCRAPE", "MANUAL"];

  let ordersCount = 0;
  let txsCount = 0;
  let costsCount = 0;

  // 1. Tạo chiến dịch gom đơn mẫu
  let campaign = await prismaClient.campaign.findFirst({ where: { slug: "campaign-tokyo-autumn-2026" } });
  if (!campaign) {
    campaign = await prismaClient.campaign.create({
      data: {
        slug: "campaign-tokyo-autumn-2026",
        title: "Chiến dịch Mua Chung Thu Đông Tokyo 2026",
        description: "Gom đơn hàng gia dụng & mỹ phẩm nội địa Nhật Bản cước ưu đãi.",
        marketplace: "RAKUTEN",
        status: "OPEN",
        minParticipants: 5,
        maxSlots: 50,
        opensAt: new Date(Date.now() - 7 * 86400 * 1000),
        closesAt: new Date(Date.now() + 14 * 86400 * 1000),
        createdBy: "admin",
        campaignItems: {
          create: [
            {
              name: "Nồi cơm điện cao tần Zojirushi IH 1.0L",
              priceJpy: 18500,
              weightKg: 4.2,
              maxSlots: 20,
            },
            {
              name: "Bộ dưỡng da Hada Labo Premium Gokujyun",
              priceJpy: 2200,
              weightKg: 0.45,
              maxSlots: 30,
            },
          ],
        },
      },
      include: { campaignItems: true },
    });
  }

  // 2. Tạo danh sách ~300 đơn hàng trải đều 3 tháng gần nhất
  const now = Date.now();
  const ninetyDaysMs = 90 * 86400 * 1000;

  for (let i = 1; i <= totalOrders; i++) {
    const ageMs = Math.floor((i / totalOrders) * ninetyDaysMs);
    const createdAt = new Date(now - ageMs);

    const status = statuses[i % statuses.length];
    const category = categories[i % categories.length];
    const quoteSource = sources[i % sources.length];
    const priceJpy = 1000 + (i * 137) % 25000;
    const weightKg = Math.round((0.2 + (i * 0.17) % 4.5) * 100) / 100;
    const rate = 172;

    const productPriceVnd = priceJpy * rate;
    const serviceFeeVnd = Math.max(20000, Math.round(productPriceVnd * 0.04));
    const shippingFeeVnd = Math.round(weightKg * 185000);
    const totalVnd = productPriceVnd + serviceFeeVnd + shippingFeeVnd;

    const isPaid = status === "COMPLETED" || status === "LOCAL_DELIVERY";
    const isDeposited = isPaid || status === "WAREHOUSE_VN" || status === "IN_TRANSIT_AIR" || status === "PURCHASING_JP";
    const depositPercent = totalVnd < 1000000 ? 100 : (totalVnd <= 10000000 ? 70 : 50);
    const depositAmountVnd = Math.round(totalVnd * (depositPercent / 100));

    const paymentStatus = isPaid
      ? "PAID_100"
      : isDeposited
      ? (depositPercent === 70 ? "DEPOSITED_70" : "DEPOSITED_50")
      : status === "CANCELLED"
      ? "REFUNDED"
      : "UNPAID";

    const orderCode = `SIM-${createdAt.getFullYear()}-${String(i).padStart(4, "0")}`;

    const order = await prismaClient.order.create({
      data: {
        orderCode,
        customerName: `Khách hàng Mô phỏng #${i}`,
        customerEmail: `sim_customer_${i}@chillbanana.vn`,
        customerPhone: `09${String(10000000 + i).slice(0, 8)}`,
        customerAddress: `Số ${i} đường Mô Phỏng, Quận Cầu Giấy, Hà Nội`,
        productName: `Sản phẩm Nhật Bản #${i} (${category})`,
        category,
        priceJpy,
        weightKg,
        exchangeRate: rate,
        productPriceVnd,
        serviceFeeVnd,
        shippingFeeVnd,
        totalVnd,
        depositAmountVnd,
        depositPercent,
        paymentStatus,
        status,
        isPriceVerified: quoteSource === "CATALOG",
        priceVerifiedAt: quoteSource === "CATALOG" ? createdAt : null,
        createdAt,
        updatedAt: createdAt,
        orderItems: {
          create: [
            {
              itemType: quoteSource === "CATALOG" ? "CATALOG" : "EXTERNAL",
              productName: `Sản phẩm #${i}`,
              quantity: 1,
              priceJpy,
              weightKg,
              quoteSource,
              quoteVerifiedAt: quoteSource === "CATALOG" ? createdAt : null,
              quoteVerifiedBy: quoteSource === "CATALOG" ? "SYSTEM" : null,
            },
          ],
        },
      },
    });
    ordersCount++;

    // 3. Tạo bản ghi thanh toán
    if (isDeposited || isPaid) {
      const depositTx = await prismaClient.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider: "VNPAY",
          amountVnd: depositAmountVnd,
          status: "CONFIRMED",
          kind: "DEPOSIT",
          confirmedByAdmin: "SYSTEM_SIM",
          createdAt,
        },
      });
      txsCount++;

      if (isPaid && depositAmountVnd < totalVnd) {
        await prismaClient.paymentTransaction.create({
          data: {
            orderId: order.id,
            provider: "MANUAL_BANK_TRANSFER",
            amountVnd: totalVnd - depositAmountVnd,
            status: "CONFIRMED",
            kind: "BALANCE",
            confirmedByAdmin: "SYSTEM_SIM",
            createdAt,
          },
        });
        txsCount++;
      }
    } else if (status === "CANCELLED") {
      // Đơn hủy tạo bản ghi cọc rồi tạo đảo (REVERSAL)
      const origTx = await prismaClient.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider: "VNPAY",
          amountVnd: depositAmountVnd,
          status: "VOIDED",
          voidedAt: createdAt,
          kind: "DEPOSIT",
          confirmedByAdmin: "SYSTEM_SIM",
          createdAt,
        },
      });
      txsCount++;

      await prismaClient.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider: "VNPAY",
          amountVnd: -depositAmountVnd,
          status: "CONFIRMED",
          kind: "REVERSAL",
          reversalOfId: origTx.id,
          note: "Hoàn tiền do hủy đơn",
          confirmedByAdmin: "SYSTEM_SIM",
          createdAt,
        },
      });
      txsCount++;
    }

    // 4. Tạo chi phí thực tế cho các đơn đã mua hàng / hoàn tất
    if (isPaid || status === "WAREHOUSE_VN" || status === "IN_TRANSIT_AIR") {
      const actualGoodsVnd = Math.round(priceJpy * rate * 0.98); // Giá mua thực tế
      const actualFreightVnd = Math.round(weightKg * 130000);   // Cước bay thực 130k/kg

      await prismaClient.orderCostLine.createMany({
        data: [
          {
            orderId: order.id,
            category: "GOODS_JPY",
            amountOriginal: priceJpy,
            currency: "JPY",
            amountVnd: actualGoodsVnd,
            note: "Tiền mua hàng sàn Nhật",
            createdBy: "purchaser",
            createdAt,
          },
          {
            orderId: order.id,
            category: "INTL_FREIGHT",
            amountOriginal: actualFreightVnd,
            currency: "VND",
            amountVnd: actualFreightVnd,
            note: "Cước bay quốc tế Tokyo -> Nội Bài",
            createdBy: "warehouse",
            createdAt,
          },
        ],
      });
      costsCount += 2;
    }
  }

  // 5. Tạo 5 phiếu vận chuyển VN -> JP mẫu
  let vnJpCount = 0;
  for (let s = 1; s <= 5; s++) {
    const trackingCode = `VNJP-2026-SIM-${String(1000 + s)}`;
    const weight = 1.5 + s * 0.5;
    const unitPrice = 180000;
    const fee = Math.round(weight * unitPrice);

    await prismaClient.vnJpShipment.create({
      data: {
        trackingCode,
        senderName: `Người gửi VN #${s}`,
        senderPhone: `098111223${s}`,
        senderAddress: `Số ${s} Tràng Thi, Hoàn Kiếm, Hà Nội`,
        senderCity: "Hà Nội",
        receiverName: `YAMADA TARO ${s}`,
        receiverPhone: `0801234567${s}`,
        receiverPostalCode: `160-002${s}`,
        receiverPrefecture: "Tokyo",
        receiverAddress: `Shinjuku-ku, Nishi-Shinjuku 2-${s}`,
        cargoType: "gift",
        cargoDetails: "Cà phê G7, bánh đậu xanh, quà lưu niệm",
        estimatedWeightKg: weight,
        chargeableWeightKg: weight,
        unitPricePerKg: unitPrice,
        totalShippingFeeVnd: fee,
        status: s <= 2 ? "DELIVERED_JP" : "IN_FLIGHT_TO_JP",
        maffAgreement: true,
        maffAcknowledgedAt: new Date(),
        consentAt: new Date(),
        consentVersion: "v1.0",
      },
    });
    vnJpCount++;
  }

  return {
    ordersCreated: ordersCount,
    transactionsCreated: txsCount,
    costLinesCreated: costsCount,
    campaignsCreated: 1,
    vnJpShipmentsCreated: vnJpCount,
  };
}

// Chạy trực tiếp qua CLI
async function main() {
  const env = process.env.APP_ENV || "development";
  if (env === "production" || process.env.NODE_ENV === "production") {
    console.error("❌ TUYỆT ĐỐI KHÔNG CHẠY seed-simulation trên môi trường PRODUCTION!");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  console.log(`🌱 Đang sinh dữ liệu mô phỏng 3 tháng trên môi trường [${env}]...`);

  try {
    const summary = await generateSimulationDataset(prisma, 300);
    console.log("✅ Hoàn tất sinh dữ liệu mô phỏng:");
    console.log(`   - Đơn hàng tạo mới: ${summary.ordersCreated}`);
    console.log(`   - Giao dịch thanh toán: ${summary.transactionsCreated}`);
    console.log(`   - Dòng chi phí thực: ${summary.costLinesCreated}`);
    console.log(`   - Chiến dịch gom hàng: ${summary.campaignsCreated}`);
    console.log(`   - Phiếu gửi VN → JP: ${summary.vnJpShipmentsCreated}`);
  } catch (err) {
    console.error("❌ Lỗi khi sinh dữ liệu:", err);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

