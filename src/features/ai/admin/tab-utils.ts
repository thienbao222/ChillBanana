export const VALID_ADMIN_TABS = [
  "orders",
  "products",
  "purchase",
  "customers",
  "analytics",
  "sandbox",
  "settings",
  "audit",
  "security",
] as const;

export type AdminTab = (typeof VALID_ADMIN_TABS)[number];
export type AdminViewMode = "dashboard" | "operations" | "vn_jp_dispatch";

export interface ParsedAdminLocation {
  tab: AdminTab;
  viewMode: AdminViewMode;
  filter?: string;
  status?: string;
}

/**
 * Phân tích và chuẩn hóa tham số tab trên URL admin.
 * Chỉ chấp nhận các key hợp lệ và tôn trọng phân quyền (settings, audit, customers, sandbox chỉ SUPER_ADMIN).
 */
export function parseAdminTab(
  tabParam?: string | null,
  userRole?: string | null
): AdminTab {
  if (!tabParam) return "orders";
  const normalized = tabParam.trim().toLowerCase();

  // Settings & Audit chỉ dành cho SUPER_ADMIN
  if (normalized === "settings" || normalized === "audit") {
    return userRole === "SUPER_ADMIN" ? (normalized as AdminTab) : "orders";
  }

  // Khách hàng & Sandbox & Analytics yêu cầu quyền SUPER_ADMIN
  if (normalized === "customers" || normalized === "sandbox") {
    return userRole === "SUPER_ADMIN" ? (normalized as AdminTab) : "orders";
  }

  // Tương thích ngược nếu người dùng gõ nhầm tab=operations hoặc tab=vn_jp_dispatch
  if (normalized === "operations" || normalized === "vn_jp_dispatch") {
    return "orders";
  }

  if ((VALID_ADMIN_TABS as readonly string[]).includes(normalized)) {
    return normalized as AdminTab;
  }

  return "orders";
}

/**
 * Phân tích toàn bộ query parameters trên URL admin thành trạng thái giao diện xác định.
 */
export function parseAdminLocation(
  searchParams: { get: (key: string) => string | null },
  userRole?: string | null
): ParsedAdminLocation {
  const rawTab = searchParams.get("tab");
  const rawView = searchParams.get("view");
  const rawFilter = searchParams.get("filter");
  const rawStatus = searchParams.get("status");

  const tab = parseAdminTab(rawTab, userRole);

  let viewMode: AdminViewMode = "dashboard";
  const normalizedView = (rawView || "").trim().toLowerCase();
  const normalizedTab = (rawTab || "").trim().toLowerCase();

  if (normalizedView === "kanban" || normalizedView === "operations" || normalizedTab === "operations") {
    viewMode = "operations";
  } else if (normalizedView === "vnjp" || normalizedView === "vn_jp_dispatch" || normalizedTab === "vn_jp_dispatch") {
    viewMode = "vn_jp_dispatch";
  }

  return {
    tab,
    viewMode,
    filter: rawFilter ? rawFilter.trim() : undefined,
    status: rawStatus ? rawStatus.trim() : undefined,
  };
}
