const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const npmCli = process.env.npm_execpath;
const isProductionDeployment =
  process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";

function runNpm(args) {
  const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmCli ? [npmCli, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
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
  runNpm(["run", "prisma:migrate:deploy"]);
} else {
  console.log("Skipping database migration outside a Vercel production deployment.");
}

runNpm(["run", "build"]);
