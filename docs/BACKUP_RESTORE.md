# Sao lưu và khôi phục database

Database chạy trên PostgreSQL (Neon). Tài liệu này mô tả cách sao lưu và, quan trọng hơn, cách **thử khôi phục** để biết bản sao lưu dùng được.

> Trạng thái: quy trình đã được viết, **chưa được thực hiện thử** (cần truy cập tài khoản Neon của bạn). Hãy chạy mục "Diễn tập khôi phục" ít nhất một lần và ghi kết quả vào bảng cuối tài liệu.

## 1. Sao lưu

### Cách A: pg_dump (độc lập nhà cung cấp, khuyến nghị làm trước mỗi lần migrate)

```bash
# Dùng chuỗi kết nối KHÔNG qua pooler (host không có "-pooler") để dump ổn định
pg_dump "$DATABASE_URL_DIRECT" --format=custom --no-owner --file="chillbanana-$(date +%Y%m%d-%H%M).dump"
```

- Lưu file `.dump` ở nơi an toàn, ngoài repo. **Không commit** file dump (chứa dữ liệu khách).
- Bản dump chứa dữ liệu cá nhân của khách: mã hóa khi lưu trữ, xóa khi không còn cần.

### Cách B: Neon branch / khôi phục theo thời điểm

Neon cho phép tạo branch từ một thời điểm trong quá khứ (cửa sổ lịch sử phụ thuộc gói dịch vụ; kiểm tra tại trang của Neon).
Trước khi migrate production, tạo một branch từ branch production làm điểm quay lui.

## 2. Khôi phục

1. Tạo database/branch **mới và trống** (không khôi phục đè lên production khi chưa kiểm tra).
2. Khôi phục từ dump:
   ```bash
   pg_restore --no-owner --clean --if-exists --dbname="$DATABASE_URL_RESTORE_TARGET" chillbanana-YYYYMMDD-HHMM.dump
   ```
3. Kiểm tra: `DATABASE_URL=$DATABASE_URL_RESTORE_TARGET npx prisma migrate status` phải báo schema khớp.
4. Kiểm tra dữ liệu (xem checklist dưới) rồi mới trỏ ứng dụng sang database đã khôi phục.

## 3. Diễn tập khôi phục (làm trên môi trường thử, không đụng production)

- [ ] Tạo bản dump từ database staging/development.
- [ ] Khôi phục vào database trống mới.
- [ ] `npx prisma migrate status` không báo lỗi.
- [ ] Số bản ghi các bảng chính khớp: `Order`, `OrderItem`, `PaymentTransaction`, `Product`, `Customer`, `AdminUser`.
- [ ] Chạy ứng dụng với `DATABASE_URL` trỏ vào bản khôi phục, đăng nhập admin, mở danh sách đơn.
- [ ] Ghi lại thời gian khôi phục và vấn đề gặp phải.

| Ngày | Người thực hiện | Nguồn | Kết quả | Thời gian | Ghi chú |
| ---- | --------------- | ----- | ------- | --------- | ------- |
|      |                 |       |         |           |         |

## 4. Lưu ý bảo mật

- Chuỗi kết nối, file dump và mật khẩu không được đưa vào repo, ảnh chụp màn hình hay chat.
- Sau khi khôi phục xong trên môi trường thử, xóa database thử và file dump không còn dùng.
