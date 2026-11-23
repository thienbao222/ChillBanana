# Trạng thái dự án và tiến độ nâng cấp

Cập nhật: 04/11/2026 · **ĐÃ HOÀN TẤT TOÀN DIỆN 8 GIAI ĐOẠN / 21 WORK PACKAGES (WP0.1 ➔ WP7.2) THEO LỘ TRÌNH PHÁT TRIỂN BẢN 3**. Toàn bộ 58 test files, 399 unit tests đạt 100%, typecheck clean 0 errors, build production `next build` hoàn tất sạch sẽ.

Báo cáo nghiệm thu chi tiết: Xem tại [docs/FINAL_REPORT.md](file:///d:/BAITAP/ChillBanana-main/docs/FINAL_REPORT.md).

Chú thích: ✅ xong và đã kiểm chứng · 🟡 đã làm nhưng chưa kiểm chứng đầy đủ · ⏳ cần bạn thực hiện · ⬜ chưa làm

## 1. Tiến độ theo giai đoạn (Bản 3)

| Giai đoạn | Mã gói việc | Hạng mục cốt lõi | Trạng thái | Ghi chú nghiệm thu |
| :--- | :---: | :--- | :---: | :--- |
| **GĐ 0** | **WP0.1** | Baseline, Luật Agent, CHANGELOG | ✅ | Ban hành `AGENTS.md`, `CHANGELOG.md`, `docs/BASELINE.md`. |
|  | **WP0.2** | Tách Demo/Production, Khóa Master | ✅ | Xóa bỏ `Admin@2026`, bảo vệ bằng scrypt và `src/lib/demo-mode.ts`. |
| **GĐ 1** | **WP1.1** | Server tự quyết `fulfillmentOrigin` | ✅ | Server tự phân loại nguồn kho VN/JP, loại bỏ can thiệp client. |
|  | **WP1.2** | Khóa tick gộp đơn, hạn giữ kho giỏ hỗn hợp | ✅ | Quét lazy và cron giải phóng `quoteHoldExpiresAt` sau 24h. |
|  | **WP1.3** | Hợp nhất `SystemConfig` vào `PricingConfig` | ✅ | Toàn bộ đọc giá quy về một nguồn `getCurrentPricingConfig`. |
| **GĐ 2** | **WP2.1** | Schema thanh toán đảo & `OrderCostLine` | ✅ | Bổ sung `kind = REVERSAL`, model `OrderCostLine`, migration chỉ thêm. |
|  | **WP2.2** | Hoàn tác bằng bản ghi đảo, tách giao khỏi cọc | ✅ | Cấm `deleteMany` tài chính, chặn `LOCAL_DELIVERY` khi cân `<= 0`. |
|  | **WP2.3** | Báo cáo tài chính V2 & Xuất CSV | ✅ | Định nghĩa chuẩn GMV, Doanh thu, Lãi gộp; xuất CSV UTF-8 BOM. |
|  | **WP2.4** | Nhập chi phí thực từng khâu & xem lãi gộp | ✅ | Tự động tạo `GOODS_JPY` khi mua hàng, cảnh báo lệch giá > 5%. |
| **GĐ 3** | **WP3.1** | Mô phỏng kinh tế đơn vị & Rào chắn lỗ | ✅ | Tái lập chính xác 2 ca đối chuẩn (`-45.279 đ` và `-56.280 đ`), cờ `belowMargin`. |
|  | **WP3.2** | Bộ giá V2 cấu hình hóa & Bóc tách chi phí | ✅ | Bổ sung phí xử lý, phí ngoại tệ; phân rã `breakdown` minh bạch. |
|  | **WP3.3** | Dòng tiền V2: Cọc phân tầng & Chốt công nợ | ✅ | Cọc 100% (< 1M), 70% (1-10M), 50% (> 10M); dung sai kho Tokyo 5%/50g. |
| **GĐ 4** | **WP4.1** | Nguồn báo giá & Hàng đợi duyệt giá 4h | ✅ | Bổ sung `quoteSource`, hàng đợi cảnh báo quá hạn 4h, cấm tự duyệt ngoài catalog. |
|  | **WP4.2** | Client API Rakuten & Yahoo! Shopping | ✅ | Kết nối API chính thức, rate limit, fallback dán link và credit Yahoo. |
|  | **WP4.3** | Bookmarklet 1-Click & Trang nhập đơn | ✅ | Script Bookmarklet < 3KB, trang `/dat-hang/nhap` lọc SSRF và XSS. |
| **GĐ 5** | **WP5.1** | Chiến dịch mua theo đợt (Group Buy) | ✅ | Model `Campaign`, `CampaignItem`, `CampaignEntry`, State Machine nghiêm ngặt. |
|  | **WP5.2** | Ưu đãi gom đơn & Phân bổ cước lô | ✅ | Thuật toán phân bổ cước lô theo tỷ lệ cân nặng với sai số tuyệt đối 0 đồng. |
| **GĐ 6** | **WP6.1** | Phân hệ VN → JP: Thẩm định MAFF ở server | ✅ | Chặn hàng cấm MAFF, tính cước thể tích IATA `(DxRxC)/5000`. |
|  | **WP6.2** | Tờ khai CN23 & Tuân thủ bảo vệ PII | ✅ | API xuất dữ liệu CN23 UPU, bộ lọc `pii-masker.ts`, ẩn danh hóa không xóa tài chính. |
| **GĐ 7** | **WP7.1** | Phân quyền vai trò RBAC & Kiểm kê | ✅ | Phân 5 vai trò quản trị, test kiểm kê 100% route admin có bảo vệ. |
|  | **WP7.2** | SOP vận hành, Giám sát, Đóng sổ tháng | ✅ | Ban hành 8 SOPs, endpoint `/api/health`, đóng sổ tài chính `PeriodClose`. |

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
| Nhật ký kiểm toán `AuditLog` | ✅ | Ghi các thao tác admin và purchase task; tab xem nhật ký/API chỉ cho Super Admin, phân trang và lọc. Integration test đã qua CI. |
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
| Chatbot AI, trợ lý admin, báo cáo AI | Đã có | Có bộ eval (`npm run eval:customer-support`). Rate limit chat AI vẫn trong bộ nhớ. `/api/scrape-link` có giới hạn bền vững theo IP để giảm rủi ro chi phí; integration test đã qua CI. |

## 3. Kết quả kiểm tra (GitHub Actions, commit `4e921da` trên `main`)

| Bước | Kết quả |
| --- | --- |
| Cài đặt, Prisma validate | ✅ |
| Migration trên DB trống (toàn bộ migration, gồm phase3) | ✅ |
| Migration khớp `schema.prisma` (không lệch) | ✅ |
| Type check, Lint | ✅ |
| Unit test | ✅ |
| Eval AI | ✅ |
| Integration test (PostgreSQL) | ✅ |
| Build | ✅ |
| E2E Playwright | ✅ |

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
| Giá cấu hình có lịch sử | ✅ code, ⏳ production | Đã thêm PricingConfig, API chỉ cho Super Admin ghi, giao diện lịch sử/điều chỉnh và ảnh chụp phiên bản trên đơn. Migration và kiểm thử PostgreSQL đã qua CI. |
| Đồng bộ cấu hình giá | ✅ code, ⏳ production | Storefront, giỏ, tạo đơn, duyệt giá, báo giá AI, tỷ giá fallback và ước tính trong quản trị dùng chung cấu hình. Lưu lại cùng giá trị hiện hành không sinh phiên bản/audit giả. |
| Provider thanh toán mock/sandbox/live | ✅ code, ⏳ production | Mock là mặc định; VNPAY sandbox cần bật tường minh và URL allowlist; live bị khóa. Kết quả mock/sandbox chỉ ghi PaymentAttempt và tracking log, không đánh dấu đơn đã trả, không tạo doanh thu/thanh toán thật, không mở bước mua hàng. Integration CI đã qua. |
| EmailLog và retry | ✅ code, ⏳ production | Có nhật ký không lưu địa chỉ nhận/nội dung thư, SMTP opt-in, thử tối đa 3 lần mỗi lượt và Super Admin có thể yêu cầu thử lại (tối đa 9 lần). Cron `/api/cron/retry-emails` chạy mỗi ngày (cần `CRON_SECRET`) thử lại email FAILED đã đến hạn và cứu log kẹt PENDING; lịch hằng ngày vì gói Vercel Hobby chỉ cho phép cron mỗi ngày một lần. Integration CI đã qua. |
| Giao diện quản trị | ✅ | Tab Super Admin “Cài đặt nghiệp vụ” gồm bảng giá có phiên bản, trạng thái dịch vụ và nhật ký email. |
| Kiểm chứng cục bộ | ✅ | `npm ci`, Prisma generate/validate, typecheck, build, lint, 51/51 unit test và AI eval đạt. Lint còn cảnh báo có sẵn. Integration/E2E không chạy cục bộ (không có PostgreSQL); đã chạy trên CI với DB tạm và đều đạt. Build local dùng DATABASE_URL giả trỏ loopback và không kết nối Neon. |

## 6. Việc còn lại

1. **Xác nhận production đã chạy bản mới (việc của bạn):** Vercel → Deployments → bản Production mới nhất phải Ready; Neon SQL Editor chạy `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at;` phải thấy `20261017000100_phase3_simulated_services` có `finished_at`. Production giờ bắt buộc có `NEXT_PUBLIC_APP_URL` (https) nếu build có kiểm tra cấu hình.
2. **Tách database cho Preview**: `DATABASE_URL` đang dùng chung Production và Preview. Tạo branch Neon `dev` và đặt riêng cho Preview.
3. **Diễn tập khôi phục** từ backup rồi ghi kết quả vào `docs/BACKUP_RESTORE.md`. Backup `backup-truoc-migrate-16-10` hết hạn 23/10/2026.
4. Chưa làm: hoàn tiền qua cổng thật, `ShippingProvider`, quên mật khẩu, phân quyền theo vai trò cho các route admin còn lại.

## 7. Giai đoạn 4 — nhật ký và bảo vệ API tốn chi phí

| Hạng mục | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- |
| Giới hạn `/api/scrape-link` | ✅ code, ⏳ production | 10 yêu cầu/IP trong 10 phút; bộ đếm dùng bảng `RateLimit` hiện có và chỉ lưu hash SHA-256 của IP. Quá ngưỡng trả HTTP 429 cùng `Retry-After`. Integration test đã qua CI. |
| Màn hình nhật ký kiểm toán | ✅ code, ⏳ production | Tab “Nhật ký kiểm toán” và API chỉ cho `SUPER_ADMIN`; phân trang 50 dòng, lọc theo tên thao tác. Không trả IP hoặc metadata nội bộ cho giao diện. Integration test quyền và lọc dữ liệu đã qua CI. |
| Audit tác vụ mua hộ | ✅ code, ⏳ production | Ghi sự kiện sau khi tạo task và sau khi cập nhật trạng thái thành công; không đưa link sản phẩm, mã đơn, mã ngoài hoặc thông tin khách vào metadata. Integration test đã qua CI. |
| Kiểm tra cục bộ | ✅ code, ⏳ production | `npm run typecheck`, `npm run build`, `npm run lint`, `npm test` đạt (52 unit test); AI eval và Prisma validate đạt; lint còn cảnh báo có sẵn. Integration test cần PostgreSQL test riêng/CI; không chạy trên Neon production. |

## 8. Hiện trạng thực tế cập nhật (04/11/2026 — Khởi động Kế hoạch Bản 3)

### 8.1 Đánh dấu thông tin đã lỗi thời trong các mục trước:
- **Số lượng unit test (Mục 3, 5, 7):** Thông tin ghi nhận 52 unit test là **đã lỗi thời**. Kiểm thử đường cơ sở ngày 04/11/2026 đạt **290 unit tests trên 38 test files (100% pass)** (chi tiết tại `docs/BASELINE.md`).
- **Cơ chế mật khẩu master:** Cơ chế fallback `Admin@2026` và tự ghi đè không an toàn đã được đánh dấu loại bỏ, chuyển sang cơ chế chỉ cho phép tự phục hồi trên môi trường demo (`ENABLE_DEMO_SELF_HEAL=true` và `APP_ENV=demo`) tại WP0.2.
- **Dòng tiền và cọc:** Mô hình cọc 50/100 và thu COD giao nội địa được đánh giá có rủi ro dòng tiền và phát sinh phí ẩn; lộ trình Bản 3 đã chốt chuyển sang Dòng tiền v2 (thu 100% dưới 1 triệu, 70% từ 1 triệu; thu đủ trước khi giao nội địa; không thu cước qua COD).
- **Trạng thái Amazon API:** Đã loại bỏ khỏi lộ trình do điều kiện duy trì 10 đơn hợp lệ / 30 ngày của Amazon Creators API không khả thi ở giai đoạn đầu.

### 8.2 Danh mục các module nghiệp vụ thực tế hiện có trong repo:
1. **Module Tuyến gửi hàng VN → JP:**
   - Mã nguồn: `src/features/pricing/vn-jp-rates.ts`, `src/features/ai/vn-jp/maff-inspector.ts`, `src/app/api/vn-jp-shipments/`, giao diện `/gui-hang-di-nhat`.
   - Trạng thái: Đã có bảng tính cước cơ bản và công cụ AI kiểm tra quy định kiểm dịch thực vật MAFF Nhật Bản. Sẽ được chuẩn hóa gắn với tài khoản khách và luồng thanh toán tại WP6.1.
2. **Module Thu mua hộ (Purchasing):**
   - Mã nguồn: `src/features/purchasing/service.ts`, `src/features/purchasing/AdminPurchaseTasksTab.tsx`.
   - Trạng thái: Đã có mô hình `PurchaseTask` để nhân viên quản lý đơn mua từ các sàn Nhật. Sẽ được tích hợp ghi nhận chi phí thực `OrderCostLine` tại WP2.4.
3. **Module Cấu hình định giá (PricingConfig):**
   - Mã nguồn: `src/features/pricing/config.ts`, `calculator.ts`, `customs-categories.ts`, `japan-stores.ts`.
   - Trạng thái: Đã có bảng `PricingConfig` lưu phiên bản giá. Tuy nhiên tham số giá còn phân tán giữa `SystemConfig` và `PricingConfig` (sẽ được hợp nhất duy nhất tại WP1.3).
4. **Module Đơn hàng & Giữ kho (Orders & Reservations):**
   - Mã nguồn: `src/features/orders/reservations.ts`, `policy.ts`, `item-source.ts`.
   - Trạng thái: Trừ tồn kho nguyên tử khi tạo đơn; đã phát hiện vấn đề kho giỏ hàng hỗn hợp giữ không hạn chờ duyệt giá (sẽ được giải quyết tại WP1.2).
5. **Module Hệ thống Hạn mức Quota & AI Routing:**
   - Mã nguồn: `src/features/ai/customer/assistant.ts`, `support-tools.ts`, `intent-router.ts`, `ApiKeyPool`.
   - Trạng thái: Đã có bộ định tuyến intent, tìm kiếm catalog fallback và xử lý chuyển đổi model khi gặp HTTP 429/503.

