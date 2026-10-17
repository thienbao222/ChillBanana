# Giai đoạn 3 — Cấu hình giá, thanh toán thử nghiệm và email

Tài liệu này mô tả lớp dịch vụ của Giai đoạn 3. Mục đích là giúp kiểm thử nghiệp vụ như môi trường thật nhưng không thu tiền, không đánh dấu doanh thu thật và không gửi email ngoài ý muốn.

## Bảng giá có phiên bản

- PricingConfig lưu các giá trị tính phí theo phiên bản bất biến. Thay đổi từ trang quản trị tạo một phiên bản mới, kèm người sửa, lý do và AuditLog.
- Đơn mới lưu pricingConfigVersion; số tiền của đơn vẫn được lưu riêng như ảnh chụp tại thời điểm tạo hoặc duyệt báo giá.
- Trang quản trị cho phép sửa phí dịch vụ, mức tối thiểu, cước bay tham chiếu, ưu đãi gộp đơn, ngưỡng tối thiểu và tỷ giá dự phòng.
- API kiểm tra giới hạn trước khi ghi. Các màn tính giá, tạo đơn, duyệt giá, giỏ hàng và công cụ báo giá của AI cùng đọc một cấu hình.
- Tỷ giá JPY/VND ưu tiên nguồn trực tuyến. USD/VND tham chiếu của cấu hình chỉ dùng cho cross-rate Frankfurter. Khi mọi nguồn lỗi, tỷ giá dự phòng được đánh dấu stale; API tạo đơn tiếp tục từ chối tỷ giá stale.

## Chế độ thanh toán

PAYMENT_MODE nhận:

- mock (mặc định an toàn): tạo trang thử nghiệm nội bộ với kết quả thành công, thất bại, đang chờ hoặc timeout.
- sandbox: dùng VNPAY sandbox khi URL là HTTPS trên đúng host sandbox.vnpayment.vn và có đủ merchant credentials.
- live: luôn bị khóa trong dự án này.

Nếu biến không được đặt, hệ thống chọn mock, kể cả khi còn URL hoặc credentials sandbox trong môi trường. Chỉ callback khi đang bật sandbox mới được chấp nhận.

Mỗi lần thử được lưu trong PaymentAttempt. Callback sandbox hợp lệ hoặc nút “thành công” mock chỉ xác nhận kịch bản trong log. Nó không cập nhật Order.paymentStatus, không chuyển trạng thái sang mua hàng, không tạo PaymentTransaction, không làm tăng doanh thu và không gửi email xác nhận đã nhận tiền. Vì thế có thể kiểm thử callback, chữ ký, chống lặp và hết hạn mà không làm đơn demo trông như đã thanh toán thật.

## Email và thử gửi lại

- EMAIL_MODE=mock là mặc định. Bản ghi có trạng thái SIMULATED; không gọi SMTP dù biến SMTP còn cấu hình.
- Muốn gửi thư SMTP trong môi trường kiểm thử, phải đặt rõ EMAIL_MODE=smtp cùng thông tin SMTP.
- EmailLog lưu loại email, mã đơn nếu có, provider, trạng thái, số lượt thử, mã lỗi và lịch thử lại. Không lưu địa chỉ nhận, HTML, nội dung email, token hoặc liên kết truy cập.
- Gửi thư nghiệp vụ có tối đa 3 lần thử trong một lần chạy; lỗi cuối lên lịch thử lại sau 5 phút. Super Admin có thể bấm thử lại trong màn “Cài đặt nghiệp vụ”; mỗi thao tác có thể dùng thêm tối đa 3 lần và tổng giới hạn 9 lần.
- Email xác minh tài khoản chỉ được xác nhận là đã gửi khi SMTP chấp nhận. Trong chế độ mock, tài khoản không được báo rằng thư xác minh đã gửi.
- Chưa có cron tự động chạy email retry. Nhật ký thất bại cần được Super Admin xem và thử lại thủ công.
- SMTP có ngữ nghĩa thử gửi lại kiểu at-least-once: nếu máy chủ SMTP nhận thư nhưng tiến trình chết trước khi cập nhật EmailLog, lần thử sau có thể gửi trùng. Vì vậy email giao dịch không dùng để thay thế đối soát trạng thái đơn trong hệ thống.

## Triển khai an toàn

- Migration Giai đoạn 3 tạo các bảng PricingConfig, PaymentAttempt, EmailLog, thêm khóa phiên bản nullable vào Order, và chèn một phiên bản giá đầu tiên khớp giá cũ. Không sửa hoặc xóa đơn hiện có.
- scripts/vercel-build.js chỉ chạy migration khi build Production. Preview không tự chạy migration, nên Preview dùng chung Neon Production có thể chưa dùng được các API Giai đoạn 3 cho đến khi Production triển khai migration.
- CI chạy migrations trên PostgreSQL tạm riêng. Không chạy test/reset hoặc migrate thủ công lên Neon Production để kiểm chứng.
- Không khai báo PAYMENT_MODE=live; code từ chối chế độ này ngay cả khi có credentials.
