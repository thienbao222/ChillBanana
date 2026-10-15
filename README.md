# ChillBanana

Website mua hộ và quản lý sản phẩm Nhật–Việt, xây dựng bằng Next.js, React, Prisma và PostgreSQL.

## Chức năng

- Danh mục sản phẩm, lọc theo nhóm và giỏ hàng có kiểm tra tồn kho.
- Công cụ báo giá sản phẩm từ link cửa hàng Nhật.
- Tạo đơn, theo dõi trạng thái và lịch sử vận chuyển.
- Tài khoản khách hàng, xác minh email và trang quản trị.
- Quản lý sản phẩm, đơn hàng, khách hàng và báo cáo.
- Hỗ trợ VNPAY sandbox để minh họa luồng thanh toán.

## Chạy trên máy cá nhân

Cần Node.js 20 trở lên và một cơ sở dữ liệu PostgreSQL.

1. Cài dependencies:

   ```bash
   npm ci
   ```

2. Tạo file `.env` từ `.env.example`, rồi điền `DATABASE_URL`. Đặt thêm `ADMIN_SESSION_SECRET` và `CUSTOMER_SESSION_SECRET` (dùng để ký cookie phiên) để đăng nhập quản trị/khách hàng hoạt động ổn định.

   `DATABASE_URL` ở máy cá nhân phải trỏ tới PostgreSQL riêng cho phát triển/kiểm thử, không dùng Neon Production.

3. Tạo schema và khởi tạo catalog trên database development **trống**:

   ```bash
   npm run prisma:migrate:deploy   # áp dụng prisma/migrations (cần baseline 0_init, xem docs/DATABASE_MIGRATIONS.md)
   npm run prisma:seed
   ```

   Seed tạo hoặc cập nhật 10 sản phẩm catalog. Tồn kho của sản phẩm đã có trong database được giữ nguyên. Để tạo hoặc cập nhật tài khoản quản trị `admin`, đặt `ADMIN_INITIAL_PASSWORD` trước khi chạy seed (mật khẩu được băm bằng scrypt có salt riêng; seed ghi đè mật khẩu tài khoản `admin` và từ chối chạy khi `APP_ENV`/`VERCEL_ENV` là production).

   `npm run prisma:push` chỉ còn dùng cho database development riêng và phải đặt `ALLOW_DB_PUSH=1`; lệnh bị chặn trên production.

4. Khởi động ứng dụng:

   ```bash
   npm run dev
   ```

   Mở `http://localhost:3000`.

## Kiểm tra

```bash
npm run typecheck
npx prisma validate
npm run lint
npm test
npm run eval:customer-support
npm run build
```

CI (`.github/workflows/ci.yml`) chạy các bước trên cho mọi pull request.

Các biến môi trường mà ứng dụng đọc được liệt kê trong `.env.example`.

## An toàn dữ liệu và cấu trúc mã

- Không chạy `npm run prisma:push` hoặc `npm run prisma:seed` khi `DATABASE_URL` đang trỏ tới cơ sở dữ liệu Production. Build Production chỉ áp dụng migration đã commit (`prisma migrate deploy`) qua `scripts/vercel-build.js` và từ chối build nếu chưa có baseline. Xem [`docs/DATABASE_MIGRATIONS.md`](docs/DATABASE_MIGRATIONS.md) và [`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md).
- Đăng nhập admin/khách có giới hạn số lần sai (bảng `RateLimit`); thao tác quản trị nhạy cảm được ghi vào bảng `AuditLog`.
- Tiến độ nâng cấp và hiện trạng từng chức năng: [`docs/STATUS.md`](docs/STATUS.md).
- Dùng database và credentials riêng cho Preview trước khi kiểm thử thay đổi có truy cập dữ liệu.
- Mã theo nghiệp vụ nằm trong `src/features`; quy tắc đặt file và ranh giới giữa UI, route, AI và dữ liệu được mô tả tại [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md).
- Các giai đoạn phát triển trợ lý AI được ghi tại [`docs/architecture/ai-agent-roadmap.md`](docs/architecture/ai-agent-roadmap.md).
