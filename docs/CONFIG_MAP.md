# Bảng Ánh Xạ Cấu Hình: SystemConfig & PricingConfig

Cập nhật: 04/11/2026
Gói việc: WP1.3 — Hợp nhất SystemConfig vào PricingConfig

---

## 1. Mục tiêu
Thiết lập `PricingConfig` (bảng `pricing_configs`) làm **Single Source of Truth** (nguồn chân lý duy nhất) cho toàn bộ tham số tính giá, cước phí, tỷ giá sàn và ngưỡng đơn hàng. Loại bỏ hoàn toàn sự phân mảnh giữa bảng phẳng `system_configs` (key-value) và `pricing_configs` (lưu phiên bản theo dạng JSON có audit log).

---

## 2. Bảng đối chiếu tham số (Mapping Matrix)

| Khóa trong `SystemConfig` (`key`) | Trường tương ứng trong `PricingConfig` (`values`) | Đơn vị | Mặc định | Mục đích & Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `service_fee_percent` | `serviceFeePercent` | % | `4` | Tỷ lệ phí mua hộ (0–25%) |
| `min_service_fee_vnd` | `serviceFeeMinimumVnd` | VND | `20,000` | Mức phí mua hộ tối thiểu |
| `air_shipping_per_kg_vnd` | `airShippingPerKgVnd` | VND/kg | `185,000` | Đơn giá cước bay quốc tế Nhật → Việt |
| `group_buy_discount_percent` | `groupBuyShippingDiscountPercent` | % | `25` | Mức giảm cước khi tham gia gom đơn (nếu bật) |
| `floor_exchange_rate_jpy` | `fallbackJpyVndRate` | VND/JPY | `172` | Tỷ giá sàn dự phòng khi mất kết nối API Vietcombank |
| `min_order_threshold_vnd` | `minimumBaseOrderVnd` | VND | `300,000` | Giá trị tối thiểu của một đơn hàng để hệ thống chấp nhận |
| *(chỉ có trong PricingConfig)* | `groupBuyMaxWeightKg` | kg | `0.5` | Giới hạn cân nặng tối đa cho đơn gom |
| *(chỉ có trong PricingConfig)* | `usdVndReferenceRate` | VND/USD | `25,400` | Tỷ giá tham chiếu USD/VND |
| *(chỉ có trong PricingConfig)* | `fxSpreadPercent` | % | `0` | Biên độ tỷ giá (nếu áp dụng) |
| *(chỉ có trong PricingConfig)* | `groupBuyEnabled` | boolean | `false` | Cờ bật/tắt toàn hệ thống tính năng gộp đơn |

---

## 3. Hiện trạng sử dụng trong mã nguồn

### 3.1 Nơi đọc tính giá (`calculateOrderPrice`):
- `src/features/pricing/calculator.ts`: Đã sử dụng `PricingConfigValues`.
- `src/app/api/orders/route.ts`: Gọi `getCurrentPricingConfig()` khi tạo đơn, lưu số phiên bản `pricingConfigVersion` vào bản ghi `Order`.
- `src/app/api/orders/[id]/route.ts`: Gọi `getCurrentPricingConfig()` khi admin duyệt giá hoặc cập nhật cân nặng.
- **Kết luận:** Hệ thống tính giá đơn hàng cốt lõi **không** đọc từ `SystemConfig`.

### 3.2 Nơi quản trị qua Admin UI:
- `/api/admin/pricing-config` (tab Cấu hình giá): Đọc và ghi trực tiếp vào `PricingConfig`, tự động tăng số phiên bản `version`, ghi lại `changedBy`, `changeReason` và `AuditLog`.
- `/api/admin/system-config` (tab Sandbox / SystemConfig Editor): Đọc/ghi `SystemConfig`. Đã được đồng bộ 2 chiều với `PricingConfig` trong giao dịch (`$transaction`).

---

## 4. Giải pháp hợp nhất (WP1.3)

1. **Ủy quyền hoàn toàn cho `PricingConfig`:**
   - Trong `src/lib/system-config.ts`, hàm `getSystemConfig()` lấy trực tiếp dữ liệu từ `getCurrentPricingConfig()` cho các khóa liên quan đến giá.
   - Cache in-memory của `SystemConfig` tự động đồng bộ và xóa (`invalidatePricingConfigCache`) khi cấu hình thay đổi.
2. **Khóa không phải giá trong tương lai:**
   - Nếu có các thiết lập hệ thống phi giá (ví dụ: cờ bảo trì, thông báo banner toàn trang, webhook URL), chúng sẽ được lưu trong `SystemConfig`. Toàn bộ tham số tài chính/tính giá tuyệt đối chỉ đọc từ `PricingConfig`.
3. **Admin Endpoints:**
   - Cả hai endpoint quản trị (`/api/admin/pricing-config` và `/api/admin/system-config`) đều bảo đảm tính toàn vẹn, ghi phiên bản mới vào `PricingConfig` và vô hiệu hóa cache đồng bộ.

