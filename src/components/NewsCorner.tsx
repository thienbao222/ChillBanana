"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Newspaper,
  Clock,
  ArrowRight,
  X,
  Sparkles,
  Zap,
  Scale,
  Layers,
  Bot,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Filter,
} from "lucide-react";
import { KIZUNA_NEWS } from "@/lib/data";
import { NewsItem } from "@/types";
import { useCart } from "@/context/CartContext";
import { DEFAULT_PRICING_CONFIG, DEFAULT_EXCHANGE_RATE } from "@/features/pricing/calculator";

export default function NewsCorner() {
  const [newsList, setNewsList] = useState<NewsItem[]>(KIZUNA_NEWS);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Lấy tỷ giá và bảng giá động từ Giỏ hàng / Hệ thống
  let cartData: { exchangeRate: number; pricingConfig: typeof DEFAULT_PRICING_CONFIG } = {
    exchangeRate: DEFAULT_EXCHANGE_RATE,
    pricingConfig: DEFAULT_PRICING_CONFIG,
  };
  try {
    const cart = useCart();
    if (cart) {
      cartData = {
        exchangeRate: cart.exchangeRate || DEFAULT_EXCHANGE_RATE,
        pricingConfig: cart.pricingConfig || DEFAULT_PRICING_CONFIG,
      };
    }
  } catch {
    // Trường hợp hiển thị ngoài CartProvider
  }

  const { exchangeRate, pricingConfig } = cartData;

  // Tải danh sách bài viết mới nhất từ API backend
  useEffect(() => {
    let isMounted = true;
    async function loadNews() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/news");
        if (res.ok) {
          const json = await res.json();
          if (isMounted && Array.isArray(json?.news) && json.news.length > 0) {
            setNewsList(json.news);
          }
        }
      } catch (err) {
        console.warn("[NewsCorner] Không thể tải tin tức từ API, sử dụng dữ liệu tĩnh dự phòng:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadNews();
    return () => {
      isMounted = false;
    };
  }, []);

  // Lọc theo danh mục
  const filteredNews = useMemo(() => {
    if (activeCategory === "all") return newsList;
    return newsList.filter((item) => item.category === activeCategory);
  }, [newsList, activeCategory]);

  const categories = [
    { id: "all", label: "Tất Cả Cẩm Nang" },
    { id: "MeoSangSale", label: "Mẹo Săn Deal" },
    { id: "KienThucNhat", label: "Cẩm Nang Order" },
    { id: "Review", label: "Kinh Nghiệm Đồ Nhật" },
  ];

  // Helper điều hướng
  const scrollToQuote = () => {
    setSelectedNews(null);
    const quoteEl = document.getElementById("quote") || document.querySelector("[name='quoteUrl']");
    if (quoteEl) {
      quoteEl.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.hash = "quote";
    }
  };

  const scrollToProducts = () => {
    setSelectedNews(null);
    const prodEl = document.getElementById("products") || document.getElementById("catalog");
    if (prodEl) {
      prodEl.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.hash = "products";
    }
  };

  const askNeoAI = (promptText: string) => {
    setSelectedNews(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("open-ai-chat", {
          detail: { initialPrompt: promptText },
        })
      );
    }
  };

  // State tương tác cho từng Widget trong Modal
  // Widget 1: Deal Hunting Demo
  const [dealJpy, setDealJpy] = useState<number>(3500);

  // Widget 2: Size Converter
  const [sizeMode, setSizeMode] = useState<"clothes" | "shoes">("clothes");
  const [userWeightKg, setUserWeightKg] = useState<number>(62);
  const [userFootCm, setUserFootCm] = useState<number>(26.0);

  // Widget 3: 100V Voltage Checker
  const [selectedDevice, setSelectedDevice] = useState<string>("cooker");

  // Widget 4: Group Buy Savings
  const [groupBuyWeightKg, setGroupBuyWeightKg] = useState<number>(0.3);

  return (
    <section id="news" className="py-12 max-w-[1600px] w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-banana-800 bg-banana-100 px-3 py-1 rounded-full uppercase tracking-wider mb-2 border border-banana-200">
            <Newspaper className="w-3.5 h-3.5 text-banana-600" />
            <span>ChillBanana Cẩm Nang Hàng Nhật</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-navy-900">
            Kinh Nghiệm Săn Deal &amp; Cẩm Nang Mua Sắm Nội Địa Nhật
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Tổng hợp kinh nghiệm săn sale Amazon JP, chọn size đồ Uniqlo, cảnh báo điện áp 100V và tối ưu cước gộp đơn.
            Tất cả thông tin được cập nhật theo tỷ giá thực tế{" "}
            <span className="font-semibold text-navy-900">1 JPY = {exchangeRate.toLocaleString("vi-VN")} đ</span>.
          </p>
        </div>

        {/* Bộ lọc Tabs Danh Mục */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeCategory === cat.id
                  ? "bg-navy-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid danh sách bài viết */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredNews.map((item) => (
          <article
            key={item.id}
            onClick={() => setSelectedNews(item)}
            className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="relative h-44 overflow-hidden bg-slate-100">
                <img
                  src={item.coverImage}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2.5 left-2.5 bg-navy-900/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">
                  {item.categoryName}
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center space-x-2 text-[11px] text-slate-400 mb-2">
                  <Clock className="w-3 h-3" />
                  <span>{item.readTime}</span>
                  <span>•</span>
                  <span>{item.publishedAt}</span>
                </div>

                <h3 className="text-sm font-bold text-navy-900 line-clamp-2 group-hover:text-banana-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-3 mt-2">
                  {item.excerpt}
                </p>
              </div>
            </div>

            <div className="p-4 pt-0">
              <span className="inline-flex items-center text-xs font-bold text-banana-700 group-hover:underline">
                Khám phá &amp; Trải nghiệm công cụ <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </span>
            </div>
          </article>
        ))}
      </div>

      {/* Modal Đọc Chi Tiết & Tương Tác Công Cụ Thực Tế */}
      {selectedNews && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border relative my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedNews(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 z-10"
              aria-label="Đóng"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="space-y-5">
              <div>
                <span className="text-xs font-bold text-banana-900 uppercase tracking-wider bg-banana-100 px-3 py-1 rounded-full border border-banana-200">
                  {selectedNews.categoryName}
                </span>
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-navy-900 mt-2">
                  {selectedNews.title}
                </h3>
                <div className="flex items-center text-xs text-slate-400 space-x-3 mt-1 pb-3 border-b">
                  <span>Thời lượng: {selectedNews.readTime}</span>
                  <span>•</span>
                  <span>Ngày đăng: {selectedNews.publishedAt}</span>
                  <span>•</span>
                  <span className="text-emerald-600 font-semibold">Tỷ giá: 1 JPY = {exchangeRate} đ</span>
                </div>
              </div>

              <div className="h-52 rounded-2xl overflow-hidden bg-slate-100">
                <img
                  src={selectedNews.coverImage}
                  alt={selectedNews.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Nội dung bài viết */}
              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {selectedNews.content}
              </div>

              {/* KHU VỰC CÔNG CỤ TƯƠNG TÁC THỰC TẾ (INTERACTIVE WIDGET) */}
              {/* Widget 1: Săn Deal & Báo Giá Thực Tế (news-01 hoặc slug chứa deal) */}
              {(selectedNews.id === "news-01" || selectedNews.slug.includes("deal")) && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 space-y-3">
                  <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Công Cụ Thử Nghiệm Báo Giá Săn Deal Nhật</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    Nhập giá Yên (JPY) món hàng săn được trên Amazon JP / Mercari để xem nhanh chi phí về tay theo tỷ giá thực tế:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Giá săn sale (JPY ¥):</label>
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={dealJpy}
                        onChange={(e) => setDealJpy(Math.max(100, Number(e.target.value) || 100))}
                        className="w-full px-3 py-2 text-sm border rounded-xl bg-white font-bold text-navy-950 focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-amber-200 flex flex-col justify-center">
                      <span className="text-[10px] text-slate-500 font-semibold">Ước tính tiền hàng + công mua:</span>
                      <span className="text-base font-extrabold text-navy-950">
                        {Math.round(
                          dealJpy * exchangeRate +
                            Math.max(
                              pricingConfig.serviceFeeMinimumVnd,
                              Math.round(dealJpy * exchangeRate * (pricingConfig.serviceFeePercent / 100))
                            )
                        ).toLocaleString("vi-VN")}{" "}
                        đ
                      </span>
                      <span className="text-[10px] text-emerald-700">
                        (Phí mua hộ {pricingConfig.serviceFeePercent}% · Tối thiểu {pricingConfig.serviceFeeMinimumVnd.toLocaleString("vi-VN")} đ)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200/60">
                    <button
                      onClick={scrollToQuote}
                      className="px-4 py-2 bg-navy-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1"
                    >
                      <span>Mở Form Tính Giá Chi Tiết</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        askNeoAI(
                          `Neo ơi, tôi đang săn món hàng có giá ${dealJpy.toLocaleString("vi-VN")} JPY trên sàn Nhật. Hãy hướng dẫn tôi cách kiểm tra uy tín người bán và tính trọn gói phí ship về tay nhé!`
                        )
                      }
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-navy-950 text-xs font-extrabold rounded-xl transition-all flex items-center space-x-1"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Hỏi Trợ Lý Neo AI Về Deal Này</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Widget 2: Bảng Quy Đổi Size Quần Áo & Giày Dép (news-02 hoặc slug chứa size) */}
              {(selectedNews.id === "news-02" || selectedNews.slug.includes("size")) && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-blue-900 font-bold text-sm">
                      <Scale className="w-4 h-4 text-blue-600" />
                      <span>Thước Đo Quy Đổi Size Chuẩn Nhật - Việt</span>
                    </div>
                    <div className="flex space-x-1 bg-white p-0.5 rounded-lg border border-blue-200 text-[11px]">
                      <button
                        onClick={() => setSizeMode("clothes")}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                          sizeMode === "clothes" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        👕 Quần Áo
                      </button>
                      <button
                        onClick={() => setSizeMode("shoes")}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                          sizeMode === "shoes" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        👟 Giày Dép
                      </button>
                    </div>
                  </div>

                  {sizeMode === "clothes" ? (
                    <div className="space-y-3 pt-1">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                        <span>Cân nặng của bạn:</span>
                        <span className="text-blue-700 font-mono text-sm">{userWeightKg} kg</span>
                      </div>
                      <input
                        type="range"
                        min={45}
                        max={90}
                        step={1}
                        value={userWeightKg}
                        onChange={(e) => setUserWeightKg(Number(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer"
                      />

                      <div className="p-3 bg-white rounded-xl border border-blue-200 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Gợi ý Size Uniqlo / GU Nhật:</span>
                          <span className="text-base font-extrabold text-blue-900">
                            {userWeightKg < 52
                              ? "Size S (Form ôm nhẹ)"
                              : userWeightKg <= 63
                              ? "Size M (Vừa vặn chuẩn người Việt)"
                              : userWeightKg <= 74
                              ? "Size L (Thoải mái)"
                              : userWeightKg <= 83
                              ? "Size XL (Form rộng)"
                              : "Size XXL / 3XL"}
                          </span>
                        </div>
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded-lg">
                          Chuẩn Phom Châu Á
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 italic">
                        💡 Lưu ý: Vai áo Uniqlo Nhật may ôm hơn 1-2cm so với chuẩn Âu-Mỹ. Nếu thích mặc rộng hoặc có vai dày, bạn nên tăng 1 size.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                        <span>Chiều dài bàn chân:</span>
                        <span className="text-blue-700 font-mono text-sm">{userFootCm.toFixed(1)} cm</span>
                      </div>
                      <input
                        type="range"
                        min={22.5}
                        max={28.5}
                        step={0.5}
                        value={userFootCm}
                        onChange={(e) => setUserFootCm(Number(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer"
                      />

                      <div className="p-3 bg-white rounded-xl border border-blue-200 grid grid-cols-2 gap-2 text-center">
                        <div className="border-r border-slate-100 pr-2">
                          <span className="text-[10px] text-slate-500 block">Size Giày Nhật (JP):</span>
                          <span className="text-base font-extrabold text-blue-900">{userFootCm.toFixed(1)} cm</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Size Giày VN / EU tương đương:</span>
                          <span className="text-base font-extrabold text-indigo-900">
                            {userFootCm <= 23.0
                              ? "Size 36 - 37"
                              : userFootCm <= 24.0
                              ? "Size 38"
                              : userFootCm <= 25.0
                              ? "Size 39 - 40"
                              : userFootCm <= 26.0
                              ? "Size 41"
                              : userFootCm <= 27.0
                              ? "Size 42 - 43"
                              : "Size 44 - 45"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-blue-200/60 flex justify-end">
                    <button
                      onClick={() =>
                        askNeoAI(
                          `Neo tư vấn giúp tôi chọn size ${
                            sizeMode === "clothes" ? `áo Uniqlo cho người ${userWeightKg}kg` : `giày Nhật cho bàn chân dài ${userFootCm}cm`
                          } nhé!`
                        )
                      }
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Hỏi Neo Tư Vấn Size Chi Tiết</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Widget 3: Cảnh Báo Điện Áp 100V & Chọn Biến Áp (news-03 hoặc slug chứa dien-ap) */}
              {(selectedNews.id === "news-03" || selectedNews.slug.includes("dien-ap")) && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 space-y-3">
                  <div className="flex items-center space-x-2 text-rose-900 font-bold text-sm">
                    <Zap className="w-4 h-4 text-rose-600" />
                    <span>Bảng Tra Cứu Biến Áp Cho Thiết Bị Điện Nội Địa Nhật (100V)</span>
                  </div>
                  <p className="text-xs text-rose-800">
                    Chọn loại thiết bị bạn định mua để xem khuyến nghị đổi nguồn an toàn, tránh chập cháy bo mạch:
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Loại thiết bị điện tử:</label>
                    <select
                      value={selectedDevice}
                      onChange={(e) => setSelectedDevice(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold border rounded-xl bg-white text-navy-950 focus:ring-2 focus:ring-rose-400"
                    >
                      <option value="cooker">Nồi cơm điện cao tần IH / Bếp từ đơn (1200W - 1400W)</option>
                      <option value="dryer">Máy sấy tóc Panasonic Nanoe / Máy ép tạo kiểu (1000W - 1200W)</option>
                      <option value="purifier">Máy lọc không khí / Máy hút ẩm Sharp, Daikin (40W - 90W)</option>
                      <option value="shaver">Máy cạo râu Braun / Bàn chải điện (5W - 20W)</option>
                      <option value="audio">Tai nghe / Loa Bluetooth mini (Sạc 5V USB)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-rose-200 space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-900">
                      {selectedDevice === "shaver" || selectedDevice === "audio" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>
                        {selectedDevice === "cooker"
                          ? "Cần Biến Áp Lioa / Standa 1500VA - 2000VA (2KVA)"
                          : selectedDevice === "dryer"
                          ? "Cần Biến Áp Đổi Nguồn 1500VA"
                          : selectedDevice === "purifier"
                          ? "Cần Biến Áp Mini 150VA - 200VA (Chạy êm 24/7)"
                          : selectedDevice === "shaver"
                          ? "Đa số củ sạc hỗ trợ Auto-volt (100V - 240V)"
                          : "An Toàn Tuyệt Đối: Dùng Cổng USB / Củ Sạc 5V Việt Nam"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {selectedDevice === "cooker" || selectedDevice === "dryer"
                        ? "⚠️ Tuyệt đối KHÔNG cắm trực tiếp vào ổ điện 220V Việt Nam! Điện áp cao gấp đôi sẽ làm nổ tụ bảo vệ và cháy mâm từ."
                        : selectedDevice === "purifier"
                        ? "Nên chọn cục biến áp đồng nguyên chất để máy lọc không khí vận hành êm ái trong phòng ngủ không phát tiếng vo ve."
                        : "Kiểm tra tem thông số trên củ sạc: nếu ghi INPUT: 100-240V~ 50/60Hz thì bạn có thể cắm trực tiếp vào điện Việt Nam an toàn."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200/60">
                    <button
                      onClick={scrollToProducts}
                      className="px-4 py-2 bg-navy-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
                    >
                      Xem Các Món Gia Dụng &amp; Điện Tử Mini Sẵn Có
                    </button>
                    <button
                      onClick={() =>
                        askNeoAI(
                          `Neo giải thích thêm giúp tôi về cách chọn biến áp cho đồ điện Nhật 100V nhé!`
                        )
                      }
                      className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Hỏi Neo Về Điện Áp 100V</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Widget 4: Mô Phỏng Tiết Kiệm Gộp Đơn (news-04 hoặc slug chứa gop-don) */}
              {(selectedNews.id === "news-04" || selectedNews.slug.includes("gop-don")) && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>Mô Phỏng Tiết Kiệm Cước Vận Chuyển Với Gộp Đơn (Group Buy)</span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    Tính năng Gộp Đơn giúp giảm ngay{" "}
                    <span className="font-extrabold">{pricingConfig.groupBuyShippingDiscountPercent}%</span> cước bay cho
                    các kiện hàng nhẹ ≤ {pricingConfig.groupBuyMaxWeightKg}kg:
                  </p>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                      <span>Trọng lượng kiện hàng của bạn:</span>
                      <span className="text-emerald-700 font-mono text-sm">{groupBuyWeightKg.toFixed(2)} kg</span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={pricingConfig.groupBuyMaxWeightKg}
                      step={0.05}
                      value={groupBuyWeightKg}
                      onChange={(e) => setGroupBuyWeightKg(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {(() => {
                    const standardShip = Math.round(groupBuyWeightKg * pricingConfig.airShippingPerKgVnd);
                    const groupBuyShip = Math.round(
                      groupBuyWeightKg *
                        pricingConfig.airShippingPerKgVnd *
                        (1 - pricingConfig.groupBuyShippingDiscountPercent / 100)
                    );
                    const savings = standardShip - groupBuyShip;

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center pt-1">
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Cước bay lẻ thông thường:</span>
                          <span className="text-xs font-bold text-slate-600 line-through">
                            {standardShip.toLocaleString("vi-VN")} đ
                          </span>
                        </div>
                        <div className="p-2.5 bg-emerald-100/60 rounded-xl border border-emerald-300">
                          <span className="text-[10px] text-emerald-800 font-bold block">Cước khi Gộp Đơn:</span>
                          <span className="text-sm font-extrabold text-emerald-900">
                            {groupBuyShip.toLocaleString("vi-VN")} đ
                          </span>
                        </div>
                        <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
                          <span className="text-[10px] text-emerald-100 font-semibold block">Bạn tiết kiệm:</span>
                          <span className="text-sm font-extrabold">
                            +{savings.toLocaleString("vi-VN")} đ
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-emerald-800 font-medium">
                      📦 Bay định kỳ thứ 3 &amp; thứ 6 hàng tuần từ Narita về Nội Bài / Tân Sơn Nhất.
                    </span>
                    <button
                      onClick={scrollToQuote}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1"
                    >
                      <span>Trải Nghiệm Đặt Gộp Đơn Ngay</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Nút Đóng Modal */}
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setSelectedNews(null)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
