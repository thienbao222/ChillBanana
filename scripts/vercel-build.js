const { spawnSync } = require("node:child_process");

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}
const fs = require("node:fs");
const path = require("node:path");

const npmCli = process.env.npm_execpath;
const isProductionDeployment =
  process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";

function runNpm(args, extraEnv = {}) {
  const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmCli ? [npmCli, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: !npmCli && process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (isProductionDeployment) {
  // Production chỉ được áp dụng migration đã commit (prisma migrate deploy).
  // Tuyệt đối KHÔNG dùng `prisma db push` ở đây: nó có thể xóa cột/bảng khi schema đổi.
  const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");
  const baseline = path.join(migrationsDir, "0_init", "migration.sql");
  if (!fs.existsSync(baseline)) {
    console.error(
      "\n[vercel-build] TỪ CHỐI deploy production: chưa có baseline migration (prisma/migrations/0_init).\n" +
        "Hãy làm theo docs/DATABASE_MIGRATIONS.md (tạo baseline và đánh dấu đã áp dụng trên database production) rồi deploy lại.\n"
    );
    process.exit(1);
  }

  // Prisma Migrate dùng khóa advisory nên cần kết nối TRỰC TIẾP tới PostgreSQL.
  // Chuỗi kết nối "pooler" của Neon (host chứa "-pooler") có thể làm migrate bị treo hoặc lỗi.
  // Ứng dụng vẫn dùng DATABASE_URL (pooler); riêng bước migrate dùng DIRECT_URL nếu có.
  const direct = process.env.DIRECT_URL;
  const databaseUrl = direct || process.env.DATABASE_URL || "";
  if (!direct && /-pooler\./.test(databaseUrl)) {
    console.error(
      "\n[vercel-build] TỪ CHỐI deploy production: DATABASE_URL là chuỗi kết nối pooler của Neon (host có \"-pooler\").\n" +
        "Hãy thêm biến môi trường DIRECT_URL (chuỗi kết nối TRỰC TIẾP, host không có \"-pooler\") trên Vercel cho môi trường Production\n" +
        "rồi deploy lại. Xem docs/DATABASE_MIGRATIONS.md.\n"
    );
    process.exit(1);
  }
  const migrationEnv = databaseUrl ? { DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl } : {};

  // Dọn dẹp advisory lock treo (nếu có từ phiên trước) để tránh lỗi P1002 timeout
  const clearLockScript = path.join(__dirname, "clear-advisory-lock.js");
  if (fs.existsSync(clearLockScript)) {
    spawnSync(process.execPath, [clearLockScript], {
      env: { ...process.env, ...migrationEnv },
      stdio: "ignore",
    });
  }

  runNpm(["run", "prisma:migrate:deploy"], migrationEnv);
  runNpm(["run", "prisma:seed"], migrationEnv);
} else {
  console.log("Skipping database migration outside a Vercel production deployment.");
}

runNpm(["run", "build"]);
