import { describe, it, expect } from "vitest";
import { parseAdminTab, parseAdminLocation, VALID_ADMIN_TABS } from "@/features/ai/admin/tab-utils";

describe("Admin AI & Dashboard - Tab Parsing & Deep Link Routing", () => {
  describe("parseAdminTab", () => {
    it("Trả về 'orders' mặc định khi không truyền hoặc truyền rỗng / null / undefined", () => {
      expect(parseAdminTab()).toBe("orders");
      expect(parseAdminTab(null)).toBe("orders");
      expect(parseAdminTab("")).toBe("orders");
      expect(parseAdminTab("   ")).toBe("orders");
    });

    it("Chấp nhận tất cả các tab thông thường hợp lệ không phân biệt hoa thường", () => {
      expect(parseAdminTab("orders")).toBe("orders");
      expect(parseAdminTab("Orders")).toBe("orders");
      expect(parseAdminTab("PRODUCTS")).toBe("products");
      expect(parseAdminTab("purchase")).toBe("purchase");
    });

    it("Từ chối các tab không hợp lệ hoặc key lạ, tự động fallback về 'orders'", () => {
      expect(parseAdminTab("random_tab")).toBe("orders");
      expect(parseAdminTab("billing")).toBe("orders");
      expect(parseAdminTab("super_secret")).toBe("orders");
    });

    it("Tôn trọng phân quyền: settings và audit chỉ cho phép SUPER_ADMIN", () => {
      // Khi là SUPER_ADMIN
      expect(parseAdminTab("settings", "SUPER_ADMIN")).toBe("settings");
      expect(parseAdminTab("audit", "SUPER_ADMIN")).toBe("audit");

      // Khi là OPERATOR hoặc khách
      expect(parseAdminTab("settings", "OPERATOR")).toBe("orders");
      expect(parseAdminTab("audit", "OPERATOR")).toBe("orders");
      expect(parseAdminTab("settings", null)).toBe("orders");
    });

    it("Tôn trọng phân quyền: customers và sandbox chỉ cho phép SUPER_ADMIN", () => {
      expect(parseAdminTab("customers", "SUPER_ADMIN")).toBe("customers");
      expect(parseAdminTab("sandbox", "SUPER_ADMIN")).toBe("sandbox");

      expect(parseAdminTab("customers", "OPERATOR")).toBe("orders");
      expect(parseAdminTab("sandbox", "OPERATOR")).toBe("orders");
    });

    it("Tương thích ngược: map tab=operations và tab=vn_jp_dispatch về tab='orders'", () => {
      expect(parseAdminTab("operations")).toBe("orders");
      expect(parseAdminTab("vn_jp_dispatch")).toBe("orders");
    });
  });

  describe("parseAdminLocation", () => {
    const makeParams = (entries: Record<string, string>) => ({
      get: (key: string) => entries[key] ?? null,
    });

    it("Deep link Rule 1: /admin?tab=orders&filter=unverified mở tab orders và bộ lọc unverified", () => {
      const loc = parseAdminLocation(makeParams({ tab: "orders", filter: "unverified" }));
      expect(loc.tab).toBe("orders");
      expect(loc.viewMode).toBe("dashboard");
      expect(loc.filter).toBe("unverified");
    });

    it("Deep link Rule 2: /admin?tab=orders&status=PENDING_DEPOSIT mở tab orders và trạng thái PENDING_DEPOSIT", () => {
      const loc = parseAdminLocation(makeParams({ tab: "orders", status: "PENDING_DEPOSIT" }));
      expect(loc.tab).toBe("orders");
      expect(loc.status).toBe("PENDING_DEPOSIT");
      expect(loc.viewMode).toBe("dashboard");
    });

    it("Deep link Rule 3: /admin?tab=orders&view=kanban chuyển sang viewMode 'operations'", () => {
      const loc = parseAdminLocation(makeParams({ tab: "orders", view: "kanban" }));
      expect(loc.tab).toBe("orders");
      expect(loc.viewMode).toBe("operations");
    });

    it("Deep link Rule 4: /admin?tab=audit&filter=emails mở tab audit cho SUPER_ADMIN kèm filter emails", () => {
      const loc = parseAdminLocation(makeParams({ tab: "audit", filter: "emails" }), "SUPER_ADMIN");
      expect(loc.tab).toBe("audit");
      expect(loc.filter).toBe("emails");
    });

    it("Deep link Rule 5: /admin?tab=orders&view=vnjp chuyển sang viewMode 'vn_jp_dispatch'", () => {
      const loc = parseAdminLocation(makeParams({ tab: "orders", view: "vnjp" }));
      expect(loc.tab).toBe("orders");
      expect(loc.viewMode).toBe("vn_jp_dispatch");
    });

    it("Fallback tương thích ngược khi link cũ dùng tab=operations hoặc tab=vn_jp_dispatch", () => {
      const loc1 = parseAdminLocation(makeParams({ tab: "operations" }));
      expect(loc1.tab).toBe("orders");
      expect(loc1.viewMode).toBe("operations");

      const loc2 = parseAdminLocation(makeParams({ tab: "vn_jp_dispatch" }));
      expect(loc2.tab).toBe("orders");
      expect(loc2.viewMode).toBe("vn_jp_dispatch");
    });
  });
});
