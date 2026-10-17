/**
 * prisma/seed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seed dữ liệu khởi tạo cho SystemConfig (CommonJS, chạy trực tiếp bằng node).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const systemConfigSeed = [
  {
    key: "service_fee_percent",
    value: "4",
    description: "Tỷ lệ phí mua hộ (%). Ví dụ: 4 = 4%. Tối đa 20%.",
  },
  {
    key: "min_service_fee_vnd",
    value: "20000",
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
  console.log("🌱 Bắt đầu seed SystemConfig...");

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
    console.log(`  ✅ ${config.key} = ${config.value}`);
  }

  console.log(`\n🎉 Seed hoàn tất! ${systemConfigSeed.length} cấu hình đã được khởi tạo.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed thất bại:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
