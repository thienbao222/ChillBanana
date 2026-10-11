# Lộ trình phát triển AI Agent cho ChillBanana

## Hiện trạng

- Chatbot hiện trả lời tư vấn và hỗ trợ khách qua giao diện chat.
- Admin có màn hình AI insights chỉ đọc số liệu và đề xuất; AI không được gọi trực tiếp API quản trị hay sửa dữ liệu.
- Báo cáo AI dùng số liệu đơn hàng tổng hợp từ toàn bộ lịch sử. Xu hướng chat được lấy từ tối đa 100 phiên gần nhất và phải được xem là mẫu tham khảo.

## Hướng kiến trúc

Để mở rộng từ chatbot sang agent, giữ mô hình ở vai trò hiểu yêu cầu và chọn công cụ; server mới là nơi kiểm tra quyền và thực hiện nghiệp vụ. Không cho mô hình tự tạo SQL, truy cập Prisma tùy ý, hay nhận quyền admin từ nội dung hội thoại.

Mỗi công cụ nên có schema đầu vào/đầu ra được kiểm tra, quyền tối thiểu, timeout, giới hạn số lần gọi và chỉ rõ tác động đọc/ghi. Định danh khách hàng phải lấy từ phiên đăng nhập đã xác thực; quyền admin phải được kiểm tra lại ở từng lần gọi công cụ.

## Các giai đoạn

1. **Tư vấn khách hàng, chỉ đọc:** tìm sản phẩm và tồn kho, tính báo giá tham khảo, hướng dẫn mua hàng, tra trạng thái đơn thuộc khách hiện tại. Nguồn tồn kho, tỷ giá và phí lấy từ API nghiệp vụ; AI chỉ diễn giải kết quả.
2. **Trợ lý admin, báo cáo:** gọi các truy vấn thống kê có phạm vi ngày rõ ràng; tách doanh thu đã ghi nhận khỏi giá trị đơn dự kiến; trả về nguồn dữ liệu, thời điểm tổng hợp và giới hạn mẫu. AI tóm tắt, không tự đặt số liệu.
3. **Hỗ trợ thao tác có kiểm soát:** AI chuẩn bị bản xem trước cho các hành động như cập nhật ghi chú, tiến độ, tồn kho hay nội dung catalog. Admin phải xác nhận; server kiểm tra lại trạng thái và quyền trước khi ghi. Mỗi thao tác cần mã chống lặp và audit log gồm người yêu cầu, dữ liệu trước/sau, công cụ, thời điểm và kết quả.

## Điều kiện trước khi cho agent ghi dữ liệu

- Có phân quyền theo vai trò và phạm vi đối tượng, cùng kiểm thử cho quyền bị từ chối.
- Có audit log và cơ chế chống chạy lặp khi nhà cung cấp AI gửi lại yêu cầu.
- Có xác nhận rõ ràng trước mọi hành động làm thay đổi đơn, tồn kho, giá hoặc nội dung công khai.
- Có giới hạn vòng lặp, thời gian và chi phí; khi AI/API lỗi thì quay về luồng thủ công.
- Đo độ chính xác bằng các tình huống nghiệp vụ mẫu trước khi bật cho người dùng.
