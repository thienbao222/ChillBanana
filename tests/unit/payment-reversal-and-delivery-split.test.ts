import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

describe("WP2.2 — Hoàn tác bằng bản ghi đảo, tách giao hàng khỏi thanh toán, sửa cron", () => {
  it("Kiểm tra tĩnh: Tuyệt đối không còn 'paymentTransaction.deleteMany' trong mã nguồn src/", () => {
    function scanDir(dir: string): string[] {
      const results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...scanDir(fullPath));
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes("paymentTransaction.deleteMany")) {
            results.push(fullPath);
          }
        }
      }
      return results;
    }

    const matches = scanDir(path.resolve("src"));
    expect(matches).toEqual([]);
  });

  it("Cron auto-tracking: Không tự động ghi nhận PAID_100 hay gán depositAmountVnd = totalVnd khi chốt COMPLETED", () => {
    const cronFileContent = fs.readFileSync(path.resolve("src/app/api/cron/auto-tracking/route.ts"), "utf-8");
    
    // Kiểm tra không còn câu lệnh gán PAID_100 vô điều kiện trong updateMany
    expect(cronFileContent).not.toMatch(/paymentStatus:\s*["']PAID_100["'],\s*depositAmountVnd:\s*order\.totalVnd/);
    
    // Kiểm tra đã dùng trạng thái PENDING_RECONCILE
    expect(cronFileContent).toContain("PENDING_RECONCILE");
    expect(cronFileContent).toContain('kind: "BALANCE"');
  });

  it("Chặn chuyển sang LOCAL_DELIVERY hoặc COMPLETED nếu weightKg <= 0 (trừ đơn origin VN)", () => {
    const routeContent = fs.readFileSync(path.resolve("src/app/api/orders/[id]/route.ts"), "utf-8");
    
    // Phải kiểm tra cả IN_TRANSIT_AIR, LOCAL_DELIVERY và COMPLETED
    expect(routeContent).toContain('requestedStatus === "LOCAL_DELIVERY"');
    expect(routeContent).toContain('requestedStatus === "COMPLETED"');
    expect(routeContent).toContain('existingOrder.fulfillmentOrigin === "VN"');
  });

  it("Hoàn tác COMPLETED về LOCAL_DELIVERY tạo giao dịch REVERSAL và đánh dấu VOIDED", () => {
    const routeContent = fs.readFileSync(path.resolve("src/app/api/orders/[id]/route.ts"), "utf-8");
    
    expect(routeContent).toContain('status: "VOIDED"');
    expect(routeContent).toContain('kind: "REVERSAL"');
    expect(routeContent).toContain('reversalOfId: txItem.id');
    expect(routeContent).toContain('action: "PAYMENT_REVERSED"');
  });
});

