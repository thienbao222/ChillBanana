# Báo Cáo Chụp Nền Dự Án (Baseline) — Pha 0

- **Ngày ghi nhận:** 17/11/2026
- **Nhánh thực hiện:** `agent/re-architect-foundation`
- **Commit gốc chụp nền:** `050b8ef` (`chore(baseline): snapshot initial state before audit`)
- **Hệ thống chạy kiểm tra:** Windows PowerShell, Node.js v20+, Next.js 15.5.27, Vitest v3.2.7, Prisma v5.22.0

---

## 1. Kết Quả Kiểm Tra Kỹ Thuật Ban Đầu

| Hạng mục kiểm tra | Lệnh thực thi | Kết quả | Chi tiết / Đánh giá |
| :--- | :--- | :---: | :--- |
| **Git Snapshot** | `git checkout -b agent/re-architect-foundation` & `git commit` | **ĐẠT** | Toàn bộ 105 files (gồm các uncommitted files và untracked work) đã được chụp vào commit `050b8ef`. Không đụng `main`. |
| **Prisma Schema** | `node ./node_modules/prisma/build/index.js validate` | **ĐẠT** | Schema Prisma hợp lệ. Prisma client generate thành công trong 186ms. |
| **Typecheck** | `node ./node_modules/typescript/bin/tsc --noEmit` | **ĐẠT** | 0 lỗi TypeScript strict trên toàn bộ dự án (`exit code 0`). |
| **Lint** | `node ./node_modules/next/dist/bin/next lint` | **1 LỖI / NHIỀU CẢNH BÁO** | Bị 1 lỗi `no-html-link-for-pages` tại `src/app/dat-hang/nhap/page.tsx:94:11` (`<a>` thay vì `<Link>`). Kèm các cảnh báo về `any`, `unused-vars`, `<img>`. |
| **Unit Tests** | `node ./node_modules/vitest/vitest.mjs run` | **ĐẠT** | **58/58 test files** passed (100%), **399/399 unit tests** passed trong 5.96s. |
| **Production Build** | `$env:NEXT_CPU_COUNT="1"; node ./node_modules/next/dist/bin/next build` | **ĐẠT** | Build production biên dịch thành công, tạo đủ 21 routes tĩnh/động, thu thập build traces sạch sẽ (`exit code 0`). |
| **Integration Tests** | `$env:ALLOW_TEST_DB_RESET="1"; ... vitest.integration.config.ts` | **CHƯA CHẠY** | Chưa chạy trên môi trường cục bộ do chưa có instance PostgreSQL localhost độc lập được thiết lập cho test integration. |

---

## 2. Tổng Quan Hiện Trạng Kiến Trúc

- **Khung ứng dụng:** Next.js 15 App Router, TypeScript strict.
- **ORM & Database:** Prisma kết nối PostgreSQL (mô hình Neon trong production/preview, dev/test dùng mock/local).
- **Trạng thái mô phỏng (Demo Mode):** Đang bật nhiều cờ mô phỏng (`src/lib/demo-mode.ts`, `MOCK` payment provider, `mock-sandbox`, `mock-transition`).
- **Thử thách lớn nhất:** Hệ thống đã qua nhiều vòng vá víu bởi AI từ các giai đoạn trước, dẫn đến sự phân mảnh giữa các route mock/demo và logic production, cấu hình hardcode phân tán, và nguy cơ thất thoát tiền/lệch trạng thái nếu mở bán thật mà không dọn dẹp triệt để.

---

## 3. Kết Luận Pha 0

Nền tảng mã nguồn hiện tại biên dịch tốt, hệ thống unit tests sẵn có (399 tests) đang bảo vệ khá tốt các hàm thuần. Tuy nhiên, các lỗ hổng bảo mật và mâu thuẫn nghiệp vụ tiền tệ, trạng thái và phân quyền đang tiềm ẩn trong các API routes và logic nghiệp vụ. Dự án đủ điều kiện an toàn để chuyển sang **Pha 1: Rà soát chỉ đọc**.
