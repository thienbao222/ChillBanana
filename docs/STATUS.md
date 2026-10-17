# Trạng thái dự án và tiến độ nâng cấp

Cập nhật: 16/10/2026 · Nhánh `feat/phase-0-1-safety-foundation` (PR #4, draft) · Kế hoạch gốc: `NangCapFinal.docx`

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
| Migration thay cho `db push` khi deploy | ✅ | `vercel-build.js` production chạy `prisma migrate deploy`; `prisma:push` bị chặn (cần `ALLOW_DB_PUSH=1`, từ chối trên production). CI áp dụng toàn bộ migration lên DB trống và kiểm tra **không lệch** so với `schema.prisma`. |
| Baseline migration `0_init` | ✅ tạo / ⏳ đánh dấu | Đã sinh bằng Prisma trên CI từ schema ở `ef9e20c` (12 bảng). **Còn phải đánh dấu đã áp dụng trên database có dữ liệu** (`docs/DATABASE_MIGRATIONS.md`). Nếu quên: `migrate deploy` trên production báo lỗi P3005 và build Vercel thất bại, bản cũ vẫn chạy (thất bại an toàn). |
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

### Giai đoạn 3: Cấu hình nghiệp vụ và lớp provider (nhánh `feat/phase-3-pricing-providers`)

| Hạng mục | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- |
| Cấu hình môi trường tập trung, production từ chối provider mock / thiếu biến | 🟡 | `src/lib/env.ts`, `scripts/env-rules.js` (build production dừng nếu thiếu biến bắt buộc, `PAYMENT_PROVIDER=mock`, `APP_ENV=test`, URL không https). Test `tests/unit/env-rules.test.ts`. **Lưu ý:** production giờ bắt buộc có `NEXT_PUBLIC_APP_URL` (https). |
| Cấu hình giá có lịch sử (`PricingConfig`) | 🟡 | Phí mua hộ, phí tối thiểu, cước/kg, giảm cước gộp đơn, ngưỡng đơn tối thiểu, thời gian giữ hàng đọc từ database; mặc định trong code khi chưa có bản ghi. Mỗi lần lưu là một dòng mới (không sửa bản cũ), có ngày hiệu lực, người đổi, ghi chú, audit `PRICING_CONFIG_CREATED`. Tab "Cấu hình giá" trong trang admin (chỉ SUPER_ADMIN được lưu). Giao diện khách ước tính theo `/api/pricing-config`. |
| Snapshot giá theo đơn | 🟡 | `Order.pricingSnapshot`: cấu hình, tỷ giá + nguồn + thời điểm, khoản tính và cờ gộp đơn tại lúc tạo đơn. Đơn cũ không bị đổi khi đổi cấu hình (có test). Đơn tạo trước Giai đoạn 3 không có snapshot. |
| Tỷ giá | 🟡 | Mỗi lần lấy tỷ giá thật được lưu vào `ExchangeRateSnapshot`. USD/VND dự phòng đọc từ `USD_VND_REFERENCE_RATE` (mặc định 25400) và nguồn dự phòng ghi rõ là tỷ giá chéo. Chính sách stale thì từ chối tạo đơn giữ nguyên. Hook tỷ giá cố định cho test (`APP_ENV=test`) vẫn còn, chưa chuyển thành provider riêng. |
| Provider thanh toán (`PaymentProvider`) | 🟡 | `MockPaymentProvider` (thành công, thất bại, pending, timeout, hủy, webhook trùng, hoàn tiền) và `VnpayProvider` (sandbox/live). Chọn bằng `PAYMENT_PROVIDER`. Route `/api/payment/mock-callback` chỉ hoạt động ở chế độ mock. |
| Ghi giao dịch thất bại | 🟡 | `PaymentTransaction` có thêm trạng thái PENDING, FAILED, CANCELLED, TIMEOUT; IPN VNPAY thất bại được lưu (không đổi đơn); chống ghi trùng. |
| Hoàn tiền | 🟡 | `POST /api/admin/orders/[id]/refund` (SUPER_ADMIN, audit `ORDER_REFUNDED`), chỉ cho đơn đã hủy và đã thanh toán. Hoàn tiền mô phỏng hoạt động; **VNPAY chưa tích hợp hoàn tiền tự động** (báo rõ để hoàn thủ công). |
| `EmailLog` và thử lại | 🟡 | Mọi email đi qua `deliverEmail`: SIMULATED (chưa có SMTP, không gửi gì), SENT, FAILED, tối đa 3 lần thử. Không lưu nội dung email. Chưa có hàng đợi bền hay cron gửi lại: lỗi sau 3 lần thử chỉ được ghi log. `sendPriceApprovedEmail` trả `true` chỉ khi SMTP thật sự nhận. |
| `ShippingProvider` | 🟡 | Interface + `MockShippingProvider` (báo cước theo cấu hình giá, vận đơn và hành trình mô phỏng, luôn gắn `isSimulated`). Chưa nối vào luồng đơn hàng thật. |

Trạng thái 🟡: đã viết và có test, chờ GitHub Actions xác nhận trước khi đổi sang ✅.

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

## 4. Việc bạn cần làm trước khi merge vào nhánh chính

1. **Sao lưu production** (Neon branch và/hoặc `pg_dump`, xem `docs/BACKUP_RESTORE.md`).
2. **Đánh dấu baseline trên database production**: làm đúng 3 bước trong `docs/DATABASE_MIGRATIONS.md` (sao lưu, kiểm tra schema khớp bằng `migrate diff`, rồi `migrate resolve --applied 0_init`). Nếu `migrate diff` báo khác biệt thì dừng và gửi kết quả. Ngoại lệ chấp nhận được: duy nhất bảng mẫu `playing_with_neon` do Neon tự tạo (mã thoát 2, mục "Removed tables"); đã gặp trên production ngày 16/10/2026, không ảnh hưởng migration.
3. Kiểm tra biến môi trường Vercel: Production có `DATABASE_URL`, **`DIRECT_URL` (chuỗi kết nối trực tiếp của Neon, host không có `-pooler`)**, `ADMIN_SESSION_SECRET`, `CUSTOMER_SESSION_SECRET`, `CRON_SECRET`, **không** có `ADMIN_INITIAL_PASSWORD`; Preview dùng database riêng.
4. Chuyển PR #4 từ Draft sang Ready và merge; Vercel production sẽ chạy `prisma migrate deploy`.
5. Sau deploy: đăng nhập admin một lần để hash mật khẩu nâng cấp lên scrypt; kiểm tra `AuditLog` có dòng `ADMIN_PASSWORD_REHASHED`.
6. (Nên làm) Tạo database Neon development riêng và diễn tập khôi phục; ghi kết quả vào `docs/BACKUP_RESTORE.md`.
