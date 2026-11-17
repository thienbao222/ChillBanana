import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { hasRequiredRole, AdminRole } from "@/lib/admin-guard";

const ADMIN_API_DIR = path.join(process.cwd(), "src", "app", "api", "admin");

// Danh sách các route công khai phục vụ cơ chế đăng nhập / CSRF
const PUBLIC_WHITELIST = [
  path.normalize("src/app/api/admin/auth/route.ts"),
  path.normalize("src/app/api/admin/csrf/route.ts"),
];

function getAllAdminRoutes(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllAdminRoutes(fullPath));
    } else if (entry.isFile() && entry.name === "route.ts") {
      results.push(fullPath);
    }
  }
  return results;
}

describe("WP7.1 — Phân Quyền Theo Vai (RBAC) & Test Kiểm Kê Toàn Bộ Route Admin", () => {
  describe("Test Kiểm Kê: 100% Route Admin Bắt Buộc Được Bảo Vệ", () => {
    it("mọi route.ts dưới src/app/api/admin (trừ whitelist) đều phải gọi requireAdmin hoặc requireRole", () => {
      const allRoutes = getAllAdminRoutes(ADMIN_API_DIR);
      expect(allRoutes.length).toBeGreaterThan(15); // Có ít nhất 20-30 routes admin

      const unverifiedRoutes: string[] = [];

      for (const routePath of allRoutes) {
        const relativePath = path.normalize(path.relative(process.cwd(), routePath));

        if (PUBLIC_WHITELIST.includes(relativePath)) {
          continue;
        }

        const content = fs.readFileSync(routePath, "utf8");
        const hasGuard = content.includes("requireAdmin") || content.includes("requireRole");

        if (!hasGuard) {
          unverifiedRoutes.push(relativePath);
        }
      }

      expect(
        unverifiedRoutes,
        `Phát hiện các route admin KHÔNG có cơ chế bảo vệ kiểm tra quyền: ${unverifiedRoutes.join(", ")}`
      ).toEqual([]);
    });
  });

  describe("Hành vi phân quyền hasRequiredRole", () => {
    it("SUPER_ADMIN luôn có toàn quyền tối cao trên mọi ma trận", () => {
      expect(hasRequiredRole("SUPER_ADMIN", ["PURCHASER"])).toBe(true);
      expect(hasRequiredRole("SUPER_ADMIN", ["ACCOUNTANT"])).toBe(true);
      expect(hasRequiredRole("SUPER_ADMIN", ["WAREHOUSE"])).toBe(true);
      expect(hasRequiredRole("SUPER_ADMIN", ["SUPER_ADMIN"])).toBe(true);
    });

    it("vai OPERATOR cũ được tự động ánh xạ sang PURCHASER, WAREHOUSE và SUPPORT", () => {
      expect(hasRequiredRole("OPERATOR", ["PURCHASER"])).toBe(true);
      expect(hasRequiredRole("OPERATOR", ["WAREHOUSE"])).toBe(true);
      expect(hasRequiredRole("OPERATOR", ["SUPPORT"])).toBe(true);
      // Nhưng không được quyền kế toán hoặc quyền tối cao super admin
      expect(hasRequiredRole("OPERATOR", ["ACCOUNTANT"])).toBe(false);
      expect(hasRequiredRole("OPERATOR", ["SUPER_ADMIN"])).toBe(false);
    });

    it("PURCHASER chỉ được thực hiện nghiệp vụ mua hàng và duyệt giá", () => {
      expect(hasRequiredRole("PURCHASER", ["PURCHASER"])).toBe(true);
      expect(hasRequiredRole("PURCHASER", ["ACCOUNTANT"])).toBe(false);
      expect(hasRequiredRole("PURCHASER", ["SUPER_ADMIN"])).toBe(false);
    });

    it("ACCOUNTANT chỉ được xem báo cáo và đối soát tài chính", () => {
      expect(hasRequiredRole("ACCOUNTANT", ["ACCOUNTANT"])).toBe(true);
      expect(hasRequiredRole("ACCOUNTANT", ["WAREHOUSE"])).toBe(false);
      expect(hasRequiredRole("ACCOUNTANT", ["SUPER_ADMIN"])).toBe(false);
    });
  });
});

