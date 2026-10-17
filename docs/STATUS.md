# Trạng thái dự án và tiến độ nâng cấp

Cập nhật: 17/10/2026 · Giai đoạn 0–2 đã merge vào `main` (PR #4) và chạy trên production; Giai đoạn 3 đang triển khai trên nhánh codex/phase3-simulated-services-20261017 · Kế hoạch gốc: `NangCapFinal.docx`

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
| Nhật ký kiểm toán `AuditLog` | 🟡 | Ghi các thao tác admin và purchase task; tab xem nhật ký/API chỉ cho Super Admin, phân trang và lọc. Chưa xác nhận các integration test mới trên CI. |
| Kiểm tra quyền ở backend | 🟡 | `requireAdmin` đối chiếu AdminUser trong DB và kiểm tra vai trò (chỉ SUPER_ADMIN cho `api-keys`, `stitch-all`). Test phân quyền cho các route admin hiện có. Mọi route admin và route dùng chung (orders, products) giờ đối chiếu AdminUser trong DB nên tài khoản bị xóa mất quyền ngay (test `admin-session-revocation`). Vai trò (SUPER_ADMIN/OPERATOR) mới được phân biệt ở các route nhạy cảm; các route còn lại cho cả hai vai trò. |
| Tài liệu migration và backup/restore | ✅ viết / ⏳ diễn tập | `docs/DATABASE_MIGRATIONS.md`, `docs/BACKUP_RESTORE.md`. Chưa diễn tập khôi phục thật. |

### Giai đoạn 2: Kiểm thử luồng lõi

| Hạng mục | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- |
| Hạ tầng test (Vitest + PostgreSQL + Playwright) | ✅ | `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run test:all`. CI dùng PostgreSQL container. |
| Unit test | ✅ | 44 test: tính giá (làm tròn, phí tối thiểu, gộp đơn, ngưỡng), tiền cọc, chính sách đơn/thanh toán, chữ ký VNPAY, tỷ giá (stale/dự phòng), hash, rate limit. |
| Integration test (PostgreSQL thật) | ✅ | 136 test: tạo đơn (hợp lệ/không hợp lệ, hết tồn kho, rollback, tỷ giá stale), truy cập đơn (khách/guest/admin), IPN VNPAY (đúng/sai chữ ký, sai số tiền, gọi lặp), hết hạn giữ hàng, đăng nhập/đăng ký khách và admin, phân quyền, cron cần `CRON_SECRET`. |
| End-to-end (server production thật) | ✅ | 18 test Playwright: vòng đời đơn guest (đặt → tra cứu → chuyển khoản → 6 bước → hoàn tất), VNPAY, tranh suất cuối, hủy đơn hoàn kho, bảo mật HTTP, tải 8 trang chính. |
| Test xử lý đồng thời | ✅ | 20 yêu cầu cùng vào 5 suất: đúng 5 đơn thành công; hai yêu cầu vào suất cuối: chỉ một thành công (tồn kho = 0); hai IPN VNPAY đồng thời: chỉ một giao dịch được ghi; hai lần chạy cron hết hạn: hoàn kho một lần. |

## 2. Hiện trạng trước Giai đoạn 3

| Chức năng | Trạng thái | Ghi chú |
| --- | --- | --- |
| Catalog, giỏ hàng, kiểm tra tồn kho | Đã có, có test | Dữ liệu seed là demo (`curated-products.json`), chưa gắn nhãn nguồn dữ liệu. |
| Báo giá, tỷ giá | Đã có, có rủi ro | Server tự lấy tỷ giá; stale thì từ chối tạo đơn (có test). Ở thời điểm rà soát ban đầu, hằng số giá còn nằm trong code; nguồn dự phòng có USD/VND 25400 hard-code. Cache trong bộ nhớ từng instance. |
| Tạo đơn | Đã có, có test | Transaction, trừ tồn kho nguyên tử, giữ hàng và cron hết hạn. |
| Thanh toán VNPAY (sandbox) | Đã có, có test | IPN xác thực chữ ký, so số tiền, chống xử lý lặp. Tại thời điểm rà soát ban đầu, giao dịch thất bại chưa được ghi lại và chưa có mock provider. |
| Chuyển khoản thủ công (admin xác nhận) | Đã có, có test | Kiểm tra số tiền khớp, quyền qua DB, audit. |
| Hủy đơn / hoàn tiền | Đã có một phần | Hủy đơn hoàn kho trong transaction (có test). Chưa có hoàn tiền qua provider. |
| Tracking, vận chuyển | Đã có (mô phỏng) | Chưa tách interface provider. |
| Email | Đã có | Chưa cấu hình SMTP thì chỉ log "Mailer Sim". Tại thời điểm rà soát ban đầu chưa có retry và `EmailLog`. |
| Tài khoản khách, xác minh email | Đã có, có test | Có giới hạn đăng nhập sai. Chưa có quên mật khẩu. |
| Trang quản trị | Đã có | Sản phẩm, đơn, khách, báo cáo, AI, mua hàng. Chưa có test giao diện admin. |
| Chatbot AI, trợ lý admin, báo cáo AI | Đã có | Có bộ eval (`npm run eval:customer-support`). Rate limit chat AI vẫn trong bộ nhớ. `/api/scrape-link` có giới hạn bền vững theo IP để giảm rủi ro chi phí; chờ CI xác nhận integration test. |

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

## 5. Giai đoạn 3 — cấu hình giá, thanh toán thử nghiệm và email

| Hạng mục | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- |
| Giá cấu hình có lịch sử | 🟡 | Đã thêm PricingConfig, API chỉ cho Super Admin ghi, giao diện lịch sử/điều chỉnh và ảnh chụp phiên bản trên đơn. Migration và kiểm thử PostgreSQL chờ CI xác nhận. |
| Đồng bộ cấu hình giá | 🟡 | Storefront, giỏ, tạo đơn, duyệt giá, báo giá AI, tỷ giá fallback và ước tính trong quản trị dùng chung cấu hình. Lưu lại cùng giá trị hiện hành không sinh phiên bản/audit giả. Chờ kiểm thử CI. |
| Provider thanh toán mock/sandbox/live | 🟡 | Mock là mặc định; VNPAY sandbox cần bật tường minh và URL allowlist; live bị khóa. Kết quả mock/sandbox chỉ ghi PaymentAttempt và tracking log, không đánh dấu đơn đã trả, không tạo doanh thu/thanh toán thật, không mở bước mua hàng. Chờ integration CI xác nhận callback và chống lặp. |
| EmailLog và retry | 🟡 | Có nhật ký không lưu địa chỉ nhận/nội dung thư, SMTP opt-in, thử tối đa 3 lần mỗi lượt và Super Admin có thể yêu cầu thử lại (tối đa 9 lần). Chưa có cron retry. Chờ integration CI xác nhận. |
| Giao diện quản trị | ✅ | Tab Super Admin “Cài đặt nghiệp vụ” gồm bảng giá có phiên bản, trạng thái dịch vụ và nhật ký email. |
| Kiểm chứng cục bộ | 🟡 | `npm ci`, Prisma generate/validate, typecheck, build, lint, 51/51 unit test và AI eval đạt. Lint còn cảnh báo có sẵn. Integration/E2E chưa chạy cục bộ vì không có PostgreSQL tại localhost:5432; cần CI xác nhận trên DB tạm. Build local dùng DATABASE_URL giả trỏ loopback và không kết nối Neon. |

## 6. Việc còn lại

1. **Tách database cho Preview**: `DATABASE_URL` đang dùng chung Production và Preview. Tạo branch Neon `dev` và đặt riêng cho Preview.
2. **Diễn tập khôi phục** từ backup rồi ghi kết quả vào `docs/BACKUP_RESTORE.md`.
3. Hoàn thành test PostgreSQL/Playwright trên CI cho Giai đoạn 3; sau khi nhánh được merge, Production migration sẽ chạy trong Vercel Production build.
4. **Giai đoạn 4**: phần triển khai đã có trong working tree; cần chạy CI để xác nhận các integration test mới trước khi merge.

## 7. Giai đoạn 4 — nhật ký và bảo vệ API tốn chi phí

| Hạng mục | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- |
| Giới hạn `/api/scrape-link` | 🟡 | 10 yêu cầu/IP trong 10 phút; bộ đếm dùng bảng `RateLimit` hiện có và chỉ lưu hash SHA-256 của IP. Quá ngưỡng trả HTTP 429 cùng `Retry-After`. Integration test đã thêm; chưa chạy do không dùng database production cho test phá hủy dữ liệu. |
| Màn hình nhật ký kiểm toán | 🟡 | Tab “Nhật ký kiểm toán” và API chỉ cho `SUPER_ADMIN`; phân trang 50 dòng, lọc theo tên thao tác. Không trả IP hoặc metadata nội bộ cho giao diện. Integration test quyền và lọc dữ liệu đã thêm; chờ CI. |
| Audit tác vụ mua hộ | 🟡 | Ghi sự kiện sau khi tạo task và sau khi cập nhật trạng thái thành công; không đưa link sản phẩm, mã đơn, mã ngoài hoặc thông tin khách vào metadata. Integration test đã thêm; chờ CI. |
| Kiểm tra cục bộ | 🟡 | `npm run typecheck`, `npm run build`, `npm run lint`, `npm test` đạt (52 unit test); AI eval và Prisma validate đạt; lint còn cảnh báo có sẵn. Integration test cần PostgreSQL test riêng/CI; không chạy trên Neon production. |
