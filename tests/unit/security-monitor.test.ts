import { describe, it, expect } from "vitest";
import { getSecurityTelemetry } from "@/features/security/monitor";
import { parseAdminTab } from "@/features/ai/admin/tab-utils";

describe("Security & AppSec Monitor Module", () => {
  it("getSecurityTelemetry trả về đầy đủ 6 động cơ phòng thủ chiều sâu", async () => {
    const telemetry = await getSecurityTelemetry();
    expect(telemetry).toBeDefined();
    expect(telemetry.systemStatus).toBe("SECURE");
    expect(telemetry.securityScore).toBeGreaterThanOrEqual(90);
    expect(telemetry.defenseEngines).toHaveLength(6);

    const engineIds = telemetry.defenseEngines.map((e) => e.id);
    expect(engineIds).toContain("ssrf_guard");
    expect(engineIds).toContain("csrf_shield");
    expect(engineIds).toContain("rbac_guard");
    expect(engineIds).toContain("session_hmac");
    expect(engineIds).toContain("rate_limiter");
    expect(engineIds).toContain("financial_reversal");
  });

  it("parseAdminTab nhận diện tab 'security' hợp lệ cho cả OPERATOR và SUPER_ADMIN", () => {
    expect(parseAdminTab("security", "OPERATOR")).toBe("security");
    expect(parseAdminTab("security", "SUPER_ADMIN")).toBe("security");
  });
});
