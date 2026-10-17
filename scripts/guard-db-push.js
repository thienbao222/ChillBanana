// `prisma db push` chỉ dành cho database development dùng một mình.
// Script này chặn chạy nhầm trên production và buộc người chạy xác nhận rõ ràng.
const { spawnSync } = require("node:child_process");

const env = process.env;
if (env.VERCEL_ENV === "production" || env.APP_ENV === "production" || env.NODE_ENV === "production") {
  console.error("❌ Từ chối chạy `prisma db push` trong môi trường production. Hãy dùng migration (docs/DATABASE_MIGRATIONS.md).");
  process.exit(1);
}
if (env.ALLOW_DB_PUSH !== "1") {
  console.error(
    "❌ `prisma db push` có thể làm mất dữ liệu khi schema thay đổi.\n" +
      "   Chỉ chạy trên database development RIÊNG của bạn, bằng cách đặt ALLOW_DB_PUSH=1.\n" +
      "   Với staging/production hãy dùng `npm run prisma:migrate:deploy`."
  );
  process.exit(1);
}
const extra = process.argv.slice(2);
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npx, ["prisma", "db", "push", ...extra], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
