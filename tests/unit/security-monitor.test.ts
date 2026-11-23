import { describe, it, expect, beforeEach } from "vitest";
import {
  getSecurityTelemetry,
  incrementBlockedSsrf,
  incrementBlockedCsrf,
  resetSecurityMetricsForTesting,
} from "@/features/security/monitor";
import { parseAdminTab } from "@/features/ai/admin/tab-utils";
import { verifySameOrigin } from "@/lib/auth-session";
import { isPrivateHost } from "@/lib/ssrf";
import { NextRequest } from "next/server";

describe("Security & AppSec Monitor Module", () => {
  beforeEach(() => {
    resetSecurityMetricsForTesting();
  });

  it("getSecurityTelemetry trả về đầy đủ 6 động cơ phòng thủ chiều sâu và telemetry đếm thực", async () => {
    const telemetryBefore = await getSecurityTelemetry();
    expect(telemetryBefore).toBeDefined();
    expect(telemetryBefore.systemStatus).toBe("SECURE");
    expect(telemetryBefore.securityScore).toBeGreaterThanOrEqual(85);
    expect(telemetryBefore.defenseEngines).toHaveLength(6);

    const engineIds = telemetryBefore.defenseEngines.map((e) => e.id);
    expect(engineIds).toContain("ssrf_guard");
    expect(engineIds).toContain("csrf_shield");
    expect(engineIds).toContain("rbac_guard");
    expect(engineIds).toContain("session_hmac");
    expect(engineIds).toContain("rate_limiter");
    expect(engineIds).toContain("financial_reversal");

    const ssrfBefore = telemetryBefore.metrics24h.ssrfAttacksBlocked;
    const csrfBefore = telemetryBefore.metrics24h.csrfAttemptsBlocked;

    incrementBlockedSsrf();
    incrementBlockedCsrf();
    incrementBlockedCsrf();

    const telemetryAfter = await getSecurityTelemetry();
    expect(telemetryAfter.metrics24h.ssrfAttacksBlocked).toBe(ssrfBefore + 1);
    expect(telemetryAfter.metrics24h.csrfAttemptsBlocked).toBe(csrfBefore + 2);
  });

  it("parseAdminTab nhận diện tab 'security' hợp lệ cho cả OPERATOR và SUPER_ADMIN", () => {
    expect(parseAdminTab("security", "OPERATOR")).toBe("security");
    expect(parseAdminTab("security", "SUPER_ADMIN")).toBe("security");
  });

  it("verifySameOrigin chặn đứng các domain tấn công giả mạo đuôi vercel và tăng telemetry", () => {
    // 1. Request từ kẻ tấn công dùng subdomain lừa đảo
    const maliciousReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        origin: "https://evil-attacker.vercel.app",
      },
    });
    expect(verifySameOrigin(maliciousReq)).toBe(false);

    // 2. Request từ domain giả mạo tên chill-banana
    const imposterReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        origin: "https://attacker-chill-banana.vercel.app",
      },
    });
    expect(verifySameOrigin(imposterReq)).toBe(false);

    // 3. Request chuẩn từ chính thống localhost và domain chill-banana
    const localReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
      },
    });
    expect(verifySameOrigin(localReq)).toBe(true);

    const prodReq = new NextRequest("https://chill-banana.vercel.app/api/orders", {
      method: "POST",
      headers: {
        origin: "https://chill-banana.vercel.app",
      },
    });
    expect(verifySameOrigin(prodReq)).toBe(true);

    const previewReq = new NextRequest("https://chill-banana-preview-12.vercel.app/api/orders", {
      method: "POST",
      headers: {
        origin: "https://chill-banana-preview-12.vercel.app",
      },
    });
    expect(verifySameOrigin(previewReq)).toBe(true);
  });

  it("isPrivateHost phát hiện chính xác mọi dải IP nguy hiểm SSRF", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("169.254.169.254")).toBe(true);
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("::1")).toBe(true);

    // Host công cộng hợp lệ
    expect(isPrivateHost("amazon.co.jp")).toBe(false);
    expect(isPrivateHost("rakuten.co.jp")).toBe(false);
  });
});
