# Trạng thái dự án và tiến độ nâng cấp

Cập nhật: 15/10/2026 · Nhánh `feat/phase-0-1-safety-foundation` · Kế hoạch gốc: `NangCapFinal.docx`

Chú thích: ✅ xong và đã kiểm chứng · 🟡 đã làm nhưng chưa kiểm chứng đầy đủ · ⏳ cần bạn thực hiện · ⬜ chưa làm

## 1. Tiến độ theo giai đoạn

### Giai đoạn 0: Rà soát và nền tảng

| Hạng mục | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- |
| Rà soát repo, lập bảng hiện trạng (mục 2) | 🟡 | Đã đọc kỹ xác thực, đơn hàng, thanh toán, tỷ giá, seed, schema, build. Chưa đọc kỹ toàn bộ giao diện và module AI. |
| Chạy `tsc`, `prisma validate`, `lint`, `build` | ✅ | Chạy trên GitHub Actions (PR #4): prisma validate, typecheck, lint, unit test, eval AI và build **đều đạt**. |
| Dọn repo | ✅ | Bỏ `tsconfig.tsbuildinfo` khỏi git (đã thêm `*.tsbuildinfo` vào `.gitignore`); chuyển `GhiChu.txt` sang `docs/notes/`; chuyển báo cáo giữa kỳ `.docx` và `generate_academic_report.py` sang `docs/academic/`. Hai file roadmap AI khác ngôn ngữ và nội dung nên được giữ nguyên, không phải bản trùng. |
| GitHub Actions CI | ✅ | `.github/workflows/ci.yml`; lần chạy đầu trên PR #4 xanh toàn bộ các bước. |
| Database dev/staging riêng | ⏳ | Cần tạo branch Neon riêng và xác nhận `DATABASE_URL` cục bộ không trỏ production. |

### Giai đoạn 1: An toàn dữ liệu và bảo mật tài khoản

| Hạng mục | Trạng thái | Bằng chứng / ghi chú |
| --- | --- | --- |
| Migration thay cho `db push` khi deploy | 🟡 | `vercel-build.js` production chạy `prisma migrate deploy`; `prisma:push` bị chặn (cần `ALLOW_DB_PUSH=1`, từ chối trên production). Có migration `20261015000100_phase1_security` viết tay (2 bảng mới). |
| Baseline migration `0_init` | ⏳ | Không tạo được trong môi trường này (cần Prisma CLI). Chạy `bash scripts/db/generate-baseline.sh` rồi `prisma migrate resolve --applied 0_init` trên DB đã có dữ liệu. **Production sẽ từ chối build cho đến khi làm bước này** (chủ ý, để không deploy nhầm). |
| Hash mật khẩu admin sang scrypt | ✅ logic / 🟡 tích hợp | `src/lib/password.ts`: 15 unit test đạt (xem mục 3). Hash HMAC cũ vẫn đăng nhập được và tự nâng cấp sau lần đăng nhập đúng. Typecheck/lint/build đạt trên CI; chưa chạy luồng đăng nhập với database thật. |
| Giới hạn đăng nhập sai (admin, khách) và đăng ký | ✅ logic / 🟡 tích hợp | Bảng `RateLimit`; admin: khóa 15 phút sau 5 lần sai theo tài khoản, 20 lần theo IP; khách tương tự; đăng ký tối đa 10 lần/giờ/IP. Logic có test. Chưa thử trên database thật. |
| Nhật ký kiểm toán `AuditLog` | 🟡 | Ghi: đăng nhập/đăng xuất/đăng nhập sai admin, tạo/sửa/xóa sản phẩm, ghi nhận chuyển khoản, duyệt giá, đổi trạng thái/hủy đơn, gộp dữ liệu khách. Chưa có màn hình xem nhật ký. Chưa ghi cho `purchase-tasks`. |
| Kiểm tra quyền ở backend | 🟡 | `requireAdmin` đối chiếu AdminUser trong DB (tài khoản bị xóa mất quyền ngay) và kiểm tra vai trò. Áp dụng cho `api-keys` và `stitch-all` (chỉ SUPER_ADMIN) và ghi nhận thanh toán. Các route admin còn lại vẫn dùng `isAdminRequest`. |
| Tài liệu migration và backup/restore | ✅ viết / ⏳ diễn tập | `docs/DATABASE_MIGRATIONS.md`, `docs/BACKUP_RESTORE.md`. Chưa diễn tập khôi phục thật. |

## 2. Hiện trạng từng chức năng

| Chức năng | Trạng thái | Ghi chú |
| --- | --- | --- |
| Catalog, giỏ hàng, kiểm tra tồn kho | Đã có | Dữ liệu seed là demo (`curated-products.json`), chưa gắn nhãn nguồn dữ liệu. |
| Báo giá, tỷ giá | Đã có, có rủi ro | Server tự lấy tỷ giá; stale thì từ chối tạo đơn. Hằng số giá còn nằm trong code; nguồn dự phòng có USD/VND 25400 hard-code. Cache trong bộ nhớ từng instance. |
| Tạo đơn | Đã có | Transaction, trừ tồn kho nguyên tử, giữ hàng và cron hết hạn. Chưa có test. |
| Thanh toán VNPAY (sandbox) | Đã có | IPN xác thực chữ ký, so số tiền, chống xử lý lặp. Giao dịch thất bại chưa được ghi lại. Chưa có mock provider. |
| Chuyển khoản thủ công (admin xác nhận) | Đã có | Có kiểm tra số tiền khớp; nay có kiểm tra quyền qua DB và audit. |
| Hủy đơn / hoàn tiền | Đã có một phần | Hủy đơn hoàn kho trong transaction; trạng thái REFUNDED do admin xác nhận. Chưa có hoàn tiền qua provider. |
| Tracking, vận chuyển | Đã có (mô phỏng) | Chưa tách interface provider. |
| Email | Đã có | Chưa cấu hình SMTP thì chỉ log "Mailer Sim". Chưa có retry và `EmailLog`. |
| Tài khoản khách, xác minh email | Đã có | Có giới hạn đăng nhập sai (Giai đoạn 1). Chưa có quên mật khẩu. |
| Trang quản trị | Đã có | Sản phẩm, đơn, khách, báo cáo, AI, mua hàng. |
| Chatbot AI, trợ lý admin, báo cáo AI | Đã có | Rate limit AI hiện nằm trong bộ nhớ. `/api/scrape-link` công khai, gọi Gemini, chưa có giới hạn tần suất: **rủi ro chi phí**, nên xử lý ở Giai đoạn 4. |
| Test tự động | Mới bắt đầu | 15 unit test (hash, rate limit) + bộ eval AI có sẵn. Chưa có test đơn hàng, thanh toán, phân quyền (Giai đoạn 2). |

## 3. Kết quả kiểm tra đã thực hiện

- `npm test` (Node 22, `--experimental-strip-types`): **15/15 đạt**: hash scrypt, tương thích hash HMAC admin cũ và SHA-256 khách cũ, tương thích hash do `prisma/hash-password.js` (seed), ngưỡng khóa 5 lần, hết hạn khóa, đếm lại khi hết cửa sổ, lấy IP.
- - **GitHub Actions (PR #4)**: `npm ci`, `prisma validate`, `typecheck`, `lint`, `npm test`, `eval:customer-support`, `build`: tất cả đạt.
- **Chưa kiểm chứng**: chạy migration trên database thật, luồng đăng nhập/khóa/audit với database thật, diễn tập khôi phục. Cần database development riêng (mục 4).

## 4. Việc bạn cần làm trước khi merge vào nhánh chính

1. ~~Chạy kiểm tra tự động~~ (CI xanh trên PR #4).
3. Tạo database Neon riêng (branch) cho development/staging và thử: `npm run prisma:migrate:deploy` trên DB trống, đăng nhập admin, thử nhập sai 5 lần.
4. Tạo baseline và đánh dấu đã áp dụng (xem `docs/DATABASE_MIGRATIONS.md`). **Không merge vào nhánh chính trước bước này**, vì deploy production sẽ bị từ chối.
5. Tạo bản sao lưu production trước khi deploy; diễn tập khôi phục theo `docs/BACKUP_RESTORE.md`.
6. Sau khi deploy: đăng nhập admin một lần để hash mật khẩu được nâng cấp lên scrypt.
