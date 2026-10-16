# Trạng thái dự án và tiến độ nâng cấp

Cập nhật: 16/10/2026 · Giai đoạn 0–2 đã merge vào `main` (PR #4) và chạy trên production; sửa lỗi hồ sơ nhân đôi ở PR #5 · Kế hoạch gốc: `NangCapFinal.docx`

Chú thích: ✅ xong và đã kiểm chứng · 🟡 đã làm nhưng chưa kiểm chứng đầy đủ · ⏳ cần bạn thực hiện · ⬜ chưa làm

## 1. Tiến độ theo giai đoạn

### Giai đoạn 0: Rà soát và nền tảng

| Hạng mục | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- |
| Rà soát repo, lập bảng hiện trạng (mục 2) | 🟡 | Đã đọc kỹ xác thực, đơn hàng, thanh toán, tỷ giá, seed, schema, build. Chưa đọc kỹ toàn bộ giao diện và module AI. |
| Chạy `tsc`, `prisma validate`, `lint`, `build` | ✅ | GitHub Actions (PR #4) chạy và đạt. |
| Dọn repo | ✅ | Bỏ `tsconfig.tsbuildinfo` khỏi git; chuyển `GhiChu.txt` sang `docs/notes/`; chuyển báo cáo giữa kỳ `.docx` và `generate_academic_report.py` sang `docs/academic/`. Hai file roadmap AI khác ngôn ngữ và nội dung nên được giữ nguyên. |
| GitHub Actions CI | ✅ | `.github/workflows/ci.yml` có PostgreSQL thật; xanh toàn bộ (mục 3). Tự đăng báo cáo kết quả lên PR. |
| Database dev/staging riêng | ⏳ | Cần tạo branch Neon riêng và xác nhận `DATABASE_URL` cục bộ không trỏ production. |

### Giai đoạn 1: An toàn dữ liệu và bảo mật tài khoản

| Hạng mục | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- |
| Migration thay cho `db push` khi deploy | ✅ Đã chạy trên production | `vercel-build.js` production chạy `prisma migrate deploy`; `prisma:push` bị chặn (cần `ALLOW_DB_PUSH=1`, từ chối trên production). CI áp dụng toàn bộ migration lên DB trống và kiểm tra **không lệch** so với `schema.prisma`. |
| Baseline migration `0_init` | ✅ | Sinh bằng Prisma trên CI từ schema ở `ef9e20c` (12 bảng). Đã đánh dấu đã áp dụng trên production ngày 16/10/2026 sau khi `migrate diff` chỉ khác bảng mẫu `playing_with_neon` của Neon (không thuộc schema). |
| Hash mật khẩu admin sang scrypt | ✅ | Unit test + integration test với PostgreSQL thật: hash HMAC cũ đăng nhập được và tự nâng cấp; hash mới là `scrypt$...`. |
| Giới hạn đăng nhập sai (admin, khách) và đăng ký | ✅ | Integration test: khóa sau 5 lần sai (kể cả nhập đúng sau đó), khóa theo IP, đăng nhập đúng xóa bộ đếm, đăng ký tối đa 10 lần/giờ/IP. |
| Nhật ký kiểm toán `AuditLog` | 🟡 | Ghi: đăng nhập/đăng xuất/đăng nhập sai admin, tạo/sửa/xóa sản phẩm, ghi nhận chuyển khoản, duyệt giá, đổi trạng thái/hủy đơn, gộp dữ liệu khách; có test. Chưa có màn hình xem nhật ký. Chưa ghi cho `purchase-tasks`. |
| Kiểm tra quyền ở backend | 🟡 | `requireAdmin` đối chiếu AdminUser trong DB và kiểm tra vai trò (chỉ SUPER_ADMIN cho `api-keys`, `stitch-all`). Test phân quyền cho các route admin hiện có. Các route admin còn lại vẫn dùng `isAdminRequest` (chưa kiểm tra vai trò). |
| Tài liệu migration và backup/restore | ✅ viết / ⏳ diễn tập | `docs/DATABASE_MIGRATIONS.md`, `docs/BACKUP_RESTORE.md`. Chưa diễn tập khôi phục thật. |

### Giai đoạn 2: Kiểm thử luồng lõi

| Hạng mục | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- |
| Hạ tầng test (Vitest + PostgreSQL + Playwright) | ✅ | `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run test:all`. CI dùng PostgreSQL container. |
| Unit test | ✅ | 44 test: tính giá (làm tròn, phí tối thiểu, gộp đơn, ngưỡng), tiền cọc, chính sách đơn/thanh toán, chữ ký VNPAY, tỷ giá (stale/dự phòng), hash, rate limit. |
| Integration test (PostgreSQL thật) | ✅ | 136 test: tạo đơn (hợp lệ/không hợp lệ, hết tồn kho, rollback, tỷ giá stale), truy cập đơn (khách/guest/admin), IPN VNPAY (đúng/sai chữ ký, sai số tiền, gọi lặp), hết hạn giữ hàng, đăng nhập/đăng ký khách và admin, phân quyền, cron cần `CRON_SECRET`. |
| End-to-end (server production thật) | ✅ | 18 test Playwright: vòng đời đơn guest (đặt → tra cứu → chuyển khoản → 6 bước → hoàn tất), VNPAY, tranh suất cuối, hủy đơn hoàn kho, bảo mật HTTP, tải 8 trang chính. |
| Test xử lý đồng thời | ✅ | 20 yêu cầu cùng vào 5 suất: đúng 5 đơn thành công; hai yêu cầu vào suất cuối: chỉ một thành công (tồn kho = 0); hai IPN VNPAY đồng thời: chỉ một giao dịch được ghi; hai lần chạy cron hết hạn: hoàn kho một lần. |

## 2. Hiện trạng từng chức năng

| Chức năng | Trạng thái | Ghi chú |
| --- | --- | --- |
| Catalog, giỏ hàng, kiểm tra tồn kho | Đã có, có test | Dữ liệu seed là demo (`curated-products.json`), chưa gắn nhãn nguồn dữ liệu. |
| Báo giá, tỷ giá | Đã có, có rủi ro | Server tự lấy tỷ giá; stale thì từ chối tạo đơn (có test). Hằng số giá còn nằm trong code; nguồn dự phòng có USD/VND 25400 hard-code. Cache trong bộ nhớ từng instance. |
| Tạo đơn | Đã có, có test | Transaction, trừ tồn kho nguyên tử, giữ hàng và cron hết hạn. |
| Thanh toán VNPAY (sandbox) | Đã có, có test | IPN xác thực chữ ký, so số tiền, chống xử lý lặp. Giao dịch thất bại chưa được ghi lại. Chưa có mock provider (Giai đoạn 3). |
| Chuyển khoản thủ công (admin xác nhận) | Đã có, có test | Kiểm tra số tiền khớp, quyền qua DB, audit. |
| Hủy đơn / hoàn tiền | Đã có một phần | Hủy đơn hoàn kho trong transaction (có test). Chưa có hoàn tiền qua provider. |
| Tracking, vận chuyển | Đã có (mô phỏng) | Chưa tách interface provider. |
| Email | Đã có | Chưa cấu hình SMTP thì chỉ log "Mailer Sim". Chưa có retry và `EmailLog`. |
| Tài khoản khách, xác minh email | Đã có, có test | Có giới hạn đăng nhập sai. Chưa có quên mật khẩu. |
| Trang quản trị | Đã có | Sản phẩm, đơn, khách, báo cáo, AI, mua hàng. Chưa có test giao diện admin. |
| Chatbot AI, trợ lý admin, báo cáo AI | Đã có | Chỉ có bộ eval sẵn (`npm run eval:customer-support`). Rate limit AI trong bộ nhớ. `/api/scrape-link` công khai, gọi Gemini, chưa có giới hạn tần suất: **rủi ro chi phí**, xử lý ở Giai đoạn 4. |

## 3. Kết quả kiểm tra (GitHub Actions, commit `10d97c0`)

| Bước | Kết quả |
| --- | --- |
| Cài đặt, Prisma validate | ✅ |
| Migration trên DB trống (0_init + phase1) | ✅ |
| Migration khớp `schema.prisma` (không lệch) | ✅ |
| Type check, Lint | ✅ |
| Unit test | ✅ 44/44 |
| Eval AI | ✅ |
| Integration test (PostgreSQL) | ✅ 136/136 |
| Build | ✅ |
| E2E Playwright | ✅ 18/18 |

Lưu ý khi đọc kết quả:
- Con số độ phủ của `test:coverage` (unit) chỉ phản ánh phần unit test; phần lớn route được kiểm bằng integration/e2e nên chưa có báo cáo độ phủ gộp.
- Trong quá trình làm, 2 test lỗi do **test sai** (không phải code sai): token base64 thêm ký tự cuối vẫn hợp lệ nên test giả mạo token phải đổi payload/chữ ký; test vòng đời đơn đếm thiếu log "ghi nhận chuyển khoản". Cả hai đã sửa.
- Thay đổi duy nhất trong code production vì test: `fetchLiveExchangeRate` có hook tỷ giá cố định, **chỉ bật khi `APP_ENV=test`** và bị tắt trên Vercel production (`src/features/pricing/exchange-rate.ts`). Sẽ thay bằng lớp provider ở Giai đoạn 3.
- Test tự từ chối chạy nếu `DATABASE_URL` không trỏ về máy cục bộ (trừ khi `ALLOW_TEST_DB_RESET=1`), vì chúng xóa dữ liệu (`tests/helpers/safety.ts`).
- **Chưa kiểm chứng:** chạy migration trên database Neon thật của bạn, luồng với dữ liệu production, diễn tập khôi phục.

## 4. Việc đã làm khi đưa lên production (16/10/2026)

| Việc | Kết quả |
| --- | --- |
| Sao lưu bằng Neon branch `backup-truoc-migrate-16-10` | ✅ Hết hạn 23/10/2026; giữ đến khi web ổn vài ngày |
| Đánh dấu baseline `0_init` trên production | ✅ `migrate resolve --applied 0_init`; `migrate status` chỉ còn `20261015000100_phase1_security` chờ |
| Biến môi trường Vercel | ✅ Thêm `DIRECT_URL` (chỉ Production, host không `-pooler`); có `ADMIN_SESSION_SECRET`, `CUSTOMER_SESSION_SECRET`, `CRON_SECRET`; không có `ADMIN_INITIAL_PASSWORD` |
| Merge PR #4 và deploy | ✅ Bảng `AuditLog` đã có trên production, nên migration phase1 đã chạy |
| Đăng nhập admin sau deploy | ✅ `AuditLog` có `ADMIN_PASSWORD_REHASHED`, `ADMIN_LOGIN`, `ORDER_PRICE_APPROVED`; hash của `admin` bắt đầu bằng `scrypt$` |
| Lỗi giao diện trang Hồ sơ nhân đôi thanh đầu trang và mascot | ✅ Sửa ở PR #5 (bỏ `LayoutWrapper` lồng nhau), người dùng xác nhận đã ổn |

## 5. Việc còn lại

1. **Tách database cho Preview**: `DATABASE_URL` đang dùng chung Production và Preview. Tạo branch Neon `dev` và đặt riêng cho Preview.
2. **Diễn tập khôi phục** từ backup rồi ghi kết quả vào `docs/BACKUP_RESTORE.md`.
3. **Giai đoạn 3**: bảng giá cấu hình có lịch sử, lớp thanh toán mock/sandbox/live, `EmailLog`.
4. **Giai đoạn 4**: giới hạn tần suất `/api/scrape-link`, màn hình xem nhật ký kiểm toán, ghi audit cho `purchase-tasks`.
