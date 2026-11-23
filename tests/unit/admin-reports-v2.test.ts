import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getReports } from "@/app/api/admin/reports/route";
import { GET as exportReportsCsv } from "@/app/api/admin/reports/export/route";
import { prisma } from "@/lib/prisma";
import * as adminGuard from "@/lib/admin-guard";
import { NextRequest } from "next/server";

describe("WP2.3 — Báo cáo v2 và xuất CSV", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(adminGuard, "requireAdmin").mockResolvedValue({
      ok: true,
      username: "admin_super",
      role: "SUPER_ADMIN",
    } as any);
  });

  it("Tính toán chính xác ví dụ tay: GMV, Doanh thu dịch vụ, Chi phí và Lãi gộp; loại bỏ đơn CANCELLED", async () => {
    const mockOrders = [
      // Đơn 1: Khớp ví dụ tay trong đặc tả
      {
        id: "ord-1",
        orderCode: "CB-EX-001",
        status: "COMPLETED",
        paymentStatus: "PAID_100",
        productPriceVnd: 654500,
        serviceFeeVnd: 26180,
        shippingFeeVnd: 92500,
        totalVnd: 773180,
        depositAmountVnd: 773180,
        category: "gadgets",
        productName: "Bình giữ nhiệt Tiger",
        createdAt: new Date("2026-11-04T10:00:00Z"),
        customerType: "REGISTERED",
        paymentTransactions: [
          {
            id: "tx-1",
            amountVnd: 773180,
            status: "CONFIRMED",
            kind: "DEPOSIT",
          },
        ],
        costLines: [
          {
            id: "cost-1",
            category: "GOODS_JPY",
            amountVnd: 550000,
            voidedAt: null,
          },
          {
            id: "cost-2",
            category: "INTL_FREIGHT",
            amountVnd: 65000,
            voidedAt: null,
          },
          {
            id: "cost-void",
            category: "OTHER",
            amountVnd: 99999,
            voidedAt: new Date(), // Bị voided, không được tính vào chi phí
          },
        ],
      },
      // Đơn 2: Đơn CANCELLED (tuyệt đối không được tính vào GMV, doanh thu, chi phí)
      {
        id: "ord-cancel",
        orderCode: "CB-CANCEL-001",
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        productPriceVnd: 1000000,
        serviceFeeVnd: 50000,
        shippingFeeVnd: 150000,
        totalVnd: 1200000,
        depositAmountVnd: 0,
        category: "anime",
        productName: "Mô hình Gundam",
        createdAt: new Date("2026-11-04T11:00:00Z"),
        customerType: "GUEST",
        paymentTransactions: [],
        costLines: [
          {
            id: "cost-cancel",
            category: "GOODS_JPY",
            amountVnd: 800000,
            voidedAt: null,
          },
        ],
      },
    ];

    vi.spyOn(prisma.order, "findMany").mockResolvedValue(mockOrders as any);
    vi.spyOn(prisma.vnJpShipment, "findMany").mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/admin/reports");
    const res = await getReports(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Kiểm tra GMV: chỉ tính đơn 1 (654.500đ), không tính đơn hủy
    expect(body.kpi.gmv).toBe(654500);

    // Doanh thu dịch vụ: serviceFeeVnd (26.180) + shippingFeeVnd (92.500) = 118.680đ
    expect(body.kpi.doanhThuDichVu).toBe(26180 + 92500);

    // Tiền thực thu: 773.180đ
    expect(body.kpi.tienThucThu).toBe(773180);

    // Chi phí thực: 550.000 + 65.000 = 615.000đ (dòng voided 99.999đ bị bỏ qua)
    expect(body.kpi.chiPhiThuc).toBe(615000);

    // Lãi gộp: 773.180 - 615.000 = 158.180đ
    expect(body.kpi.loiNhuanGop).toBe(158180);
    expect(body.kpi.completedEligibleCount).toBe(1);
    expect(body.kpi.completedIncompleteCostCount).toBe(0);
  });

  it("Đơn COMPLETED nhưng chưa có dòng GOODS_JPY thì gắn cờ 'chưa đủ chi phí' và không tính vào lãi gộp", async () => {
    const mockOrderIncompleteCost = [
      {
        id: "ord-inc",
        orderCode: "CB-INC-001",
        status: "COMPLETED",
        paymentStatus: "PAID_100",
        productPriceVnd: 500000,
        serviceFeeVnd: 20000,
        shippingFeeVnd: 92500,
        totalVnd: 612500,
        depositAmountVnd: 612500,
        category: "cosmetics",
        productName: "Son dưỡng DHC",
        createdAt: new Date("2026-11-04T12:00:00Z"),
        customerType: "REGISTERED",
        paymentTransactions: [{ id: "tx-inc", amountVnd: 612500, status: "CONFIRMED", kind: "DEPOSIT" }],
        costLines: [
          // Chỉ có tiền cước nội địa, chưa có dòng tiền mua hàng GOODS_JPY
          { id: "c-1", category: "VN_DOMESTIC_SHIP", amountVnd: 30000, voidedAt: null },
        ],
      },
    ];

    vi.spyOn(prisma.order, "findMany").mockResolvedValue(mockOrderIncompleteCost as any);
    vi.spyOn(prisma.vnJpShipment, "findMany").mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/admin/reports");
    const res = await getReports(req);
    const body = await res.json();

    expect(body.kpi.loiNhuanGop).toBe(0); // Không đưa vào lãi gộp
    expect(body.kpi.completedIncompleteCostCount).toBe(1);
    expect(body.kpi.completedEligibleCount).toBe(0);
  });

  it("Xuất CSV: trả về chuỗi có UTF-8 BOM, đúng tiêu đề và dữ liệu các cột", async () => {
    const mockOrders = [
      {
        id: "ord-1",
        orderCode: "CB-CSV-001",
        status: "COMPLETED",
        createdAt: new Date("2026-11-04T10:00:00+07:00"),
        productPriceVnd: 654500,
        serviceFeeVnd: 26180,
        shippingFeeVnd: 92500,
        totalVnd: 773180,
        paymentTransactions: [{ id: "t1", amountVnd: 773180, status: "CONFIRMED", kind: "DEPOSIT" }],
        costLines: [{ id: "c1", category: "GOODS_JPY", amountVnd: 550000, voidedAt: null }],
      },
    ];

    vi.spyOn(prisma.order, "findMany").mockResolvedValue(mockOrders as any);

    const req = new NextRequest("http://localhost/api/admin/reports/export?format=csv");
    const res = await exportReportsCsv(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");

    const buffer = Buffer.from(await res.arrayBuffer());
    // Bắt buộc có UTF-8 BOM byte: 0xEF, 0xBB, 0xBF
    expect(buffer[0]).toBe(0xef);
    expect(buffer[1]).toBe(0xbb);
    expect(buffer[2]).toBe(0xbf);

    const text = buffer.toString("utf-8");
    // Kiểm tra header
    expect(text).toContain("Mã đơn,Ngày,Trạng thái,GMV,Phí dịch vụ,Cước bay,Tổng tiền,Đã thu,Chi phí thực,Lãi gộp,Cờ");
    // Kiểm tra dòng dữ liệu
    expect(text).toContain("CB-CSV-001");
    expect(text).toContain("654500");
    expect(text).toContain("773180");
    expect(text).toContain("223180"); // 773180 - 550000 = 223180
  });
});
