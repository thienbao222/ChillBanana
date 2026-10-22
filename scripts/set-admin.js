// scripts/set-admin.js
// Tiện ích tạo mới hoặc đặt lại mật khẩu tài khoản Admin cho ChillBanana.
// Cách dùng:
//   node scripts/set-admin.js [username] [password]
//   Ví dụ: node scripts/set-admin.js admin ChillBanana@2026

const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../prisma/hash-password");

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const username = (args[0] || "admin").trim().toLowerCase();
  const password = args[1] || "Admin@2026";
  const role = "SUPER_ADMIN";
  const name = "Quản Trị Viên ChillBanana";

  if (password.length < 6) {
    console.error("❌ Mật khẩu phải có độ dài tối thiểu 6 ký tự.");
    process.exit(1);
  }

  console.log(`⏳ Đang thiết lập tài khoản admin "${username}"...`);

  const passwordHash = hashPassword(password);

  const admin = await prisma.adminUser.upsert({
    where: { username },
    update: {
      passwordHash,
      role,
    },
    create: {
      username,
      passwordHash,
      name,
      role,
    },
  });

  console.log("--------------------------------------------------");
  console.log("✅ THÀNH CÔNG! ĐÃ TẠO / ĐẶT LẠI MẬT KHẨU ADMIN:");
  console.log(`👉 Tên đăng nhập (Username): ${admin.username}`);
  console.log(`👉 Mật khẩu (Password):       ${password}`);
  console.log(`👉 Quyền hạn (Role):          ${admin.role}`);
  console.log("--------------------------------------------------");
  console.log("🌐 Bạn có thể truy cập ngay: http://localhost:3000/admin");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi thiết lập tài khoản admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
