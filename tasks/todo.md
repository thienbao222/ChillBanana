# Danh Sách Công Việc Toàn Diện (Tasks Todo) — ChillBanana

## 1. Gói R1: Luồng Thu Số Dư Đợt 2 (Balance Settlement) tại WAREHOUSE_VN
- [x] Triển khai hàm `calculateWarehouseVnBalance` tại `src/features/payments/policy.ts`.
- [x] Mở rộng các cổng thanh toán (`vnpay-create`, `vnpay-payment`, `mock-sandbox`, `admin manual payments`) hỗ trợ `paymentType = "BALANCE"`.
- [x] Tích hợp khối thanh toán số dư đợt 2 với mã VietQR động và nút VNPAY trên `src/app/tracking/page.tsx`.
- [x] Tự động chuyển `paymentStatus = "PAID_100"` và ghi `AuditLog(action: "ORDER_BALANCE_SETTLED")`.
- [x] Mở khóa nút xanh "Bàn Giao Shipper (Đã Đủ 100%)" trên `OrderManagementTab.tsx`.
- [x] Bổ sung 12 unit tests trong `tests/unit/balance-settlement.test.ts`.

## 2. Gói R2: Đồng Bộ Báo Giá 3 Bậc & Sàn Phí 80.000 đ
- [x] Đặt `SERVICE_FEE_MINIMUM_VND = 80_000` và bảo toàn đơn tối thiểu 300.000 đ tại `src/features/pricing/calculator.ts`.
- [x] Đồng bộ `min_service_fee_vnd: 80_000` trong `src/lib/system-config.ts` và AI tools.
- [x] Xóa bỏ hardcode cọc 50% cứng và xóa `useState("50")` tại `src/components/NeoDaylightCosmos.tsx` và `src/components/OrderCalculator.tsx`.
- [x] Áp dụng chuẩn 3 bậc `calculateDepositV2` trên 100% giao diện tính giá và giỏ hàng.
- [x] Cập nhật các kịch bản kiểm thử trong `tests/unit/pricing.test.ts` và `tests/unit/unit-economics.test.ts`.

## 3. Gói R3: An Ninh CSRF & Kiểm Soát EMAIL_MODE
- [x] Tích hợp `verifySameOrigin` vào `src/app/api/payment/vnpay-create/route.ts` (chặn CSRF với HTTP 403).
- [x] Thêm hàm `checkEmailSystemReadiness` cảnh báo log `[CRITICAL]` khi thiếu SMTP ở production tại `src/features/notifications/email-delivery.ts`.
- [x] Hoàn thiện nội dung email thông báo HTML động ở 5 mốc quan trọng trong `src/lib/mailer.ts`.
- [x] Bổ sung 14 unit tests trong `tests/unit/csrf-vnpay-email.test.ts`.

## 4. Gói R4: Chuẩn Hóa RBAC Phương Án B & AI Agent Workspace
- [x] Cập nhật ma trận phân quyền `docs/RBAC.md` theo Phương án B (2 vai trò admin người thật `SUPER_ADMIN` và `OPERATOR`).
- [x] Xây dựng Core Engine 4 AI Agent chuyên trách tại `src/features/ai-workspace/`:
  - [x] Purchasing Agent (`purchasing-agent.ts`)
  - [x] Quarantine Agent (`quarantine-agent.ts`)
  - [x] Financial Audit Agent (`financial-audit-agent.ts`)
  - [x] Executive Assistant Agent (`executive-assistant-agent.ts`)
  - [x] Workspace Orchestrator (`agent-orchestrator.ts`)
- [x] Xây dựng API quản trị `/api/admin/ai-workspace/overview` và `/api/admin/ai-workspace/execute`.
- [x] Xây dựng giao diện Multi-Agent Mission Control Canvas `AiAgentWorkspaceTab.tsx` tích hợp trên `src/app/admin/page.tsx`.
- [x] Bổ sung 17 unit tests trong `tests/unit/ai-workspace.test.ts`.
- [x] Hoàn thiện cẩm nang thuyết trình bảo vệ đồ án 6 bước tại `docs/demo-ai-workspace.md`.

## 5. Nghiệm Thu & Kiểm Thử Toàn Diện (Milestone M5)
- [x] 100% Vitest Unit Tests: 510/510 tests passed (65/65 files).
- [x] 100% PostgreSQL Localhost Integration Tests: 196/196 tests passed (17/17 files).
- [x] TypeScript Strict (`tsc --noEmit`): 0 lỗi.
- [x] Next.js Lint (`next lint`): 0 lỗi.
- [x] Next.js Production Build: Biên dịch tối ưu thành công 19/19 trang tĩnh.
- [x] Rà soát toàn diện luồng nghiệp vụ & logic vận hành: 22 probe tests xác nhận 0 lỗi / 0 xung đột quy trình (`tests/unit/business-flow-audit.test.ts`).
- [x] Kiểm toán độc lập Victory Audit: Phán quyết **VICTORY CONFIRMED**.
