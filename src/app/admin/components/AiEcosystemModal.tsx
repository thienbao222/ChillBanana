"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Bot,
  Eye,
  Plane,
  Link2,
  BarChart3,
  Cpu,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Layers,
  ChevronRight,
  Database,
  Mail,
  ShoppingCart,
  Languages,
  Package,
} from "lucide-react";

export type AiCategory = "all" | "customer" | "vision" | "maff" | "scraper" | "admin" | "infra";

export interface AiFeatureItem {
  id: string;
  category: "customer" | "vision" | "maff" | "scraper" | "admin" | "infra";
  title: string;
  model: string;
  purpose: string;
  solution: string;
  codePath: string;
  status: "ONLINE" | "READY";
  actionLabel?: string;
  actionTarget?: string; // e.g. "tab:analytics", "mode:vn_jp_dispatch", "link:/gui-hang-di-nhat", "action:open_chat"
}

export const AI_FEATURES_DATA: AiFeatureItem[] = [
  // NHÓM 1: TRỢ LÝ KHÁCH HÀNG
  {
    id: "catalog-search",
    category: "customer",
    title: "Tra Cứu Catalog CSDL Thật (Zero Hallucination)",
    model: "Gemini 3.5 Flash-Lite + Tool Calling",
    purpose: "Khách hỏi thông tin sản phẩm, giá tiền, số lượng còn trong kho.",
    solution: "AI gọi công cụ `catalog_search` truy vấn trực tiếp CSDL PostgreSQL thực tế, tuyệt đối không bịa đặt thông tin; hiển thị thẻ sản phẩm trực quan có nút mua ngay.",
    codePath: "src/features/ai/customer/support-tools.ts",
    status: "ONLINE",
    actionLabel: "Mở Chatbot Khách",
    actionTarget: "link:/",
  },
  {
    id: "add-to-cart",
    category: "customer",
    title: "Thêm Vào Giỏ Hàng Trực Tiếp (Actionable Add-to-Cart)",
    model: "Gemini 3.5 Flash-Lite + Tool `add_to_cart`",
    purpose: "Khách nhắn câu thoại đời thường: 'thêm món đó vào giỏ', 'lấy cho mình 1 hộp'.",
    solution: "AI kích hoạt công cụ `add_to_cart` tự động thêm sản phẩm vào giỏ hàng của khách mà không cần khách phải tự tìm nút bấm trên web.",
    codePath: "src/features/ai/customer/assistant.ts",
    status: "ONLINE",
    actionLabel: "Thử Nghiệm Chat",
    actionTarget: "link:/",
  },
  {
    id: "order-tracking",
    category: "customer",
    title: "Tra Cứu Vận Đơn & Giải Thích Lộ Trình Tự Động",
    model: "Gemini 3.5 Flash-Lite + Tool `check_order_status`",
    purpose: "Khách hỏi: 'đơn #CB-2026-XXXX của mình đến đâu rồi?'.",
    solution: "Tự động trích xuất mã đơn, kiểm tra tiến độ thực tế (tại Tokyo, đang bay, hay đã về kho VN) và giải thích chi tiết, thân thiện.",
    codePath: "src/features/ai/customer/support-tools.ts",
    status: "ONLINE",
    actionLabel: "Kiểm Tra Đơn",
    actionTarget: "tab:orders",
  },
  {
    id: "budget-parser",
    category: "customer",
    title: "Bóc Tách Ngân Sách Đời Thường (VND ⇄ JPY)",
    model: "Gemini + Regex Currency Parser",
    purpose: "Khách gõ tiếng lóng: 'tầm 500k', 'khoảng 1 man', '2-3 củ', 'dưới 1 triệu'.",
    solution: "Bóc tách chuẩn xác khoảng giá, tự động quy đổi tỷ giá JPY/VND thời gian thực và đề xuất danh sách sản phẩm vừa vặn với túi tiền.",
    codePath: "src/features/ai/customer/support-tools.ts",
    status: "ONLINE",
  },
  {
    id: "100v-voltage-guard",
    category: "customer",
    title: "Cảnh Báo Điện Áp 100V Nội Địa Nhật (Voltage Guard)",
    model: "AI Rule-Engine + Category Classifier",
    purpose: "Đồ gia dụng, điện tử Nhật dùng điện 100V, cắm trực tiếp 220V tại VN sẽ chập cháy.",
    solution: "Tự động nhận diện thiết bị điện (nồi cơm điện Tiger, máy sấy Panasonic, bàn ủi...) để đưa ra cảnh báo bắt buộc dùng biến áp đổi nguồn.",
    codePath: "src/features/ai/customer/support-policy.ts",
    status: "ONLINE",
  },
  {
    id: "multi-lang",
    category: "customer",
    title: "Nhận Diện & Phản Hồi Đa Ngôn Ngữ (Việt - Nhật - Anh)",
    model: "Gemini Multilingual Engine",
    purpose: "Phục vụ người Việt tại Nhật, du học sinh và khách quốc tế.",
    solution: "Tự động phát hiện chữ Hiragana/Katakana (tiếng Nhật), tiếng Anh hoặc tiếng Việt có dấu/không dấu để phản hồi đúng ngôn ngữ của khách.",
    codePath: "src/features/ai/customer/assistant.ts",
    status: "ONLINE",
  },
  {
    id: "content-moderation",
    category: "customer",
    title: "Bộ Lọc An Toàn Nội Dung (Content Moderation)",
    model: "Safety Classifier + Stopword Filter",
    purpose: "Ngăn chặn các nội dung độc hại, chính trị, nhạy cảm hoặc vi phạm pháp luật.",
    solution: "Tự động phát hiện và từ chối lịch sự, giữ vững môi trường thương mại điện tử văn minh, lành mạnh.",
    codePath: "src/features/ai/customer/assistant.ts",
    status: "ONLINE",
  },

  // NHÓM 2: THỊ GIÁC MÁY TÍNH AI (VISION)
  {
    id: "image-search",
    category: "vision",
    title: "Tìm Kiếm Sản Phẩm Bằng Hình Ảnh (Multimodal Vision)",
    model: "Gemini 2.5 Flash Vision",
    purpose: "Khách có ảnh sản phẩm nhưng không biết tên tiếng Nhật để tìm kiếm.",
    solution: "Khách tải ảnh chụp hoặc ảnh màn hình $\rightarrow$ Gemini Vision phân tích nhận diện tên sản phẩm, thương hiệu, model và giá tiền nhìn thấy trong ảnh.",
    codePath: "src/app/api/ai/image-analyze/route.ts",
    status: "ONLINE",
    actionLabel: "Thử Tải Ảnh Tại Chat",
    actionTarget: "link:/",
  },
  {
    id: "ocr-keywords",
    category: "vision",
    title: "Đọc Chữ Bao Bì & Trích Xuất Từ Khóa Kanji/Katakana",
    model: "Gemini Multimodal OCR",
    purpose: "Bao bì sản phẩm nội địa Nhật chứa nhiều chữ Hán và Katakana phức tạp.",
    solution: "Trích xuất chính xác từ khóa danh xưng tiếng Nhật gốc để tìm kiếm đúng món đồ trên các chợ nội địa Nhật Bản.",
    codePath: "src/app/api/ai/image-analyze/route.ts",
    status: "ONLINE",
  },
  {
    id: "catalog-match-links",
    category: "vision",
    title: "Khớp Ảnh Với Kho & Tự Sinh Link Săn Hàng 3 Sàn Nhật",
    model: "Image Catalog Matcher + Deep Linking",
    purpose: "Kết nối ảnh của khách với nguồn hàng thực tế để mua ngay.",
    solution: "So sánh ảnh với danh mục kho ChillBanana; nếu kho chưa có, AI tự động tạo link tìm kiếm sẵn trên Amazon JP, Mercari JP (đồ hiếm) và Rakuten.",
    codePath: "src/features/ai/customer/image-catalog-matcher.ts",
    status: "ONLINE",
  },

  // NHÓM 3: KIỂM DỊCH MAFF & HẢI QUAN VN -> JP
  {
    id: "maff-inspection",
    category: "maff",
    title: "Thẩm Định Kiểm Dịch Nông Nghiệp MAFF Nhật Bản",
    model: "Gemini Structured JSON + MAFF/IATA Rule-Engine",
    purpose: "Nhật Bản kiểm soát sinh học cực nghiêm, cấm thịt, xúc xích, ruốc, trứng, hạt giống.",
    solution: "Khách nhập danh mục đồ cần gửi đi Nhật $\rightarrow$ AI quét từng món, phân loại SAFE/CONDITIONAL/PROHIBITED và cảnh báo bỏ đồ cấm trước khi gửi bay.",
    codePath: "src/features/ai/vn-jp/maff-inspector.ts",
    status: "ONLINE",
    actionLabel: "Mở Trang Gửi Đi Nhật",
    actionTarget: "link:/gui-hang-di-nhat",
  },
  {
    id: "romaji-postal-validator",
    category: "maff",
    title: "Chuẩn Hóa Tên Romaji & Đối Soát Mã Bưu Điện 〒 7 Số",
    model: "Bưu Chính Nhật AI Engine",
    purpose: "Bưu tá Yamato/Sagawa không đọc được dấu tiếng Việt; mã 〒 sai sẽ thất lạc hàng.",
    solution: "Tự động chuyển tên người nhận sang chữ Latinh Romaji không dấu; đối soát mã 〒 7 số với Tỉnh/Thành tại Nhật Bản.",
    codePath: "src/features/ai/vn-jp/maff-inspector.ts",
    status: "ONLINE",
    actionLabel: "Xem Bàn Điều Phối",
    actionTarget: "mode:vn_jp_dispatch",
  },
  {
    id: "iata-box-calculator",
    category: "maff",
    title: "Tính Cước Thể Tích IATA & Gợi Ý Thùng Carton Tiêu Chuẩn",
    model: "IATA Volumetric Calculator",
    purpose: "Tránh bù lỗ khi gửi hàng nhẹ nhưng cồng kềnh (gấu bông, snack...) chiếm tải bay.",
    solution: "Áp dụng công thức hàng không quốc tế D×R×C/5000 và đề xuất kích thước thùng carton tiêu chuẩn (Box S, M, L) tối ưu chi phí.",
    codePath: "src/features/ai/vn-jp/maff-inspector.ts",
    status: "ONLINE",
  },
  {
    id: "customs-cn23",
    category: "maff",
    title: "Trợ Lý Hải Quan Tạo Tờ Khai CN23 Cho Admin",
    model: "Customs AI Dispatcher",
    purpose: "Admin cần làm thủ tục thông quan hàng không cho các kiện hàng VN gửi sang Nhật.",
    solution: "AI tự động dịch tên hàng tiếng Anh/Nhật chuẩn hải quan, mã HS Code, gợi ý chuyến bay (VN310/JL752) và bưu cục phát chặng cuối.",
    codePath: "src/app/admin/components/VnJpDispatchTab.tsx",
    status: "ONLINE",
    actionLabel: "Điều Phối VN ➔ JP",
    actionTarget: "mode:vn_jp_dispatch",
  },

  // NHÓM 4: BÓC TÁCH LINK SÀN NHẬT
  {
    id: "scraper-8-platforms",
    category: "scraper",
    title: "Bóc Tách Dữ Liệu Link Từ 8 Sàn TMĐT Nhật Bản",
    model: "Gemini 3.5 Flash + Multilateral Scraper",
    purpose: "Khách dán link hàng từ Mercari, Yahoo, Rakuten, Amazon JP, Surugaya, Uniqlo...",
    solution: "AI bóc tách tiêu đề gốc, ảnh đại diện, giá tiền Yên (JPY), tình trạng tồn kho và các biến thể phân loại (màu sắc, size).",
    codePath: "src/app/api/scrape-link/route.ts",
    status: "ONLINE",
    actionLabel: "Thử Dán Link",
    actionTarget: "link:/",
  },
  {
    id: "commercial-translator",
    category: "scraper",
    title: "Dịch Thuật Tiêu Đề Tiếng Nhật Sang Tiếng Việt Thương Mại",
    model: "Gemini Translation Engine",
    purpose: "Tiêu đề người bán Nhật thường chứa nhiều từ giật tít, icon, từ ngữ dư thừa.",
    solution: "Chuyển ngữ tự nhiên, súc tích, giữ nguyên các thông số kỹ thuật cốt lõi theo đúng văn phong thương mại điện tử chuyên nghiệp.",
    codePath: "src/app/api/scrape-link/route.ts",
    status: "ONLINE",
  },
  {
    id: "admin-price-check",
    category: "scraper",
    title: "Rà Soát Giá Sàn Gốc Tự Động Cho Admin (Price-Check)",
    model: "Scrape Verification Engine",
    purpose: "Admin duyệt giá đơn mua hộ cần biết người bán Nhật có tăng giá hay hết hàng không.",
    solution: "1-click 'Check Giá AI' trên bảng Admin để đối chiếu giá thời gian thực với link gốc sàn Nhật trong 5 giây.",
    codePath: "src/app/api/admin/price-check/route.ts",
    status: "ONLINE",
    actionLabel: "Xem Đơn Chờ Duyệt",
    actionTarget: "tab:orders",
  },

  // NHÓM 5: TRỢ LÝ QUẢN TRỊ & BI
  {
    id: "daily-insights",
    category: "admin",
    title: "Báo Cáo Kinh Doanh Chủ Động Mỗi Ngày (Daily Insights)",
    model: "Gemini 3.5 Flash + Cron 8:00 AM",
    purpose: "Quản lý cần bức tranh tổng thể về doanh thu và cơ hội thị trường mỗi sáng.",
    solution: "Chạy cron 8:00 sáng phân tích dữ liệu 24h: Tóm tắt doanh thu, đơn hàng, tổng hợp các mặt hàng khách hỏi nhiều mà kho chưa có, đề xuất 3 việc ưu tiên hôm nay.",
    codePath: "src/app/api/admin/daily-insights/route.ts",
    status: "ONLINE",
    actionLabel: "Xem Báo Cáo AI",
    actionTarget: "tab:analytics",
  },
  {
    id: "action-items",
    category: "admin",
    title: "AI Action Items (Bộ Việc Cần Can Thiệp Ngay)",
    model: "Deterministic Rules + AI Explanation",
    purpose: "Tránh bỏ quên đơn hàng hoặc xử lý chậm gây phàn nàn của khách hàng.",
    solution: "Tự động phát hiện và gom nhóm: Đơn chờ duyệt giá > 4h, Đơn sắp hết hạn giữ chỗ (30p), Đơn bị kẹt trạng thái vận chuyển lâu ngày.",
    codePath: "src/features/ai/admin/action-items.ts",
    status: "ONLINE",
    actionLabel: "Xem Phân Tích",
    actionTarget: "tab:analytics",
  },
  {
    id: "admin-copilot",
    category: "admin",
    title: "Admin AI Copilot (Hỏi Đáp Chuyên Sâu Kho Vận & Doanh Thu)",
    model: "Gemini Multi-module Router + PostgreSQL Snapshot",
    purpose: "Quản trị viên cần tra cứu số liệu kinh doanh nhanh mà không phải lọc CSDL thủ công.",
    solution: "Admin gõ câu hỏi tự nhiên: 'Doanh thu tuần này?', 'Kho Tokyo còn bao nhiêu kiện?' $\rightarrow$ AI đọc snapshot số liệu thật từ hệ thống và trả lời chi tiết.",
    codePath: "src/features/ai/admin/AdminAgentTab.tsx",
    status: "ONLINE",
    actionLabel: "Mở AI Copilot",
    actionTarget: "tab:analytics",
  },
  {
    id: "controlled-email",
    category: "admin",
    title: "Soạn Thảo Email Khách Hàng Tự Động (Human-in-the-Loop)",
    model: "Gemini Contextual Email Drafting",
    purpose: "Gửi email xin lỗi chậm chuyến bay, giục cọc báo giá hoặc điều chỉnh đơn hàng.",
    solution: "AI tự động soạn bản thảo email chuyên nghiệp, cảm thông; Admin được xem trước nội dung, chỉnh sửa câu chữ trước khi bấm gửi thật.",
    codePath: "src/features/ai/admin/controlled-email.ts",
    status: "ONLINE",
    actionLabel: "Xem Danh Sách Đơn",
    actionTarget: "tab:orders",
  },
  {
    id: "chat-trends",
    category: "admin",
    title: "Phân Tích Xu Hướng Hội Thoại & Khách Hàng Tiềm Năng",
    model: "Topic Clustering & Sentiment Analysis",
    purpose: "Nắm bắt thị hiếu người mua và phân loại khách hàng tiềm năng.",
    solution: "Gom cụm từ khóa khách hỏi nhiều nhất (Hot Trends), đo lường cảm xúc hài lòng/khiếu nại, tự động gắn nhãn khách tiềm năng (`CHAT_LEAD`) để chuyển đổi thành đơn.",
    codePath: "src/app/admin/components/AiTrendsTab.tsx",
    status: "ONLINE",
    actionLabel: "Xem Xu Hướng Chat",
    actionTarget: "tab:analytics",
  },

  // NHÓM 6: HẠ TẦNG KỸ THUẬT AI
  {
    id: "quota-key-pool",
    category: "infra",
    title: "Hệ Thống Quota Key Pool Phân Tầng Độc Lập",
    model: "ApiKeyPool Architecture",
    purpose: "Bảo đảm hoạt động 24/7 không bị tắc nghẽn quota giữa khách và admin.",
    solution: "Tách biệt 4 Key Pool độc lập: `chatKeyPool`, `adminKeyPool`, `visionKeyPool`, `scrapeKeyPool`; tự động xoay vòng round-robin và theo dõi cooldown.",
    codePath: "src/lib/api-key-manager.ts",
    status: "ONLINE",
  },
  {
    id: "model-fallback-chain",
    category: "infra",
    title: "Chuỗi Fallback Model Tự Động (Gemini 3.5 ➔ 3.1 ➔ 2.5)",
    model: "Adaptive Model Chain",
    purpose: "Tránh gián đoạn dịch vụ khi một model của Google chạm hạn mức HTTP 429 hoặc lỗi 503.",
    solution: "Tự động đổi khóa và nhảy sang model dự phòng kế tiếp trong chuỗi mà khách hàng không hề nhận thấy sự gián đoạn.",
    codePath: "src/lib/gemini-models.ts",
    status: "ONLINE",
  },
  {
    id: "offline-safety-net",
    category: "infra",
    title: "Mạng Lưới An Toàn Ngoại Tuyến (Rule-Based Safety Net)",
    model: "Hybrid Deterministic Fallback",
    purpose: "Đề phòng rủi ro mất kết nối toàn bộ API AI bên ngoài.",
    solution: "Tự động chuyển sang bộ từ điển tĩnh nội bộ để vẫn tra cứu được catalog, tính giá, tỷ giá và hướng dẫn khách liên hệ hotline/Zalo, không bao giờ bị sập trang.",
    codePath: "src/features/ai/customer/support-tools.ts",
    status: "ONLINE",
  },
];

const CATEGORY_TABS: { key: AiCategory; label: string; icon: React.ReactNode; count: number }[] = [
  { key: "all", label: "Tất cả", icon: <Layers className="w-3.5 h-3.5" />, count: AI_FEATURES_DATA.length },
  { key: "customer", label: "1. Trợ Lý Khách Hàng", icon: <Bot className="w-3.5 h-3.5 text-blue-600" />, count: AI_FEATURES_DATA.filter((i) => i.category === "customer").length },
  { key: "vision", label: "2. Thị Giác AI (Vision)", icon: <Eye className="w-3.5 h-3.5 text-purple-600" />, count: AI_FEATURES_DATA.filter((i) => i.category === "vision").length },
  { key: "maff", label: "3. Kiểm Dịch MAFF & Hải Quan", icon: <Plane className="w-3.5 h-3.5 text-emerald-600" />, count: AI_FEATURES_DATA.filter((i) => i.category === "maff").length },
  { key: "scraper", label: "4. Bóc Tách Link Sàn Nhật", icon: <Link2 className="w-3.5 h-3.5 text-amber-600" />, count: AI_FEATURES_DATA.filter((i) => i.category === "scraper").length },
  { key: "admin", label: "5. Trợ Lý Quản Trị & BI", icon: <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />, count: AI_FEATURES_DATA.filter((i) => i.category === "admin").length },
  { key: "infra", label: "6. Hạ Tầng & Quota Resilience", icon: <Cpu className="w-3.5 h-3.5 text-slate-600" />, count: AI_FEATURES_DATA.filter((i) => i.category === "infra").length },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tabKey: string) => void;
  onNavigateMode?: (modeKey: string) => void;
}

export default function AiEcosystemModal({ isOpen, onClose, onNavigateTab, onNavigateMode }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<AiCategory>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!isOpen) return null;

  const filteredFeatures = AI_FEATURES_DATA.filter((item) => {
    const matchesCat = selectedCategory === "all" || item.category === selectedCategory;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      item.title.toLowerCase().includes(term) ||
      item.model.toLowerCase().includes(term) ||
      item.purpose.toLowerCase().includes(term) ||
      item.solution.toLowerCase().includes(term) ||
      item.codePath.toLowerCase().includes(term);
    return matchesCat && matchesSearch;
  });

  const handleAction = (target?: string) => {
    if (!target) return;
    onClose();
    if (target.startsWith("tab:") && onNavigateTab) {
      const tab = target.replace("tab:", "");
      onNavigateTab(tab);
    } else if (target.startsWith("mode:") && onNavigateMode) {
      const mode = target.replace("mode:", "");
      onNavigateMode(mode);
    } else if (target.startsWith("link:")) {
      const url = target.replace("link:", "");
      window.open(url, "_blank");
    }
  };

  const handleCopySummary = () => {
    const lines = [
      "=== BẢN ĐỒ TOÀN BỘ ỨNG DỤNG AI TRONG DỰ ÁN CHILLBANANA ===",
      `Tổng số tính năng: ${AI_FEATURES_DATA.length} giải pháp AI`,
      "",
      ...AI_FEATURES_DATA.map((item, index) => `${index + 1}. [${item.title}]\n   - Mô hình: ${item.model}\n   - Mục đích: ${item.purpose}\n   - Giải pháp: ${item.solution}\n   - Mã nguồn: ${item.codePath}\n`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-50 via-indigo-50/70 to-purple-50 border-b border-slate-200 flex-shrink-0 relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 sm:right-6 sm:top-6 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-all shadow-sm"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-600 text-white shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Hệ Sinh Thái AI Đa Tầng</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              6 Nhóm Nghiệp Vụ
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              {AI_FEATURES_DATA.length} Tính Năng Sẵn Sàng
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
              Dual-Origin (JP ⇄ VN)
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-navy-950 tracking-tight">
            Tất Cả Các Điểm Vận Dụng AI Trong ChillBanana
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Hệ thống ứng dụng công nghệ <strong>Google Gemini (Flash-Lite / Flash Vision)</strong> kết hợp <strong>Deterministic Rule-Engine</strong> để giải quyết triệt để 4 rào cản thương mại xuyên biên giới Nhật - Việt.
          </p>

          {/* SEARCH & COPY BAR */}
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/60">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tính năng: MAFF, Vision, giỏ hàng, 100V, Romaji, email, quota..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
              />
            </div>

            <button
              onClick={handleCopySummary}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition-colors"
              title="Sao chép toàn bộ danh sách để đưa vào slide hoặc báo cáo đồ án"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedSummary ? "Đã sao chép vào bộ nhớ tạm!" : "Sao chép tóm tắt cho Slide/Báo cáo"}</span>
            </button>
          </div>
        </div>

        {/* TABS SELECTOR */}
        <div className="bg-slate-50 px-4 sm:px-6 py-2.5 border-b border-slate-200 flex-shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center space-x-1 sm:space-x-2 min-w-max">
            {CATEGORY_TABS.map((tab) => {
              const isActive = selectedCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* FEATURE CARDS LIST (SCROLLABLE BODY) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5 bg-slate-50/50">
          {filteredFeatures.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Không tìm thấy tính năng AI nào khớp với từ khóa &ldquo;{searchTerm}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredFeatures.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    {/* Header badge & title */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-mono font-bold text-[10px] border border-purple-200">
                          {idx + 1}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-navy-950 leading-snug">
                          {item.title}
                        </h4>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{item.status}</span>
                      </span>
                    </div>

                    {/* Model tag */}
                    <div className="flex items-center gap-1.5 text-[11px] text-purple-900 bg-purple-50/80 px-2.5 py-1 rounded-lg border border-purple-100 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                      <span className="line-clamp-1">{item.model}</span>
                    </div>

                    {/* Problem & Solution */}
                    <div className="text-[11px] space-y-1.5 pt-1">
                      <p className="text-slate-500 leading-relaxed">
                        <strong className="text-slate-700">Mục đích:</strong> {item.purpose}
                      </p>
                      <p className="text-slate-800 leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <strong className="text-purple-700">Giải pháp AI:</strong> {item.solution}
                      </p>
                    </div>
                  </div>

                  {/* Footer with code path & action button */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px]">
                    <span className="font-mono text-slate-400 truncate max-w-[220px]" title={item.codePath}>
                      📁 {item.codePath}
                    </span>

                    {item.actionLabel && (
                      <button
                        onClick={() => handleAction(item.actionTarget)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg border border-purple-200 transition-colors flex-shrink-0 shadow-2xs"
                      >
                        <span>{item.actionLabel}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between flex-shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Hệ thống đạt chuẩn an toàn <strong>Human-in-the-Loop</strong> và chống nghẽn Quota.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
