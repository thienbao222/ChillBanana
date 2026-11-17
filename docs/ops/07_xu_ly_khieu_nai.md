# SOP 07: Quy Trình Tiếp Nhận & Xử Lý Khiếu Nại Khách Hàng

- **Mã quy trình:** SOP-CB-07
- **Vai trò chịu trách nhiệm (RBAC):** `SUPPORT` (Chăm sóc khách hàng) / `SUPER_ADMIN`
- **Thời hạn cam kết (SLA):** Phản hồi khách trong vòng 2 giờ; giải quyết dứt điểm khiếu nại trong vòng 72 giờ.

---

## 1. Mục Đích
Giải quyết thỏa đáng các thắc mắc, phản ánh về sai lệch sản phẩm, móp méo hư hỏng trong quá trình vận chuyển hoặc chậm trễ lịch bay.

## 2. Các Bước Thao Tác
1. **Tiếp nhận khiếu nại:** Qua kênh Chatbot AI, Fanpage hoặc Hotline. Chuyển thông tin vào bảng quản trị ticket khiếu nại.
2. **Xác minh thực tế:**
   - Yêu cầu khách cung cấp video khui kiện hàng (Unboxing video) nguyên seal tem ChillBanana.
   - Đối chiếu với ảnh chụp ngoại quan tại kho Tokyo trước khi bay (SOP 03).
3. **Đưa ra phương án giải quyết:**
   - Hư hỏng do vận chuyển quốc tế: Kích hoạt gói bảo hiểm hàng hóa, đền bù theo tỷ lệ hư hỏng hoặc hoàn tiền 100%.
   - Hàng sai mẫu từ phía người bán Nhật: Hỗ trợ liên hệ shop Nhật làm thủ tục đổi trả hoặc hoàn tiền.
4. **Ghi nhận chi phí đền bù:** Nếu phát sinh đền bù, Kế toán ghi nhận vào `OrderCostLine` danh mục `OTHER` với ghi chú rõ ràng về khoản bồi thường.

## 3. Chứng Từ & Nơi Ghi Nhận
- **Bảng ghi:** `OrderCostLine` (nếu có chi phí đền bù), `AuditLog`.
- **AuditLog Action:** `COMPLAINT_RESOLVED`.

