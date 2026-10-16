import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit test: thuần logic, không cần database.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/features/**/*.ts", "src/lib/**/*.ts"],
      reporter: ["text-summary", "json-summary"],
    },
  },
});
