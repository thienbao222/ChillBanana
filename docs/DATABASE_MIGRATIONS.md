# Quy trình migration database

Từ Giai đoạn 1, schema được quản lý bằng **Prisma Migrate** (thư mục `prisma/migrations`).
`prisma db push` **không còn** nằm trong luồng deploy và bị chặn bởi `scripts/guard-db-push.js`.

## Nguyên tắc

- Thay đổi schema luôn đi kèm một migration được commit và review.
- Production chỉ chạy `prisma migrate deploy` (áp dụng migration đã có, không tự sinh, không reset).
- Không bao giờ chạy `prisma migrate reset`, `prisma db push` hay seed trên database production.
- Trước mỗi lần deploy có migration: tạo bản sao lưu (xem `docs/BACKUP_RESTORE.md`).

## Bước làm một lần: đánh dấu baseline trên database đã có dữ liệu (BẮT BUỘC trước khi deploy production)

Database production đã có sẵn các bảng gốc (do `db push` tạo ra). Baseline `prisma/migrations/0_init` mô tả các bảng đó
(sinh bằng Prisma từ schema ở commit `ef9e20c`, đã được CI kiểm tra: toàn bộ migration khớp `schema.prisma`, không lệch).
Với database **đã có dữ liệu** cần đánh dấu baseline là *đã áp dụng* để Prisma không cố tạo lại bảng.

Với database **trống** (máy mới, môi trường test, CI): chỉ cần `npx prisma migrate deploy`; Prisma chạy `0_init` rồi các migration sau.

Làm lần lượt cho từng database đã có dữ liệu (production, và staging nếu tạo bằng `db push`). Chỉ đặt `DATABASE_URL`
trong chính lệnh, không lưu URL production vào `.env`:

```bash
# 1. Sao lưu trước (docs/BACKUP_RESTORE.md)

# 2. Kiểm tra schema thật của database KHỚP baseline. Mã thoát 0 = khớp.
git show ef9e20c:prisma/schema.prisma > old-schema.prisma
npx prisma migrate diff --from-url "URL_DATABASE" --to-schema-datamodel old-schema.prisma --exit-code
#    Mã thoát 2 = có khác biệt. Chỉ chấp nhận nếu khác biệt DUY NHẤT là một bảng thừa không thuộc ChillBanana
#    (ví dụ bảng mẫu `playing_with_neon` do Neon tự tạo khi lập database; "Removed tables" trong kết quả).
#    Mọi khác biệt khác (thiếu bảng/cột/chỉ mục, cột khác kiểu): DỪNG, đừng đánh dấu, và gửi kết quả để xử lý.

# 3. Đánh dấu baseline đã áp dụng (chỉ ghi một dòng vào bảng _prisma_migrations, không đổi dữ liệu)
DATABASE_URL="URL_DATABASE" npx prisma migrate resolve --applied 0_init
DATABASE_URL="URL_DATABASE" npx prisma migrate status   # phải báo còn 1 migration chờ: 20261015000100_phase1_security
```

Không tự chạy `migrate deploy` lên production; Vercel sẽ chạy khi deploy production.
Nếu deploy production khi chưa có `prisma/migrations/0_init`, `scripts/vercel-build.js` sẽ **từ chối build**.

## Kết nối trực tiếp cho migration (Neon)

Neon có hai loại chuỗi kết nối: **pooler** (host có `-pooler`, dùng cho ứng dụng) và **trực tiếp** (host không có `-pooler`).
`prisma migrate` cần kết nối **trực tiếp**. Vì vậy:

- Trên Vercel (Production) thêm biến `DIRECT_URL` = chuỗi kết nối trực tiếp của cùng database. `DATABASE_URL` giữ nguyên.
- Khi deploy production, `scripts/vercel-build.js` chạy migrate với `DIRECT_URL`; nếu `DATABASE_URL` là pooler mà thiếu `DIRECT_URL`, build **từ chối** và báo rõ.
- Khi chạy `migrate diff`/`resolve`/`status` bằng tay, cũng dùng chuỗi trực tiếp.

## Quy trình hằng ngày

1. Sửa `prisma/schema.prisma`.
2. Trên database **development riêng**: `npm run prisma:migrate:dev -- --name mo_ta_ngan` (sinh migration và áp dụng).
3. Kiểm tra SQL trong `prisma/migrations/<timestamp>_<tên>/migration.sql`. Chú ý các lệnh `DROP`/`ALTER ... DROP COLUMN` (mất dữ liệu).
4. Commit schema + migration cùng nhau, mở pull request, chờ CI xanh.
5. Triển khai lên staging, kiểm tra, rồi mới lên production. Vercel production tự chạy `prisma migrate deploy` trong `npm run vercel-build`.

## Kiểm tra trạng thái

```bash
npm run prisma:migrate:status
```

## Khi migration production lỗi

- `migrate deploy` dừng ở migration lỗi, các migration trước đó vẫn giữ nguyên. Build Vercel thất bại nên bản cũ vẫn chạy.
- Không sửa tay migration đã áp dụng. Tạo migration mới để sửa.
- Nếu cần quay lại: khôi phục từ bản sao lưu theo `docs/BACKUP_RESTORE.md`, rồi `prisma migrate resolve --rolled-back <tên>` nếu cần.
