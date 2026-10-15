# Quy trình migration database

Từ Giai đoạn 1, schema được quản lý bằng **Prisma Migrate** (thư mục `prisma/migrations`).
`prisma db push` **không còn** nằm trong luồng deploy và bị chặn bởi `scripts/guard-db-push.js`.

## Nguyên tắc

- Thay đổi schema luôn đi kèm một migration được commit và review.
- Production chỉ chạy `prisma migrate deploy` (áp dụng migration đã có, không tự sinh, không reset).
- Không bao giờ chạy `prisma migrate reset`, `prisma db push` hay seed trên database production.
- Trước mỗi lần deploy có migration: tạo bản sao lưu (xem `docs/BACKUP_RESTORE.md`).

## Bước làm một lần: tạo baseline (BẮT BUỘC trước khi deploy production)

Database production đã có sẵn các bảng gốc (do `db push` tạo ra). Cần một migration "baseline" mô tả các bảng đó
và đánh dấu là *đã áp dụng*, để Prisma không cố tạo lại.

Trên máy của bạn, trong thư mục repo (đã `npm ci`, có đủ lịch sử git):

```bash
# 1. Tạo prisma/migrations/0_init từ schema gốc (commit ef9e20c), không cần kết nối database
bash scripts/db/generate-baseline.sh

# 2. Xem lại file SQL sinh ra, rồi commit
git add prisma/migrations/0_init
git commit -m "chore(db): add baseline migration"
```

Sau đó, với **mỗi database đã có dữ liệu** (production, và staging nếu đã tạo bằng db push), đánh dấu baseline là đã áp dụng:

```bash
# DATABASE_URL trỏ tới đúng database cần đánh dấu
npx prisma migrate resolve --applied 0_init
npx prisma migrate status   # phải báo còn migration chờ áp dụng: 20261015000100_phase1_security
```

Với database **trống** (máy mới, môi trường test): chỉ cần `npx prisma migrate deploy`, Prisma sẽ chạy `0_init` rồi các migration sau.

> Nếu deploy production khi chưa có `prisma/migrations/0_init`, `scripts/vercel-build.js` sẽ **từ chối build** và in hướng dẫn này.

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
