# -*- coding: utf-8 -*-
import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

def add_toc(doc):
    p = doc.add_paragraph()
    run = p.add_run()
    fldChar = OxmlElement('w:fldChar')
    fldChar.set(qn('w:fldCharType'), 'begin')
    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = 'TOC \\o "1-3" \\h \\z \\u'
    fldChar2 = OxmlElement('w:fldChar')
    fldChar2.set(qn('w:fldCharType'), 'separate')
    fldChar3 = OxmlElement('w:fldChar')
    fldChar3.set(qn('w:fldCharType'), 'end')
    run._r.append(fldChar)
    run._r.append(instrText)
    run._r.append(fldChar2)
    run._r.append(fldChar3)
    p = doc.add_paragraph(style='Normal')
    p.add_run("[Vui lòng click chuột phải vào đây và chọn 'Update Field' để cập nhật Mục lục tự động]").italic = True

def add_heading(doc, text, level):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.name = 'Times New Roman'
        run.font.color.rgb = RGBColor(0, 0, 0)
        if level == 1:
            run.font.size = Pt(14)
            run.bold = True
        elif level == 2:
            run.font.size = Pt(13)
            run.bold = True
        elif level == 3:
            run.font.size = Pt(13)
            run.italic = True
    return h

def add_p(doc, text, bold_prefix="", indent=True):
    p = doc.add_paragraph()
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.3
    if indent:
        p.paragraph_format.first_line_indent = Inches(0.5)
    
    if bold_prefix:
        r_b = p.add_run(bold_prefix)
        r_b.bold = True
        r_b.font.name = 'Times New Roman'
        r_b.font.size = Pt(13)
    
    if text:
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(13)
    return p

def create_table(doc, headers, data):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = 'Table Grid'
    hdr_cells = table.rows[0].cells
    for i, header in enumerate(headers):
        hdr_cells[i].text = header
        for p in hdr_cells[i].paragraphs:
            for r in p.runs:
                r.font.bold = True
                r.font.name = 'Times New Roman'
                r.font.size = Pt(12)
    
    for row_data in data:
        row_cells = table.add_row().cells
        for i, cell_data in enumerate(row_data):
            row_cells[i].text = str(cell_data)
            for p in row_cells[i].paragraphs:
                for r in p.runs:
                    r.font.name = 'Times New Roman'
                    r.font.size = Pt(12)
    
    doc.add_paragraph() # space after table

doc = Document()
style = doc.styles['Normal']
font = style.font
font.name = 'Times New Roman'
font.size = Pt(13)

# 1. Bìa
def add_title(text, size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER):
    p = doc.add_paragraph()
    p.alignment = align
    r = p.add_run(text)
    r.font.name = 'Times New Roman'
    r.font.size = Pt(size)
    r.bold = bold

add_title("TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT", 16)
add_title("Viện Công Nghệ Số", 16)
for _ in range(5): doc.add_paragraph()
add_title("BÁO CÁO GIỮA KỲ", 15)
add_title("Học phần: Thương mại điện tử", 16)
for _ in range(2): doc.add_paragraph()
add_title("Đề tài", 18)
add_title("XÂY DỰNG WEBSITE MUA HỘ HÀNG NỘI ĐỊA NHẬT CHILLBANANA", 18)
for _ in range(3): doc.add_paragraph()
add_p(doc, "SVTH: Đỗ Thiện Bảo", indent=False).paragraph_format.left_indent = Inches(2.5)
add_p(doc, "MSSV: 2494802010002", indent=False).paragraph_format.left_indent = Inches(2.5)
for _ in range(8): doc.add_paragraph()
add_title("BÌNH DƯƠNG - 2026", 13)

doc.add_page_break()

# Mục lục
add_heading(doc, "MỤC LỤC", 1)
add_toc(doc)
doc.add_page_break()

# MỞ ĐẦU
add_heading(doc, "MỞ ĐẦU", 1)
add_heading(doc, "1. Lý do chọn đề tài", 2)
add_p(doc, "Trong bối cảnh hội nhập quốc tế và sự bùng nổ của thương mại điện tử xuyên biên giới, nhu cầu tiêu dùng các sản phẩm nội địa Nhật Bản (như mỹ phẩm, đồ điện tử 100V, thực phẩm chức năng) tại Việt Nam ngày càng tăng cao do sự tin tưởng vào chất lượng và tiêu chuẩn khắt khe của Nhật Bản.")
add_p(doc, "Tuy nhiên, người tiêu dùng Việt Nam khi muốn mua hàng trực tiếp từ các sàn thương mại điện tử nội địa Nhật (như Amazon JP, Mercari) thường vấp phải những rào cản lớn về ngôn ngữ, phương thức thanh toán quốc tế, và đặc biệt là yêu cầu phải có địa chỉ nhận hàng tại nội địa Nhật Bản. Để giải quyết vấn đề này, các dịch vụ mua hộ (order) xách tay đã ra đời. Tuy nhiên, thực trạng chung của các dịch vụ này hiện nay là sự thiếu minh bạch trong cấu trúc chi phí (tỷ giá hối đoái thường bị đẩy lên cao hơn thực tế, cước phí vận chuyển bị tính gộp không rõ ràng) và quy trình quản lý đơn hàng chủ yếu qua tin nhắn thủ công, khiến trải nghiệm người dùng bị hạn chế.")
add_p(doc, "Nhận thấy những điểm nghẽn đó, đề tài \"Xây dựng website mua hộ hàng nội địa Nhật ChillBanana\" được lựa chọn thực hiện. Đề tài hướng tới việc xây dựng một hệ thống website minh bạch, tự động hóa quy trình tính giá dựa trên tỷ giá liên ngân hàng thời gian thực (Live Exchange Rate), số hóa quy trình đặt cọc, và cung cấp khả năng tra cứu hành trình đơn hàng chuyên nghiệp cho khách hàng.")

add_heading(doc, "2. Mục tiêu của đề tài", 2)
add_p(doc, "", bold_prefix="Mục tiêu tổng quát: ")
add_p(doc, "Xây dựng hoàn chỉnh một ứng dụng web thương mại điện tử chuyên biệt cho dịch vụ mua hộ hàng Nhật, tối ưu hóa quy trình từ khâu tra cứu giá, đặt cọc đến theo dõi vận đơn, đồng thời cung cấp công cụ quản trị (Admin Dashboard) hiệu quả cho nhân viên vận hành.")
add_p(doc, "", bold_prefix="Các mục tiêu cụ thể: ")
add_p(doc, "- Phát triển module tính giá tự động tích hợp API tỷ giá thời gian thực.")
add_p(doc, "- Xây dựng luồng giỏ hàng và thanh toán đặt cọc an toàn, tích hợp cổng thanh toán VNPAY (Môi trường Sandbox).")
add_p(doc, "- Triển khai hệ thống theo dõi đơn hàng (Tracking) qua 7 chặng minh bạch.")
add_p(doc, "- Xây dựng phân hệ quản trị (Admin) tách biệt, bảo mật bằng HMAC-SHA256.")
add_p(doc, "- Tích hợp Trợ lý ảo AI (sử dụng Google Gemini 2.5) để tư vấn khách hàng và tự động trích xuất dữ liệu xu hướng (từ khóa, cảm xúc) hỗ trợ quản trị viên phân tích thị trường.")

add_heading(doc, "3. Đối tượng và phạm vi nghiên cứu", 2)
add_p(doc, "Đối tượng nghiên cứu: ", bold_prefix="Đối tượng nghiên cứu: ")
add_p(doc, "Kiến trúc hệ thống web hiện đại, các quy trình nghiệp vụ mua hộ hàng hóa quốc tế và kỹ thuật tích hợp AI vào thương mại điện tử.")
add_p(doc, "Phạm vi chức năng: ", bold_prefix="Phạm vi chức năng: ")
add_p(doc, "Đề tài giới hạn trong việc phát triển các chức năng cốt lõi đã được hiện thực hóa trong mã nguồn (source code) của dự án ChillBanana, bao gồm: giao diện khách hàng, giỏ hàng, tra cứu đơn, chat AI, và giao diện quản trị nội bộ.")
add_p(doc, "Phạm vi công nghệ: ", bold_prefix="Phạm vi công nghệ: ")
add_p(doc, "Sử dụng framework Next.js 14, cơ sở dữ liệu PostgreSQL (qua Prisma ORM) và tích hợp API Gemini AI.")

# CHƯƠNG 1
doc.add_page_break()
add_heading(doc, "CHƯƠNG 1: TỔNG QUAN NGHIÊN CỨU", 1)
add_heading(doc, "1.1. Bối cảnh và vấn đề thực tế", 2)
add_p(doc, "Kinh doanh mua hộ hàng hóa xuyên biên giới đang là một mô hình thiết yếu. Khách hàng cung cấp liên kết (link) sản phẩm từ các website nước ngoài, đơn vị mua hộ sẽ tiến hành thanh toán, nhận hàng tại kho nước ngoài và vận chuyển về Việt Nam. Vấn đề lớn nhất của mô hình này tại Việt Nam là sự chênh lệch thông tin giữa người mua và đơn vị cung cấp dịch vụ. Khách hàng không nắm rõ tỷ giá gốc, không biết chính xác trọng lượng kiện hàng cho đến khi nhận, dẫn đến tâm lý nghi ngờ về các khoản phụ phí.")

add_heading(doc, "1.2. Tổng quan giải pháp ChillBanana", 2)
add_p(doc, "ChillBanana được thiết kế để giải quyết bài toán cốt lõi là \"Sự minh bạch\". Hệ thống loại bỏ việc báo giá thủ công qua tin nhắn. Khách hàng chỉ cần dán liên kết sản phẩm, hệ thống tự động bóc tách và quy đổi sang VNĐ theo tỷ giá mua vào/bán ra của ngân hàng ngay tại thời điểm đó. Cước vận chuyển quốc tế được tách bạch hoàn toàn khỏi giá thành sản phẩm và chỉ được tính toán chính xác khi hàng hóa đã nhập kho tại Tokyo và được đưa lên bàn cân.")

add_heading(doc, "1.3. Đối tượng sử dụng hệ thống", 2)
add_p(doc, "Hệ thống phục vụ hai nhóm đối tượng chính:")
add_p(doc, "- Khách hàng cá nhân: Những người có nhu cầu mua sắm hàng Nhật nhưng không có thẻ tín dụng quốc tế hoặc địa chỉ nhận hàng tại Nhật.")
add_p(doc, "- Quản trị viên/Nhân viên vận hành: Những người thực hiện việc mua hàng trên sàn Nhật, cập nhật trạng thái kho bãi, cân nặng và chăm sóc khách hàng.")

add_heading(doc, "1.4. Phân tích nhu cầu và các chức năng cần thiết", 2)
add_p(doc, "Thông qua việc phân tích hành vi mua sắm thực tế, dự án xác định các nhu cầu thiết yếu cần được tin học hóa:")
add_p(doc, "- Nhu cầu tự tính giá: Cần một công cụ (Order Calculator) để khách hàng tự túc dự toán chi phí.")
add_p(doc, "- Nhu cầu theo dõi hành trình: Cần hệ thống Stepper hiển thị trực quan các mốc thời gian của kiện hàng (Pending, Purchasing, Warehouse JP, Transit, Warehouse VN).")
add_p(doc, "- Nhu cầu tư vấn tự động: Cần ứng dụng AI để trả lời các câu hỏi đặc thù về hàng Nhật (như cảnh báo điện áp 100V, tư vấn size quần áo) để giảm tải cho nhân sự trực page.")

# CHƯƠNG 2
doc.add_page_break()
add_heading(doc, "CHƯƠNG 2: PHƯƠNG PHÁP NGHIÊN CỨU VÀ CÔNG NGHỆ ÁP DỤNG", 1)

add_heading(doc, "2.1. Phương pháp phát triển phần mềm", 2)
add_p(doc, "Dự án sử dụng phương pháp phát triển Agile/Scrum linh hoạt, cho phép xây dựng và hoàn thiện từng module (như Module Khách hàng, Module Giỏ hàng, Module Admin) một cách độc lập và tích hợp liên tục.")

add_heading(doc, "2.2. Công nghệ sử dụng", 2)
add_p(doc, "Dự án được xây dựng trên một ngăn xếp công nghệ (Tech Stack) hiện đại, đồng bộ bằng ngôn ngữ TypeScript từ Frontend đến Backend.")
add_heading(doc, "2.2.1. Frontend", 3)
add_p(doc, "- Next.js 14 (App Router): Đóng vai trò là framework cốt lõi, cung cấp khả năng kết hợp giữa Server Components (tối ưu SEO, giảm tải phía client) và Client Components (xử lý tương tác UI).")
add_p(doc, "- TailwindCSS: Framework CSS tiện ích giúp xây dựng giao diện nhanh chóng, đảm bảo tính responsive trên cả Desktop và thiết bị di động.")
add_p(doc, "- Lucide React: Thư viện cung cấp các biểu tượng (icons) sắc nét, tối ưu dung lượng.")
add_heading(doc, "2.2.2. Backend và API", 3)
add_p(doc, "- Next.js Route Handlers: Xây dựng các API RESTful nội bộ trực tiếp bên trong cấu trúc của Next.js (thư mục app/api/...) để xử lý logic lấy tỷ giá, tạo đơn hàng, và phân tích AI.")
add_heading(doc, "2.2.3. Cơ sở dữ liệu (Database)", 3)
add_p(doc, "- PostgreSQL (triển khai trên nền tảng Neon Serverless): CSDL quan hệ chính của hệ thống, đảm bảo tính toàn vẹn dữ liệu cho các giao dịch tài chính.")
add_p(doc, "- Prisma ORM: Công cụ giao tiếp với CSDL, giúp định nghĩa lược đồ (schema) minh bạch bằng file schema.prisma và thao tác dữ liệu thông qua các hàm an toàn kiểu (type-safe).")
add_heading(doc, "2.2.4. Trí tuệ nhân tạo (AI)", 3)
add_p(doc, "- Google Gemini 2.5 Flash: Tích hợp qua thư viện @google/genai, cung cấp khả năng hiểu ngôn ngữ tự nhiên để đóng vai trò trợ lý tư vấn (Omotenashi/Vietnamese style) và trích xuất dữ liệu ẩn.")
add_heading(doc, "2.2.5. Triển khai (Deployment)", 3)
add_p(doc, "- Vercel (Serverless Platform): Nền tảng triển khai ứng dụng Next.js được lựa chọn do khả năng tích hợp sâu với framework. Vercel tự động tạo môi trường Preview cho mỗi commit, hỗ trợ CI/CD không cần cấu hình phức tạp và cung cấp biến môi trường VERCEL_URL tự động để các API nội bộ nhận biết đúng địa chỉ host đang chạy.")
add_p(doc, "- Neon (Serverless PostgreSQL): Dịch vụ PostgreSQL dạng serverless được lựa chọn thay thế cho SQLite khi đưa lên Vercel. Neon hỗ trợ Pooling Connection đặc biệt phù hợp với môi trường serverless, giải quyết bài toán giới hạn kết nối đồng thời mà SQLite và các CSDL truyền thống không thể đáp ứng.")
add_heading(doc, "2.2.6. Cổng thanh toán (Payment Gateway)", 3)
add_p(doc, "- VNPAY Sandbox: Cổng thanh toán trực tuyến của VNPAY được tích hợp ở môi trường Sandbox (thử nghiệm). Hệ thống tự sinh URL thanh toán có chữ ký HMAC-SHA512, chuyển hướng khách hàng sang trang VNPAY để thực hiện thanh toán, sau đó nhận kết quả qua Return URL (webhook một chiều). Khi thanh toán thành công, trạng thái đơn hàng tự động được cập nhật sang DEPOSITED_50 và PURCHASING_JP trong cơ sở dữ liệu mà không cần nhân viên can thiệp thủ công.")

add_heading(doc, "2.3. Kiến trúc hệ thống", 2)
add_p(doc, "Hệ thống áp dụng kiến trúc Client-Server liền mạch (Monolithic-like architecture) nhờ Next.js. Luồng xử lý tiêu biểu: Người dùng tương tác giao diện (Client) -> Gọi API nội bộ (Route Handlers) -> API kiểm tra xác thực (HMAC Auth) -> Tương tác Database (Prisma) -> Trả về kết quả JSON -> Client cập nhật UI.")

add_heading(doc, "2.4. Thiết kế cơ sở dữ liệu", 2)
add_p(doc, "Dựa trên mã nguồn thực tế (prisma/schema.prisma), hệ thống bao gồm các thực thể chính: Customer, Order, Product, TrackingLog và ChatSession. Mối quan hệ được thiết lập chặt chẽ, ví dụ: Một Customer có nhiều Order, mỗi Order có nhiều TrackingLog lưu lại lịch sử thay đổi trạng thái.")

add_heading(doc, "2.5. Các luồng hoạt động (Data Flows) minh họa", 2)
add_p(doc, "Luồng 1: Quy trình Tính giá và Đặt hàng", bold_prefix="1. Luồng Tính giá và Đặt hàng: ")
add_p(doc, "- Bước 1 (Input): Khách hàng dán liên kết sản phẩm và nhập giá Yên Nhật (JPY) gốc.")
add_p(doc, "- Bước 2 (Process - Exchange Rate): Frontend gọi API `/api/exchange-rate`, backend kết nối `open.er-api.com` lấy tỷ giá thời gian thực.")
add_p(doc, "- Bước 3 (Process - Calculate): Frontend tính toán (Giá JPY * Tỷ giá) + Phí dịch vụ (4% hoặc min 20K). Khách hàng thêm vào giỏ.")
add_p(doc, "- Bước 4 (Checkout): Hệ thống lấy tổng tiền (không gồm cước vận chuyển) chia đôi (cọc 50%). Hệ thống gọi API `/api/orders` tạo bản ghi Đơn hàng mới vào PostgreSQL.")
add_p(doc, "- Bước 5 (Output): Hệ thống sinh mã QR Napas chứa Mã đơn hàng. Khách hàng tiến hành chuyển khoản.")

add_p(doc, "Luồng 2: Quy trình AI Khai phá dữ liệu", bold_prefix="2. Luồng AI Khai phá dữ liệu: ")
add_p(doc, "- Bước 1 (Input): Khách hàng nhắn tin hỏi về sản phẩm qua Chatbot UI.")
add_p(doc, "- Bước 2 (Process - Prompting): Hệ thống đính kèm System Prompt (hướng dẫn AI đóng vai chuyên gia hàng Nhật, tính cách lịch thiệp, và yêu cầu trả về metadata).")
add_p(doc, "- Bước 3 (Process - Gemini AI): API `/api/ai/chat` gửi request tới Google Gemini 2.5 Flash. AI sinh ra câu trả lời và trích xuất ngầm `topic, keywords, sentiment` dưới định dạng JSON.")
add_p(doc, "- Bước 4 (Database): Hệ thống lưu song song câu trả lời hiển thị cho khách và chuỗi JSON siêu dữ liệu vào bảng `ChatSession`.")
add_p(doc, "- Bước 5 (Output Admin): Giao diện Admin gọi API `/api/admin/chat-trends` để hiển thị biểu đồ xu hướng.")

add_p(doc, "Luồng 3: Quy trình Quản lý Hành trình Đơn hàng", bold_prefix="3. Luồng Quản lý Hành trình Đơn hàng: ")
add_p(doc, "- Bước 1 (Update): Admin đăng nhập (xác thực qua HMAC Cookie), vào bảng điều khiển cập nhật trạng thái đơn (vd: Hàng về kho Tokyo, nặng 2kg).")
add_p(doc, "- Bước 2 (Database): API `/api/orders/[id]` ghi nhận trạng thái mới, tự động sinh thêm phí vận chuyển dựa trên cân nặng, và tạo một bản ghi mới trong bảng `TrackingLog`.")
add_p(doc, "- Bước 3 (Output Client): Khách hàng vào trang `/tracking`, nhập mã đơn. Dữ liệu đổ về từ CSDL sẽ tự động hiển thị Stepper và log hành trình theo thời gian thực.")

# CHƯƠNG 3
doc.add_page_break()
add_heading(doc, "CHƯƠNG 3: KẾT QUẢ NGHIÊN CỨU VÀ THẢO LUẬN", 1)

add_heading(doc, "3.1. Tổng quan sản phẩm đã xây dựng", 2)
add_p(doc, "Website ChillBanana đã hoàn thiện và đáp ứng đúng các mục tiêu ban đầu. Giao diện được chia thành hai phân hệ độc lập: Trang chủ dành cho khách hàng (mang phong cách thương mại điện tử hiện đại) và Trang quản trị (Admin Dashboard - thiết kế theo dạng bảng điều khiển quản lý nghiệp vụ).")

add_heading(doc, "3.2. Kết quả xây dựng các chức năng cốt lõi", 2)
add_p(doc, "1. Chức năng tự động tính giá (Order Calculator)", bold_prefix="1. Chức năng tự động tính giá: ")
add_p(doc, "Khi khách hàng nhập giá trị Yên Nhật, hệ thống gọi API `fetchLiveExchangeRate` từ open.er-api.com để lấy tỷ giá thực (ví dụ 1 JPY = 168 VND). Thuật toán trong mã nguồn thực hiện quy đổi và cộng thêm 4% phí dịch vụ mua hộ (mức tối thiểu 20.000 VNĐ). Kết quả hiển thị tức thời cho người dùng.")
add_p(doc, "2. Chức năng Giỏ hàng và Thanh toán Đặt cọc", bold_prefix="2. Chức năng Giỏ hàng và Thanh toán: ")
add_p(doc, "Dự án đã lập trình Context API (`CartContext.tsx`) để quản lý trạng thái giỏ hàng. Khi khách hàng tiến hành chốt đơn, hệ thống tạo mã đơn hàng duy nhất có chứa timestamp để chống trùng lặp (vd: CB-2026-X8F-123). Điểm nổi bật là logic thanh toán chỉ yêu cầu cọc đúng 50% tiền hàng (không bao gồm cước bay quốc tế do chưa có dữ liệu cân nặng thực tế lúc này).")
add_p(doc, "3. Chức năng Quản lý hành trình đơn hàng (Tracking)", bold_prefix="3. Chức năng Quản lý hành trình (Tracking): ")
add_p(doc, "Mã nguồn định nghĩa 7 trạng thái cố định cho đơn hàng. Khách hàng truy cập trang `/tracking` nhập mã đơn để xem tiến độ dưới dạng sơ đồ Stepper. Nếu kiện hàng đã ở nội địa Nhật hoặc Việt Nam, hệ thống hiển thị thêm mã vận đơn nội địa tương ứng (jpTrack/vnTrack).")
add_p(doc, "4. Trợ lý AI và Khai phá dữ liệu (AI Analytics)", bold_prefix="4. Trợ lý AI và Khai phá dữ liệu: ")
add_p(doc, "Thay vì dùng chatbot theo kịch bản cứng, ChillBanana dùng AI tạo sinh (Generative AI). Trong API `/api/ai/chat`, mỗi khi khách hàng hỏi đáp, AI không chỉ trả lời mà còn được yêu cầu trả về một khối JSON ngầm định (metadata) chứa `topic` (chủ đề), `keywords` (từ khóa) và `sentiment` (cảm xúc). Dữ liệu này được lưu trực tiếp vào CSDL để thống kê thành bảng 'Chat Trends' bên phía Admin.")

add_heading(doc, "3.3. Kết quả xác thực và phân quyền (Security)", 2)
add_p(doc, "Đây là một điểm sáng về kỹ thuật của dự án. Thay vì sử dụng các thư viện Auth cồng kềnh, hệ thống tự xây dựng cơ chế bảo mật phiên (session) bằng Cookie. Chuỗi dữ liệu phiên được mã hóa bằng thuật toán băm HMAC-SHA256 với một khóa bí mật (Secret Key) tại phía Server. Điều này ngăn chặn hoàn toàn việc người dùng cố tình chỉnh sửa Cookie trên trình duyệt để giả mạo quyền Quản trị viên (Admin) hoặc giả mạo danh tính khách hàng khác. Các API quan trọng như `/api/products` (phương thức PUT, DELETE) hay `/api/orders/[id]` đều được bọc qua hàm `verifyAdminSession`.")

add_heading(doc, "3.4. Thảo luận kết quả", 2)
add_p(doc, "Dự án đã giải quyết thành công bài toán minh bạch chi phí thông qua việc sử dụng API tỷ giá thời gian thực. Việc tách biệt cước bay quốc tế và tính tiền cọc 50% dựa trên thực tế nhận được sự đánh giá cao về mặt logic nghiệp vụ. Ứng dụng AI vào phân tích từ khóa khách hàng mở ra tiềm năng rất lớn cho việc định hướng nhập hàng bán sẵn (ready-stock) thay vì chỉ làm dịch vụ mua hộ thụ động.")
add_p(doc, "Tuy nhiên, tính năng 'Dán link sản phẩm' hiện tại chưa bóc tách (scrape) được toàn bộ dữ liệu phức tạp từ các trang thương mại điện tử bảo mật cao (như Amazon có cơ chế chống bot). Điểm cộng lớn của phiên bản hiện tại là đã thay thế việc kiểm tra chuyển khoản thủ công bằng việc tích hợp thành công Cổng thanh toán VNPAY (môi trường Sandbox) để tự động hóa hoàn toàn luồng nhận cọc và xác nhận trạng thái đơn hàng.")

# CHƯƠNG 4
doc.add_page_break()
add_heading(doc, "CHƯƠNG 4: GIẢI PHÁP VÀ KIẾN NGHỊ", 1)

add_heading(doc, "4.1. Giải pháp cải thiện hệ thống", 2)
add_p(doc, "- Về mặt thanh toán: Hiện tại hệ thống đang sử dụng cổng thanh toán VNPAY ở môi trường Sandbox phục vụ cho mục đích thử nghiệm và làm đồ án. Để đưa vào hoạt động kinh doanh thực tế, kiến nghị thực hiện thủ tục đăng ký định danh Merchant (KYC) với VNPAY để chuyển đổi API key sang môi trường Production, cho phép nhận tiền thật từ khách hàng.")
add_p(doc, "- Về mặt dữ liệu giá: Cần xây dựng một hệ thống Crawler tinh vi hơn hoặc sử dụng các API trả phí chuyên dụng để bóc tách chính xác giá tiền, hình ảnh và phân loại (variation) từ link Amazon Nhật/Mercari mà khách hàng cung cấp.")

add_heading(doc, "4.2. Giải pháp mở rộng nghiệp vụ", 2)
add_p(doc, "Từ dữ liệu Chat Trends do AI thu thập được, kiến nghị phát triển thêm module 'Hàng có sẵn' (Ready Stock). Những sản phẩm được khách hàng hỏi nhiều nhất sẽ được công ty chủ động nhập số lượng lớn bằng đường biển (giảm cước phí vận chuyển), sau đó đăng bán trực tiếp trên website mà khách hàng không cần chờ đợi thời gian order 14-20 ngày.")

# CHƯƠNG 5
doc.add_page_break()
add_heading(doc, "CHƯƠNG 5: KẾT LUẬN", 1)
add_heading(doc, "5.1. Kết quả đạt được", 2)
add_p(doc, "Đề tài đã hoàn thành xuất sắc việc xây dựng hệ thống website thương mại điện tử ChillBanana với kiến trúc Next.js 14 và cơ sở dữ liệu PostgreSQL. Hệ thống đã tin học hóa thành công quy trình mua hộ phức tạp, tạo ra một môi trường giao dịch minh bạch về tỷ giá và cước phí. Đặc biệt, việc ứng dụng AI Gemini không chỉ dừng lại ở bề nổi là chatbot giao tiếp, mà đã đi sâu vào khâu phân tích dữ liệu thị trường (Data Analytics).")

add_heading(doc, "5.2. Hướng phát triển trong tương lai", 2)
add_p(doc, "Trong giai đoạn tiếp theo, đề tài có thể hướng tới việc kết nối API trực tiếp với các đơn vị vận chuyển nội địa tại Việt Nam (GHTK, Viettel Post) để tự động sinh mã vận đơn và tính toán chính xác cước phí chặng cuối (Local Delivery) ngay khi hàng hóa nhập kho Việt Nam, tạo thành một chuỗi cung ứng khép kín hoàn toàn tự động.")

# TÀI LIỆU THAM KHẢO
doc.add_page_break()
add_heading(doc, "TÀI LIỆU THAM KHẢO", 1)
add_p(doc, "[1]. Next.js Documentation. Vercel. Có sẵn tại: https://nextjs.org/docs", indent=False)
add_p(doc, "[2]. Prisma ORM Documentation. Prisma Data Inc. Có sẵn tại: https://www.prisma.io/docs", indent=False)
add_p(doc, "[3]. Google Gemini API Reference. Google for Developers. Có sẵn tại: https://ai.google.dev/api", indent=False)
add_p(doc, "[4]. Tailwind CSS Documentation. Có sẵn tại: https://tailwindcss.com/docs", indent=False)
add_p(doc, "[5]. Neon Postgres Serverless Documentation. Có sẵn tại: https://neon.tech/docs", indent=False)

# Save document
doc.save(r"d:\BAITAP\TMDT\m 2494802010002_DoThienBao_GIUA KY.docx")
print("Done")

