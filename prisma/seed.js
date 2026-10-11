const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const curatedProducts = require("../src/lib/curated-products.json");

const prisma = new PrismaClient();
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;

function hashPassword(password) {
  if (!SESSION_SECRET) {
    throw new Error("ADMIN_SESSION_SECRET phải được đặt trước khi tạo tài khoản quản trị.");
  }
  return crypto.createHmac("sha256", SESSION_SECRET).update(password).digest("hex");
}

async function main() {
  console.log("🌱 Bắt đầu khởi tạo dữ liệu mẫu cho ChillBanana (Prisma + Neon Postgres)...");

  // 1. Tạo tài khoản Admin mặc định
  // SECURITY: Set ADMIN_INITIAL_PASSWORD env var before running seed.
  // After seeding, change password via admin panel or DB directly.
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminPassword) {
    console.error("❌ ADMIN_INITIAL_PASSWORD env var chưa được đặt! Bỏ qua tạo admin.");
    console.error("   Chạy: ADMIN_INITIAL_PASSWORD=your_secure_password npx prisma db seed");
  } else {
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
    console.log(`✅ Đã tạo/cập nhật tài khoản quản trị: ${admin.username}`);
  }

  // Keep the demo catalog and database catalog in sync so displayed products
  // always have matching product IDs during checkout.
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

main()
  .catch((e) => {
    console.error("Lỗi seed dữ liệu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
