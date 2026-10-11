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

2. Tạo file `.env` từ `.env.example`, rồi điền `DATABASE_URL`. Đặt thêm `ADMIN_SESSION_SECRET` và `CUSTOMER_SESSION_SECRET` để đăng nhập quản trị/khách hàng hoạt động ổn định.

3. Đồng bộ schema và khởi tạo catalog:

   ```bash
   npm run prisma:push
   npm run prisma:seed
   ```

   Seed tạo hoặc cập nhật 10 sản phẩm catalog. Tồn kho của sản phẩm đã có trong database được giữ nguyên. Để tạo hoặc cập nhật tài khoản quản trị `admin`, đặt `ADMIN_INITIAL_PASSWORD` trước khi chạy seed; seed cũng cần `ADMIN_SESSION_SECRET`.

4. Khởi động ứng dụng:

   ```bash
   npm run dev
   ```

   Mở `http://localhost:3000`.

## Kiểm tra

```bash
npx tsc --noEmit
npx prisma validate
npm run build
```

Các biến môi trường mà ứng dụng đọc được liệt kê trong `.env.example`.
