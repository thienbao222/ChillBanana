// scripts/set-admin.js
// Tiện ích tạo mới hoặc đặt lại mật khẩu tài khoản Admin cho ChillBanana.
// Cách dùng:
//   node scripts/set-admin.js [username] [password]
//   Ví dụ: node scripts/set-admin.js admin MatKhauBaoMat123
//   Hoặc truyền qua biến môi trường: ADMIN_INITIAL_PASSWORD

const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../prisma/hash-password");

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const username = (args[0] || "admin").trim().toLowerCase();
  const password = args[1] || process.env.ADMIN_INITIAL_PASSWORD;
  const role = "SUPER_ADMIN";
  const name = "Quản Trị Viên ChillBanana";

  if (!password || password.length < 6) {
    console.error(
      "\n❌ [ERROR] Thiếu mật khẩu quản trị hoặc mật khẩu dưới 6 ký tự.\n" +
        "Để bảo mật, hệ thống không còn dùng mật khẩu mặc định.\n" +
        "Cách dùng:\n" +
        "  node scripts/set-admin.js <username> <password>\n" +
        "Hoặc đặt biến môi trường ADMIN_INITIAL_PASSWORD:\n" +
        "  $env:ADMIN_INITIAL_PASSWORD='MatKhau'; node scripts/set-admin.js <username>\n"
    );
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
