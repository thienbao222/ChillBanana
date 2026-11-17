# ChillBanana — Baseline Kiểm thử và Hiện trạng Kỹ thuật

**Ngày ghi nhận:** 04/11/2026  
**Môi trường:** Windows x64 · Node.js v24.22.1 · pnpm 11.25.0 · Next.js 15.5.27 · TypeScript 5.9.3 · Prisma 5.22.0 · Vitest 3.2.7  
**Mã gói việc:** WP0.1  

---

## 1. Kết quả kiểm thử đường cơ sở (Baseline Test Results)

### 1.1 Unit Test Suite (`vitest run`)
- **Lệnh thực thi:**
  ```powershell
  node ./node_modules/vitest/vitest.mjs run
  ```
- **Kết quả:**
  - **Test Files:** 38 passed (38 / 38)
  - **Tests:** 290 passed (290 / 290)
  - **Failed:** 0
  - **Thời gian chạy:** 7.48s (setup 0ms, collect 35.02s, tests 3.56s)
- **Danh sách 38 test files unit đã kiểm chứng:**
  - `tests/unit/add-to-cart-chat.test.ts` (5 tests)
  - `tests/unit/admin-ai-action-items-and-email.test.ts` (13 tests)
  - `tests/unit/admin-new-order-email.test.ts` (4 tests)
  - `tests/unit/admin-send-customer-email.test.ts` (6 tests)
  - `tests/unit/admin-tab-routing.test.ts` (12 tests)
  - `tests/unit/api-key-manager-and-assistant.test.ts` (3 tests)
  - `tests/unit/api-key-model-selection.test.ts` (3 tests)
  - `tests/unit/assistant-system-instruction.test.ts` (6 tests)
  - `tests/unit/auth-session.test.ts` (13 tests)
  - `tests/unit/cart-add-persistence.test.ts` (3 tests)
  - `tests/unit/catalog-search-no-fake.test.ts` (5 tests)
  - `tests/unit/catalog-search-ranking.test.ts` (8 tests)
  - `tests/unit/chat-add-to-cart-accuracy.test.ts` (5 tests)
  - `tests/unit/chat-budget-recommendations.test.ts` (4 tests)
  - `tests/unit/chat-history-merge.test.ts` (11 tests)
  - `tests/unit/chat-language-matching.test.ts` (9 tests)
  - `tests/unit/chat-multi-intent.test.ts` (4 tests)
  - `tests/unit/chat-quick-replies.test.ts` (5 tests)
  - `tests/unit/chat-session-preferences.test.ts` (5 tests)
  - `tests/unit/exchange-rate.test.ts` (8 tests)
  - `tests/unit/image-url.test.ts` (5 tests)
  - `tests/unit/intent-router.test.ts` (4 tests)
  - `tests/unit/japanese-keyword-extraction.test.ts` (11 tests)
  - `tests/unit/model-quota.test.ts` (10 tests)
  - `tests/unit/neo-model-routing.test.ts` (3 tests)
  - `tests/unit/news.test.ts` (3 tests)
  - `tests/unit/order-item-source.test.ts` (13 tests)
  - `tests/unit/order-rollback.test.ts` (6 tests)
  - `tests/unit/password.test.ts` (7 tests)
  - `tests/unit/payment-provider.test.ts` (5 tests)
  - `tests/unit/policies.test.ts` (10 tests)
  - `tests/unit/pricing.test.ts` (13 tests)
  - `tests/unit/quota-system-comprehensive.test.ts` (8 tests)
  - `tests/unit/rate-limit.test.ts` (8 tests)
  - `tests/unit/ssrf.test.ts` (4 tests)
  - `tests/unit/support-policy.test.ts` (35 tests)
  - `tests/unit/vietnam-time.test.ts` (6 tests)
  - `tests/unit/vnpay-signature.test.ts` (6 tests)

### 1.2 Typecheck (`tsc --noEmit`)
- **Lệnh thực thi:**
  ```powershell
  node ./node_modules/typescript/bin/tsc --noEmit
  ```
- **Kết quả:** Exit code 0, không có lỗi type nào trong toàn bộ dự án.

### 1.3 Linter (`next lint`)
- **Lệnh thực thi:**
  ```powershell
  node ./node_modules/next/dist/bin/next lint
  ```
- **Kết quả:** Exit code 0, 0 error.
- **Cảnh báo có sẵn (không chặn build):**
  - `@typescript-eslint/no-explicit-any` tại một số component admin và helper AI.
  - `@next/next/no-img-element` thay cho `<Image />` tại giao diện hiển thị ảnh sàn Nhật.
  - `@typescript-eslint/no-unused-vars` tại một số tham số và import chưa dùng.

### 1.4 Production Build (`next build`)
- **Lệnh thực thi:**
  ```powershell
  $env:NEXT_CPU_COUNT="1"; node ./node_modules/prisma/build/index.js generate; node ./node_modules/next/dist/bin/next build
  ```
- **Kết quả:** Thành công 100%, sinh toàn bộ 18 static & dynamic routes.
- **Ghi chú môi trường Windows:** Đặt `NEXT_CPU_COUNT=1` ngăn chặn lỗi transient `EPERM: operation not permitted, mkdir` do webpack worker song song tranh chấp filesystem trên Windows.

### 1.5 Integration Tests (`tests/integration`)
- **Lệnh dự kiến:**
  ```powershell
  node ./node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts
  ```
- **Trạng thái:** **Chờ cấp Neon Test Branch riêng**.
- **Lý do bảo vệ an toàn:** Theo chốt an toàn `tests/helpers/safety.ts`, integration tests thực hiện reset toàn bộ cơ sở dữ liệu (`TRUNCATE`/`DELETE`). Database trong `.env` hiện tại trỏ tới Neon host của dự án. Theo nguyên tắc bất biến không đụng DB khi chưa được phê duyệt rõ ràng, bước này sẽ được bổ sung ngay khi có test database chuyên dụng kèm biến `ALLOW_TEST_DB_RESET=1`.

---

## 2. Kết luận đường cơ sở
- Trạng thái mã nguồn hiện tại ở commit `main` là **sạch (clean), build xanh, unit test đạt 100% (290/290)**.
- Mọi gói công việc tiếp theo từ WP0.2 trở đi đều phải bảo đảm không làm suy giảm hoặc phá vỡ các kết quả kiểm thử đường cơ sở này.

