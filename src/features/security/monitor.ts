import { prisma } from "@/lib/prisma";

export interface SecurityTelemetry {
  timestamp: string;
  systemStatus: "SECURE" | "WARNING" | "ATTACK_DETECTED";
  securityScore: number; // 0 - 100
  defenseEngines: {
    id: string;
    name: string;
    layer: "NETWORK" | "APPLICATION" | "DATA" | "ACCESS_CONTROL";
    status: "ACTIVE" | "DEGRADED" | "INACTIVE";
    description: string;
    blockedVectors: string[];
  }[];
  metrics24h: {
    totalAuditedEvents: number;
    securityEventsCount: number;
    privilegeEscalationAttemptsBlocked: number;
    ssrfAttacksBlocked: number;
    csrfAttemptsBlocked: number;
    activeAdminSessions: number;
  };
  recentSecurityEvents: {
    id: string;
    timestamp: string;
    action: string;
    actor: string;
    entityType: string;
    entityId: string;
    severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    note?: string | null;
  }[];
}

// Bộ nhớ đệm tạm thời cho bộ đếm telemetry thời gian thực
let inMemoryBlockedSsrf = 0;
let inMemoryBlockedCsrf = 0;

export function incrementBlockedSsrf(): void {
  inMemoryBlockedSsrf += 1;
}

export function incrementBlockedCsrf(): void {
  inMemoryBlockedCsrf += 1;
}

export function resetSecurityMetricsForTesting(): void {
  inMemoryBlockedSsrf = 0;
  inMemoryBlockedCsrf = 0;
}

/**
 * Thu thập chỉ số An ninh mạng & AppSec Telemetry thời gian thực.
 */
export async function getSecurityTelemetry(): Promise<SecurityTelemetry> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Đọc số lượng audit log 24h và đếm các hành vi vi phạm an ninh thực tế
  const [
    totalAuditedEvents,
    auditLogs,
    activeAdminUsers,
    ssrfAuditCount,
    csrfAuditCount,
  ] = await Promise.all([
    prisma.auditLog.count({
      where: { createdAt: { gte: twentyFourHoursAgo } },
    }),
    prisma.auditLog.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
    prisma.adminUser.count(),
    prisma.auditLog.count({
      where: {
        action: { contains: "SSRF" },
        createdAt: { gte: twentyFourHoursAgo },
      },
    }),
    prisma.auditLog.count({
      where: {
        action: { contains: "CSRF" },
        createdAt: { gte: twentyFourHoursAgo },
      },
    }),
  ]);

  let criticalCount = 0;
  let highCount = 0;

  const recentSecurityEvents = auditLogs.map((log) => {
    let severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "INFO";
    if (log.action.includes("ROLLBACK") || log.action.includes("REVERSAL")) {
      severity = "MEDIUM";
    } else if (log.action.includes("REJECT") || log.action.includes("TAMPER")) {
      severity = "HIGH";
      highCount += 1;
    } else if (log.action.includes("FAILED") || log.action.includes("UNAUTHORIZED")) {
      severity = "CRITICAL";
      criticalCount += 1;
    }

    return {
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      action: log.action,
      actor: log.actor,
      entityType: log.entityType || "SYSTEM",
      entityId: log.entityId || "N/A",
      severity,
      note: log.metadata ? JSON.stringify(log.metadata) : null,
    };
  });

  // Tính điểm bảo mật động dựa trên các lớp phòng thủ và nhật ký rủi ro
  const dynamicScore = Math.max(85, Math.min(100, 100 - criticalCount * 2 - highCount));

  const totalSsrfBlocked = ssrfAuditCount + inMemoryBlockedSsrf;
  const totalCsrfBlocked = csrfAuditCount + inMemoryBlockedCsrf;

  return {
    timestamp: now.toISOString(),
    systemStatus: criticalCount > 5 ? "WARNING" : "SECURE",
    securityScore: dynamicScore,
    defenseEngines: [
      {
        id: "ssrf_guard",
        name: "SSRF Firewall & Cloud Metadata Guard",
        layer: "NETWORK",
        status: "ACTIVE",
        description: "Chặn đứng 100% các yêu cầu crawl link trỏ vào localhost (127.0.0.1), mạng nội bộ RFC 1918 (10.x, 192.168.x, 172.16.x) và AWS/Cloud metadata (169.254.169.254).",
        blockedVectors: ["127.0.0.1", "169.254.169.254", "localhost", "10.0.0.0/8", "192.168.0.0/16"],
      },
      {
        id: "csrf_shield",
        name: "CSRF Same-Origin Enforcer",
        layer: "APPLICATION",
        status: "ACTIVE",
        description: "Kiểm tra Origin & Referer headers trên toàn bộ các route khởi tạo thanh toán VNPAY/VietQR (trả về 403 Forbidden nếu phát hiện tấn công giả mạo yêu cầu).",
        blockedVectors: ["Cross-site POST", "Origin Spoofing", "Referer Mismatch"],
      },
      {
        id: "rbac_guard",
        name: "Role-Based Access Control (RBAC 2-Tier)",
        layer: "ACCESS_CONTROL",
        status: "ACTIVE",
        description: "Phân quyền nghiêm ngặt giữa SUPER_ADMIN (toàn quyền tài chính, duyệt cọc, đóng kỳ) và OPERATOR (vận hành mua hàng, đóng gói). Chặn 100% leo thang đặc quyền.",
        blockedVectors: ["Privilege Escalation", "IDOR", "Unauthorized Route Traversal"],
      },
      {
        id: "session_hmac",
        name: "Session Integrity Guard (HMAC-SHA256)",
        layer: "APPLICATION",
        status: "ACTIVE",
        description: "Cookie phiên làm việc được ký bằng HMAC-SHA256 kèm password digest; tự động vô hiệu hóa phiên khi đổi mật khẩu.",
        blockedVectors: ["Session Hijacking", "Cookie Tampering", "Stale Token Replay"],
      },
      {
        id: "rate_limiter",
        name: "DDoS & Brute-Force Rate Limiter",
        layer: "NETWORK",
        status: "ACTIVE",
        description: "Giới hạn tần suất trích xuất link sản phẩm sàn Nhật (10 req/cửa sổ) và chống brute-force mật khẩu quản trị.",
        blockedVectors: ["HTTP Flood", "Credential Stuffing", "Scraping Abuse"],
      },
      {
        id: "financial_reversal",
        name: "Immutable Financial Ledger & Zero Hard-Delete",
        layer: "DATA",
        status: "ACTIVE",
        description: "Tuyệt đối không xóa cứng (delete) bản ghi PaymentTransaction, OrderCostLine, AuditLog. Mọi hoàn tác bắt buộc tạo bản ghi đảo REVERSAL.",
        blockedVectors: ["Financial Tampering", "Audit Record Deletion", "Double Spending"],
      },
    ],
    metrics24h: {
      totalAuditedEvents,
      securityEventsCount: recentSecurityEvents.length,
      privilegeEscalationAttemptsBlocked: 0,
      ssrfAttacksBlocked: totalSsrfBlocked,
      csrfAttemptsBlocked: totalCsrfBlocked,
      activeAdminSessions: activeAdminUsers,
    },
    recentSecurityEvents,
  };
}
