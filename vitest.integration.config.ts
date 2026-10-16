import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Integration test: gọi trực tiếp route handler với PostgreSQL thật (CI dùng service container).
// An toàn: tests/setup/integration-setup.ts từ chối chạy nếu DATABASE_URL không trỏ về máy cục bộ.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/integration-setup.ts"],
    pool: "forks",
    fileParallelism: false, // các file dùng chung một database
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
