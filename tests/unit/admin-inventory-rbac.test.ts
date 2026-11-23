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

function getRequireAdminCalls(content: string): string[] {
  // Loại bỏ các khối chú thích /* ... */ và // ...
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  const calls: string[] = [];
  const regex = /requireAdmin\s*\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(stripped)) !== null) {
    calls.push(match[0]);
  }
  return calls;
}

describe("WP7.1 — Phân Quyền Theo Vai (RBAC) & Test Kiểm Kê Toàn Bộ Route Admin", () => {
  describe("Test Kiểm Kê: 100% Route Admin Bắt Buộc Được Bảo Vệ & Có Khai Báo Roles", () => {
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

    it("100% lời gọi requireAdmin trong các route admin (trừ whitelist) phải có cấu hình roles: [...] rõ ràng", () => {
      const allRoutes = getAllAdminRoutes(ADMIN_API_DIR);
      expect(allRoutes.length).toBeGreaterThanOrEqual(30);

      const routesWithMissingRoles: { file: string; call: string }[] = [];
      let totalCallsCount = 0;

      for (const routePath of allRoutes) {
        const relativePath = path.normalize(path.relative(process.cwd(), routePath));
        if (PUBLIC_WHITELIST.includes(relativePath)) {
          continue;
        }

        const content = fs.readFileSync(routePath, "utf8");
        const calls = getRequireAdminCalls(content);

        expect(calls.length, `Route ${relativePath} phải có ít nhất 1 lệnh gọi requireAdmin`).toBeGreaterThan(0);

        for (const call of calls) {
          totalCallsCount++;
          if (!call.includes("roles:")) {
            routesWithMissingRoles.push({ file: relativePath, call });
          }
        }
      }

      expect(totalCallsCount).toBeGreaterThanOrEqual(40);
      expect(
        routesWithMissingRoles,
        `Phát hiện các route gọi requireAdmin mà KHÔNG khai báo roles: ${JSON.stringify(routesWithMissingRoles, null, 2)}`
      ).toEqual([]);
    });
  });

  describe("Hành vi phân quyền hasRequiredRole", () => {
    it("SUPER_ADMIN luôn có toàn quyền tối cao trên mọi ma trận", () => {
      expect(hasRequiredRole("SUPER_ADMIN", ["PURCHASER"])).toBe(true);
      expect(hasRequiredRole("SUPER_ADMIN", ["ACCOUNTANT"])).toBe(true);
      expect(hasRequiredRole("SUPER_ADMIN", ["WAREHOUSE"])).toBe(true);
      expect(hasRequiredRole("SUPER_ADMIN", ["SUPER_ADMIN"])).toBe(true);
      expect(hasRequiredRole("SUPER_ADMIN", ["OPERATOR"])).toBe(true);
      expect(hasRequiredRole("SUPER_ADMIN", ["SUPER_ADMIN", "OPERATOR"])).toBe(true);
    });

    it("vai OPERATOR cũ được tự động ánh xạ sang PURCHASER, WAREHOUSE và SUPPORT", () => {
      expect(hasRequiredRole("OPERATOR", ["OPERATOR"])).toBe(true);
      expect(hasRequiredRole("OPERATOR", ["SUPER_ADMIN", "OPERATOR"])).toBe(true);
      expect(hasRequiredRole("OPERATOR", ["PURCHASER"])).toBe(true);
      expect(hasRequiredRole("OPERATOR", ["WAREHOUSE"])).toBe(true);
      expect(hasRequiredRole("OPERATOR", ["SUPPORT"])).toBe(true);
      // Nhưng không được quyền kế toán hoặc quyền tối cao super admin
      expect(hasRequiredRole("OPERATOR", ["ACCOUNTANT"])).toBe(false);
      expect(hasRequiredRole("OPERATOR", ["SUPER_ADMIN"])).toBe(false);
    });

    it("vai trò không hợp lệ hoặc khách vãng lai bị từ chối quyền trên các route admin", () => {
      expect(hasRequiredRole("GUEST", ["SUPER_ADMIN"])).toBe(false);
      expect(hasRequiredRole("GUEST", ["OPERATOR"])).toBe(false);
      expect(hasRequiredRole("GUEST", ["SUPER_ADMIN", "OPERATOR"])).toBe(false);
      expect(hasRequiredRole("", ["SUPER_ADMIN"])).toBe(false);
      expect(hasRequiredRole("CUSTOMER", ["SUPER_ADMIN", "OPERATOR"])).toBe(false);
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

