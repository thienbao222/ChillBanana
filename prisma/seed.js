const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("./hash-password");
const curatedProducts = require("../src/lib/curated-products.json");
const kizunaNews = require("../src/lib/kizuna-news.json");

const prisma = new PrismaClient();

const systemConfigSeed = [
  {
    key: "service_fee_percent",
    value: "4",
    description: "Tỷ lệ phí mua hộ (%). Ví dụ: 4 = 4%. Tối đa 20%.",
  },
  {
    key: "min_service_fee_vnd",
    value: "50000",
    description: "Phí mua hộ tối thiểu (VND) áp dụng khi % tính ra thấp hơn mức này.",
  },
  {
    key: "air_shipping_per_kg_vnd",
    value: "185000",
    description: "Cước hàng không quốc tế Nhật→Việt mỗi kg (VND).",
  },
  {
    key: "group_buy_discount_percent",
    value: "25",
    description: "Mức giảm cước gộp đơn nhóm (%) cho đơn ≤ 0.5kg. Ví dụ: 25 = giảm 25%.",
  },
  {
    key: "floor_exchange_rate_jpy",
    value: "172",
    description: "Tỷ giá sàn an toàn JPY/VND. Dùng khi API tỷ giá trả về giá thấp hơn mức này.",
  },
  {
    key: "min_order_threshold_vnd",
    value: "300000",
    description: "Giá trị đơn hàng tối thiểu (VND) để chấp nhận đặt đơn.",
  },
];

async function main() {
  console.log("🌱 Bắt đầu khởi tạo dữ liệu mẫu cho ChillBanana (Prisma + Neon Postgres)...");

  // 1. Tạo tài khoản Admin mặc định nếu chưa tồn tại
  const existingAdmin = await prisma.adminUser.findUnique({ where: { username: "admin" } });
  if (!existingAdmin) {
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (!adminPassword || adminPassword.trim().length < 6) {
      console.error(
        "\n❌ [SEED ERROR] Thiếu biến môi trường ADMIN_INITIAL_PASSWORD (tối thiểu 6 ký tự).\n" +
          "Để bảo mật, hệ thống không còn dùng mật khẩu mặc định.\n" +
          "Vui lòng thiết lập ADMIN_INITIAL_PASSWORD trong file .env hoặc command line trước khi chạy seed:\n" +
          "  Windows: $env:ADMIN_INITIAL_PASSWORD='MatKhauCuaBan'; npm run prisma:seed\n" +
          "  Linux/macOS: ADMIN_INITIAL_PASSWORD='MatKhauCuaBan' npm run prisma:seed\n"
      );
      process.exit(1);
    }
    const adminHash = hashPassword(adminPassword);
    const admin = await prisma.adminUser.create({
      data: {
        username: "admin",
        passwordHash: adminHash,
        name: "Quản Trị Viên ChillBanana",
        role: "SUPER_ADMIN",
      },
    });
    console.log(`✅ Đã tạo tài khoản quản trị: ${admin.username} (mật khẩu đã cấu hình từ biến môi trường)`);
  } else {
    console.log(`ℹ️ Tài khoản admin đã tồn tại trong CSDL: ${existingAdmin.username}`);
  }

  // 2. Đồng bộ sản phẩm catalog
  if (Array.isArray(curatedProducts)) {
    for (const product of curatedProducts) {
      const { stockSlots, ...catalogDetails } = product;
      await prisma.product.upsert({
        where: { slug: product.slug },
        update: catalogDetails,
        create: product,
      });
    }
    console.log(`✅ Đã đồng bộ ${curatedProducts.length} sản phẩm trong catalog.`);
  }

  // 3. Khởi tạo cấu hình hệ thống SystemConfig
  for (const config of systemConfigSeed) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {
        description: config.description,
      },
      create: {
        key: config.key,
        value: config.value,
        description: config.description,
        updatedBy: "system:seed",
      },
    });
  }
  console.log(`✅ Đã khởi tạo ${systemConfigSeed.length} cấu hình SystemConfig.`);

  // 4. Khởi tạo cấu hình bảng giá PricingConfig v1 nếu bảng trống
  const pricingConfigCount = await prisma.pricingConfig.count();
  if (pricingConfigCount === 0) {
    const defaultPricingConfig = {
      serviceFeePercent: 4,
      serviceFeeMinimumVnd: 50000,
      airShippingPerKgVnd: 185000,
      groupBuyShippingDiscountPercent: 25,
      groupBuyMaxWeightKg: 0.5,
      minimumBaseOrderVnd: 300000,
      fallbackJpyVndRate: 175,
      usdVndReferenceRate: 25400,
      fxSpreadPercent: 0,
    };
    await prisma.pricingConfig.create({
      data: {
        version: 1,
        values: defaultPricingConfig,
        changedBy: "system:seed",
        changeReason: "Khởi tạo bảng giá chuẩn mặc định v1",
      },
    });
    console.log("✅ Đã khởi tạo cấu hình bảng giá PricingConfig v1.");
  }

  // 5. Đồng bộ cẩm nang & bản tin Kizuna News
  if (Array.isArray(kizunaNews)) {
    for (const item of kizunaNews) {
      await prisma.news.upsert({
        where: { slug: item.slug },
        update: {
          title: item.title,
          category: item.category,
          categoryName: item.categoryName,
          excerpt: item.excerpt,
          content: item.content,
          coverImage: item.coverImage,
          readTime: item.readTime,
          publishedAt: new Date(item.publishedAt),
        },
        create: {
          id: item.id,
          title: item.title,
          slug: item.slug,
          category: item.category,
          categoryName: item.categoryName,
          excerpt: item.excerpt,
          content: item.content,
          coverImage: item.coverImage,
          readTime: item.readTime,
          publishedAt: new Date(item.publishedAt),
        },
      });
    }
    console.log(`✅ Đã đồng bộ ${kizunaNews.length} bài viết cẩm nang Kizuna News.`);
  }

  console.log("🎉 Seed hoàn tất!");
}

main()
  .catch((e) => {
    console.error("Lỗi seed dữ liệu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
