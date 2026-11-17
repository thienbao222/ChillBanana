import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDemoSelfHealEnabled } from "@/lib/demo-mode";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  getMaxBlockedSeconds: vi.fn().mockResolvedValue(0),
  recordHits: vi.fn().mockResolvedValue(1),
  resetKey: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import * as rateLimit from "@/lib/rate-limit";
import { POST as adminLogin } from "@/app/api/admin/auth/route";

function createLoginRequest(body: Record<string, unknown>, ip = "127.0.0.1"): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/auth", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("WP0.2: isDemoSelfHealEnabled()", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ENABLE_DEMO_SELF_HEAL;
    delete process.env.APP_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("trả về false khi không có biến môi trường", () => {
    expect(isDemoSelfHealEnabled()).toBe(false);
  });

  it("trả về false khi ENABLE_DEMO_SELF_HEAL=true nhưng APP_ENV không phải demo (ví dụ production)", () => {
    process.env.ENABLE_DEMO_SELF_HEAL = "true";
    process.env.APP_ENV = "production";
    expect(isDemoSelfHealEnabled()).toBe(false);
  });

  it("trả về false khi ENABLE_DEMO_SELF_HEAL=true nhưng APP_ENV=development", () => {
    process.env.ENABLE_DEMO_SELF_HEAL = "true";
    process.env.APP_ENV = "development";
    expect(isDemoSelfHealEnabled()).toBe(false);
  });

  it("trả về false khi APP_ENV=demo nhưng ENABLE_DEMO_SELF_HEAL không phải true (hoặc false)", () => {
    process.env.APP_ENV = "demo";
    process.env.ENABLE_DEMO_SELF_HEAL = "false";
    expect(isDemoSelfHealEnabled()).toBe(false);
  });

  it("trả về true DUY NHẤT khi ENABLE_DEMO_SELF_HEAL=true VÀ APP_ENV=demo", () => {
    process.env.ENABLE_DEMO_SELF_HEAL = "true";
    process.env.APP_ENV = "demo";
    expect(isDemoSelfHealEnabled()).toBe(true);
  });
});

describe("WP0.2: Hành vi xác thực Master Admin & Tự phục hồi", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_DEMO_SELF_HEAL;
    delete process.env.APP_ENV;
    delete process.env.ADMIN_INITIAL_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("cờ tắt: đăng nhập bằng tài khoản không có trong DB trả về 401 và ghi nhận lỗi", async () => {
    process.env.APP_ENV = "production";
    process.env.ENABLE_DEMO_SELF_HEAL = "false";
    process.env.ADMIN_INITIAL_PASSWORD = "DemoPassword123";

    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);

    const req = createLoginRequest({ username: "admin", password: "DemoPassword123" });
    const res = await adminLogin(req);

    expect(res.status).toBe(401);
    expect(rateLimit.getMaxBlockedSeconds).toHaveBeenCalled();
    expect(rateLimit.recordHits).toHaveBeenCalled();
    expect(prisma.adminUser.upsert).not.toHaveBeenCalled();
  });

  it("cờ bật nhưng APP_ENV không phải demo: không tự phục hồi, trả về 401", async () => {
    process.env.APP_ENV = "production";
    process.env.ENABLE_DEMO_SELF_HEAL = "true";
    process.env.ADMIN_INITIAL_PASSWORD = "DemoPassword123";

    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);

    const req = createLoginRequest({ username: "admin", password: "DemoPassword123" });
    const res = await adminLogin(req);

    expect(res.status).toBe(401);
    expect(prisma.adminUser.upsert).not.toHaveBeenCalled();
  });

  it("cờ bật và APP_ENV=demo nhưng thiếu ADMIN_INITIAL_PASSWORD: không tự phục hồi", async () => {
    process.env.APP_ENV = "demo";
    process.env.ENABLE_DEMO_SELF_HEAL = "true";
    delete process.env.ADMIN_INITIAL_PASSWORD;

    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);

    const req = createLoginRequest({ username: "admin", password: "AnyPassword" });
    const res = await adminLogin(req);

    expect(res.status).toBe(401);
    expect(prisma.adminUser.upsert).not.toHaveBeenCalled();
  });

  it("cờ bật VÀ APP_ENV=demo VÀ có ADMIN_INITIAL_PASSWORD: kích hoạt self-heal khi DB trống", async () => {
    process.env.APP_ENV = "demo";
    process.env.ENABLE_DEMO_SELF_HEAL = "true";
    process.env.ADMIN_INITIAL_PASSWORD = "ValidDemoPassword2026";

    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.adminUser.upsert).mockResolvedValue({
      id: "admin-1",
      username: "admin",
      passwordHash: "dummy-hash",
      name: "Quản Trị Viên ChillBanana",
      role: "SUPER_ADMIN",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = createLoginRequest({ username: "admin", password: "ValidDemoPassword2026" });
    const res = await adminLogin(req);

    expect(res.status).toBe(200);
    expect(rateLimit.getMaxBlockedSeconds).toHaveBeenCalled(); // Vẫn phải qua rate limit!
    expect(prisma.adminUser.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { username: "admin" },
      })
    );
  });

  it("mọi trường hợp kể cả master admin đều bị chặn nếu đã vượt quá giới hạn đăng nhập sai (rate limit)", async () => {
    process.env.APP_ENV = "demo";
    process.env.ENABLE_DEMO_SELF_HEAL = "true";
    process.env.ADMIN_INITIAL_PASSWORD = "ValidDemoPassword2026";

    // Mô phỏng IP hoặc User đang bị khóa 300 giây
    vi.mocked(rateLimit.getMaxBlockedSeconds).mockResolvedValue(300);

    const req = createLoginRequest({ username: "admin", password: "ValidDemoPassword2026" });
    const res = await adminLogin(req);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(prisma.adminUser.upsert).not.toHaveBeenCalled();
  });
});

describe("WP0.2: Quét chuỗi mật khẩu mặc định nhạy cảm", () => {
  it(
    "không còn bất kỳ chuỗi 'Admin@2026' nào trong src/, prisma/, scripts/",
    () => {
    const rootDir = path.resolve(__dirname, "../../");
    const targetDirs = ["src", "prisma", "scripts"];
    const forbiddenPattern = "Admin@2026";
    const foundOccurrences: string[] = [];

    function scanDir(dirPath: string) {
      if (!fs.existsSync(dirPath)) return;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(ts|tsx|js|mjs|cjs|json)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes(forbiddenPattern)) {
            const relPath = path.relative(rootDir, fullPath);
            foundOccurrences.push(relPath);
          }
        }
      }
    }

    for (const d of targetDirs) {
      scanDir(path.join(rootDir, d));
    }

    expect(foundOccurrences).toEqual([]);
  }, 30_000);
});
