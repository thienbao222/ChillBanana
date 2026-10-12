# Ghi chú: Neo Universe làm nhân vật AI trên website ChillBanana

## Mục tiêu

Thêm một nhân vật chuyển động vào website để làm giao diện tương tác cho trợ lý AI tư vấn khách hàng. Nhân vật có thể chào khách, lắng nghe, thể hiện đang xử lý, giới thiệu sản phẩm, đề xuất lựa chọn và hỗ trợ khi có vấn đề. Người dùng có thể thu gọn hoặc ẩn nhân vật; giao diện cần phù hợp trên điện thoại.

Nhân vật dự kiến: **Neo Universe** trong *Umamusume*.

## Quyết định kỹ thuật hiện tại

- Chưa có model Live2D hoặc PSD phân lớp; NeoV2 là sprite sheet 2D, không phải model Live2D đã rig.
- Đã chọn tích hợp **sprite animation** vào widget chatbot khách hàng hiện có. Trình duyệt phát lần lượt các khung hình 6×6.
- Widget dùng Idle khi đóng; Ask khi chào lần đầu; Analyze khi AI đang xử lý; Listen khi đang chat; và chọn Explain/Product/Recommend/Confirm theo nội dung phản hồi gần nhất.
- Tôn trọng thiết lập `prefers-reduced-motion`: vòng sprite giữ nhịp 36 frame/3 giây để không bị khựng; tự đi dạo sẽ tắt.
- Live2D có thể là bước nâng cấp sau nếu có PSD nhiều layer và model đã rig trong Cubism Editor. Sprite sheet không tự chuyển thành model Live2D.

## Tài nguyên và trạng thái triển khai

- Thư mục nguồn: `NeoUniverse/`
- Có 8 sprite sheet, mỗi sheet là lưới 6×6, tổng 36 khung hình mỗi animation.
- Đã tạo script `NeoUniverse/extract_frames.py` để cắt từng khung theo thứ tự từ trái sang phải, từ trên xuống dưới.
- Đã tạo 288 khung WebP lossless trong `NeoUniverse/extracted/` và manifest tại `NeoUniverse/manifest.json`.
- Trang preview: `NeoUniverse/preview.html`; có chọn animation, phát/tạm dừng, phát lại và chỉnh tốc độ.
- Preview đã được mở tại `http://127.0.0.1:8123/preview.html` để kiểm tra. Tất cả 8 animation tải được; phát/dừng đã được kiểm tra.
- Tổng thư mục khung đã trích xuất khoảng 65 MB.

### Bộ NeoV2 được tích hợp

- Thư mục nguồn: `NeoUniverse/NeoV2/`; có 10 sprite sheet PNG 3840×3840, mỗi sheet là lưới 6×6 nền trong suốt.
- Đã tạo script `scripts/prepare-neov2-assets.py` để cắt/chuẩn hóa từng frame vào cùng lưới, resize và xuất WebP.
- Tài nguyên production: `public/neo-universe/`; gồm 10 sprite sheet WebP và manifest, tổng khoảng 5.2 MB (giảm từ khoảng 60 MB PNG nguồn).
- Component phát frame: `src/components/NeoUniverseSprite.tsx`; dùng `requestAnimationFrame` và thời gian thực để phát đủ 36 frame trong 3 giây (khoảng 83,33 ms/frame), chờ ảnh WebP giải mã trước khi bắt đầu để tránh khựng ở frame đầu.
- Widget đang liên kết đủ cả 10 sheet NeoV2: Analyze, hai biến thể Ask, Confirm, Di chuyển, Product presentation, Explain, Idle/Waiting, Recommend và Signal Received. Hai sheet Ask được chọn ngẫu nhiên mỗi lần chào, rê chuột vào pet hoặc khi phản hồi cần hỏi lại; Idle và Signal Received được dùng riêng cho trạng thái chờ và lắng nghe.
- Đã tích hợp vào nút nổi của `src/components/AIChatBot.tsx`; animation đổi theo chat và nội dung phản hồi.
- Đã chạy `npm run build` thành công sau tích hợp.

## Animation hiện có

| ID | Tên trong bộ ảnh | Vai trò có thể dùng trên website |
| --- | --- | --- |
| `first-contact` | First Contact — Chào đón khách hàng | Lần đầu mở chat / chào khách |
| `signal-reception` | Signal Reception — Lắng nghe khách hàng | Khách đang nhập hoặc đang trao đổi |
| `processing` | Processing — Đang kiểm tra yêu cầu | AI đang chờ xử lý câu hỏi |
| `cosmic-analysis` | Cosmic Analysis — Phân tích nhu cầu | AI phân tích nhu cầu khách hàng |
| `orbital-recommendation` | Orbital Recommendation — Đề xuất lựa chọn | AI đưa đề xuất |
| `product-discovery` | Product Discovery — Giới thiệu sản phẩm | AI hiển thị hoặc giới thiệu sản phẩm |
| `connection-established` | Connection Established — Hoàn tất giao dịch | Xác nhận hoàn tất một bước trao đổi/giao dịch |
| `anomaly-detected` | Anomaly Detected — Giải quyết thắc mắc | Hỗ trợ khi khách gặp lỗi hoặc vấn đề |

Tên và vai trò ở cột cuối chỉ là gợi ý; cần xem chuyển động thực tế trước khi gán vào các trạng thái AI.

## Watermark và nền ảnh

- Bộ cũ ở `NeoUniverse/` có watermark LUDO phủ lên nhân vật; giữ nguyên, không xóa.
- Bộ mới ở `NeoUniverse/NeoV2/` có nền trong suốt và không thấy watermark; đây là bộ được dùng trong website.
- Không xóa hoặc che watermark trong bộ hiện tại. Việc tự xóa làm mất dấu nguồn và có thể phá hỏng chi tiết nằm dưới watermark.
- Trước khi tích hợp lên website công khai, cần xuất lại tài nguyên không watermark theo tùy chọn được phép của Ludo.ai hoặc dùng tài nguyên mà người dùng có quyền sử dụng.
- Nếu không lấy được bản sạch, nên tạo mascot gốc không sao chép Neo Universe để dùng lâu dài.

## Việc đã làm và phần còn lại

- Đã thay mascot chuối ở nút mở chatbot bằng Neo Universe sprite animation.
- Đã gắn trạng thái chuyển động với chào khách, AI đang xử lý, lắng nghe và các loại phản hồi phổ biến.
- Đã giữ điều khiển đóng/mở chatbot, thêm nhãn/nút phù hợp cho mascot và hỗ trợ reduced motion.
- Đã tối ưu ảnh production xuống khoảng 5.2 MB, kiểm tra TypeScript và production build thành công.
- Cần kiểm tra trực quan trên website local và sau deploy Vercel; xác nhận quyền sử dụng hình ảnh nhân vật/tài nguyên nếu phát hành công khai.

### Nâng cấp trải nghiệm pet trên website

- Dùng animation `move` khi di chuyển và `ask-alt` từ sheet `(1)` để Neo chào, hỏi nhu cầu; sheet `Ask — Hỏi nhu cầu_sheet.png` bị loại khỏi Neo.
- Có thể kéo Neo bằng chuột hoặc cảm ứng đến vị trí tùy ý trong cửa sổ; vị trí được lưu trên thiết bị. Có nút tạm dừng/tiếp tục đi dạo, đưa Neo về góc mặc định, ẩn và hiện lại.
- Hover vào Neo kích hoạt động tác chào; nhấn Neo mở hội thoại thu gọn ngay cạnh nhân vật. Người dùng gửi tin nhắn, dùng gợi ý nhanh và nhận trả lời qua cùng API `/api/ai/chat` với lịch sử hội thoại hiện tại; nội dung phản hồi được gõ dần trong bong bóng chat và có thể chuyển sang khung chat đầy đủ.
- Animation đổi theo lúc chờ, nghe, xử lý và loại câu trả lời; khi nhập tin nhắn Neo chuyển sang trạng thái lắng nghe.
- Bong bóng thoại nổi có hiệu ứng gõ chữ, hiển thị gợi ý khi rê chuột/di chuyển và tóm tắt câu trả lời mới nhất sau khi đóng chat.
- Cả hội thoại mini và khung chat lớn đều nhận ảnh bằng nút chọn tệp hoặc Ctrl+V; ảnh được xem trước, có thể bỏ trước khi gửi, được nén ở trình duyệt để phù hợp giới hạn request của Vercel. AI Vision chỉ đọc dấu hiệu trong ảnh rồi tạo từ khóa tìm trên Amazon JP, Mercari và Rakuten; không xác nhận kết quả trùng ảnh, tồn kho, tính chính hãng hoặc giá hiện hành.
- Khi cuộn trang, Neo bước nhẹ theo hướng vào trong viewport và hiện lời nhắc; kích thước màn hình thay đổi thì vị trí của Neo được giới hạn lại trong viewport.
- Overlay dùng `pointer-events-none` ở nền và chỉ bật nhận thao tác tại nhân vật, các nút điều khiển, hộp thoại; z-index đặt cao để nổi trên nội dung trang.
- Khi khung chat đầy đủ mở, nhân vật vẫn xuất hiện ở phần đầu khung chat.
- Tự đi dạo dừng khi người dùng bật `prefers-reduced-motion`; các sheet vẫn phát theo vòng 3 giây để trạng thái lắng nghe/xử lý/trả lời giữ cùng nhịp.
- Đây là mô phỏng pet bằng sprite sheet và chuyển động CSS trong viewport website. Chuyển động của nhân vật vẫn giới hạn theo các khung hình đã xuất; muốn xoay người, nhìn theo con trỏ, cử động từng bộ phận hoặc phản ứng tùy ý như model rig thì cần model Live2D/Spine có rig và các animation tương ứng.

## Trạng thái hiện tại

Preview cũ và các khung tách của bản Ludo có watermark vẫn nằm local trong `NeoUniverse/`, không được tích hợp. Bản NeoV2 đã được tối ưu và tích hợp vào widget tư vấn; các thay đổi được đẩy lên GitHub để Vercel triển khai.
