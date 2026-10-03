"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Send, 
  X, 
  Bot, 
  ShieldAlert, 
  RefreshCw,
  ShoppingBag,
  ImagePlus,
  Loader2
} from "lucide-react";
import { AIPersonality } from "@/types";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  isGuardrail?: boolean;
  time: string;
}

// Subcomponent hiển thị ảnh chat thông minh, tự động fallback nếu link ảnh lỗi/chặn
function ChatImage({ url, alt }: { url: string; alt: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200 my-1 max-w-full">
        <span>🖼️</span>
        <span className="italic font-medium truncate">{alt || "Hình ảnh sản phẩm"}</span>
        <span className="text-[10px] text-banana-700 font-semibold shrink-0">(Bấm link sàn Nhật để xem ảnh thật ↗)</span>
      </span>
    );
  }

  return (
    <span className="block my-2.5 p-1.5 bg-slate-100/90 rounded-xl border border-slate-200 max-w-full">
      <img
        src={url}
        alt={alt || "Hình ảnh sản phẩm"}
        className="max-h-52 max-w-full rounded-lg object-contain bg-white mx-auto shadow-sm"
        loading="lazy"
        onError={() => setHasError(true)}
      />
      {alt && <span className="block text-[11px] text-slate-500 text-center mt-1 font-medium italic">{alt}</span>}
    </span>
  );
}

export default function AIChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [personality, setPersonality] = useState<AIPersonality>("omotenashi");
  const [sessionId, setSessionId] = useState<string>("");
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageAnalyzing, setImageAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "bot",
      text: "Kính chào Quý khách! Em là ChillBanana Gemini 2.5 AI Agent 🍌 - Trợ lý thông minh hỗ trợ Quý khách: tìm kiếm sản phẩm nội địa Nhật, tra cứu link & hình ảnh, tư vấn kỹ thuật điện 100V, mẹo săn sale, tính bill cước vận chuyển và giảm 25% cước gộp đơn ạ!\n\n📸 **Mới:** Bạn có thể gửi ảnh sản phẩm để AI nhận diện tên tiếng Nhật và tìm giá!",
      time: "Vừa xong",
    },
  ]);

  useEffect(() => {
    // Khởi tạo hoặc khôi phục sessionId
    let sid = localStorage.getItem("chillbanana_chat_session_id");
    if (!sid) {
      sid = "session-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
      localStorage.setItem("chillbanana_chat_session_id", sid);
    }
    setSessionId(sid);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handlePersonalityChange = (newP: AIPersonality) => {
    setPersonality(newP);
    const welcomeText =
      newP === "omotenashi"
        ? "Dạ thưa Quý khách, em đã chuyển sang phong cách Omotenashi chuẩn mực Nhật Bản 🌸. Kính chúc Quý khách mua sắm thảnh thơi cùng ChillBanana ạ!"
        : "Dạ em đã đổi sang phong cách Chill & Thân Thiện rồi nè! 🎉 Anh/chị cần em mách deal hời hay mẹo săn sale món gì trên Amazon/Mercari cứ nhắn em liền nha!";

    setMessages((prev) => [
      ...prev,
      {
        id: "switch-" + Date.now(),
        sender: "bot",
        text: welcomeText,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage;
    if (!query.trim() || loading) return;

    const userMsg: Message = {
      id: "user-" + Date.now(),
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage("");
    setLoading(true);

    try {
      // Chuẩn bị lịch sử hội thoại ngắn gửi kèm lên Gemini
      const conversationHistory = messages.map((m) => ({
        role: m.sender === "user" ? "user" : "model",
        text: m.text,
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          personality,
          sessionId,
          history: conversationHistory,
        }),
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        const botMsg: Message = {
          id: "bot-" + Date.now(),
          sender: "bot",
          text: data.reply,
          isGuardrail: data.isGuardrailTriggered,
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error(data.error || "Lỗi không xác định");
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          sender: "bot",
          text: "Xin lỗi Quý khách, hệ thống đang bận kết nối máy chủ AI. Quý khách vui lòng thử lại sau giây lát ạ! 🍌",
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handler phân tích ảnh sản phẩm bằng AI Vision
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || imageAnalyzing) return;
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Validate
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File ảnh quá lớn (tối đa 10MB)");
      return;
    }

    setImageAnalyzing(true);

    // Add user message with image indicator
    const userMsg: Message = {
      id: "user-img-" + Date.now(),
      sender: "user",
      text: `📸 Đã gửi ảnh sản phẩm: ${file.name}`,
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // Convert to base64
      const reader = new FileReader();
      const imageData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/ai/image-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, sessionId }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.analysis) {
        const a = data.analysis;
        let replyText = `### 🔍 Kết Quả Phân Tích Ảnh (AI Vision)\n\n`;
        if (a.nameJp) replyText += `**Tên tiếng Nhật:** ${a.nameJp}\n`;
        if (a.nameVi) replyText += `**Tên tiếng Việt:** ${a.nameVi}\n`;
        if (a.estimatedPriceJpy) replyText += `**Giá ước tính:** ~¥${a.estimatedPriceJpy.toLocaleString()}\n`;
        if (a.category) {
          const catName = a.category === "cosmetics" ? "Mỹ phẩm" :
            a.category === "health" ? "Thực phẩm CN" :
            a.category === "gadgets" ? "Gia dụng/Điện tử" :
            a.category === "anime" ? "Anime/Mô hình" : "Khác";
          replyText += `**Danh mục:** ${catName}\n`;
        }
        if (a.voltageWarning) replyText += `\n⚠️ **Cảnh báo điện áp:** Sản phẩm sử dụng nguồn 100V nội địa Nhật — cần mua kèm biến áp 220V→100V!\n`;
        if (a.riskNotes) replyText += `\n🛡️ **Lưu ý:** ${a.riskNotes}\n`;
        if (a.description) replyText += `\n${a.description}\n`;
        if (a.searchKeywords?.length > 0) {
          replyText += `\n**Từ khóa tìm kiếm trên sàn Nhật:**\n`;
          a.searchKeywords.forEach((kw: string) => {
            replyText += `- [Tìm "${kw}" trên Amazon JP](https://www.amazon.co.jp/s?k=${encodeURIComponent(kw)})\n`;
          });
        }
        replyText += `\n💡 *Để đặt hàng, hãy copy link sản phẩm từ kết quả tìm kiếm trên và dán vào ô "Dán Link Tính Giá" ở đầu trang!*`;

        setMessages((prev) => [...prev, {
          id: "bot-img-" + Date.now(),
          sender: "bot",
          text: replyText,
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        }]);
      } else {
        throw new Error(data.error || "Không thể phân tích ảnh");
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: "err-img-" + Date.now(),
        sender: "bot",
        text: "Xin lỗi, em chưa phân tích được ảnh này. Quý khách thử chụp lại ảnh rõ hơn hoặc gửi link sản phẩm trực tiếp ạ! 🍌",
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally {
      setImageAnalyzing(false);
    }
  };
  const parseInlineFormatting = (text: string) => {
    const tokenRegex = /(!\[.*?\]\(https?:\/\/[^\s\)]+\)|\[.*?\]\(https?:\/\/[^\s\)]+\)|\*\*.*?\*\*)/g;
    const parts = text.split(tokenRegex);

    return parts.map((chunk, idx) => {
      if (!chunk) return null;

      // 1. Ảnh Markdown: ![alt](url)
      if (chunk.startsWith("![") && chunk.endsWith(")")) {
        const imgMatch = chunk.match(/!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)/);
        if (imgMatch) {
          const alt = imgMatch[1];
          const url = imgMatch[2];
          return <ChatImage key={idx} url={url} alt={alt} />;
        }
      }

      // 2. Link Markdown: [text](url)
      if (chunk.startsWith("[") && chunk.endsWith(")")) {
        const linkMatch = chunk.match(/\[(.*?)\]\((https?:\/\/[^\s\)]+)\)/);
        if (linkMatch) {
          const linkText = linkMatch[1];
          const linkUrl = linkMatch[2];
          return (
            <a
              key={idx}
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-banana-700 hover:text-banana-800 underline font-semibold mx-1 bg-banana-50 px-1.5 py-0.5 rounded transition-colors"
            >
              <span>{linkText}</span>
              <span className="text-[10px] ml-0.5">↗</span>
            </a>
          );
        }
      }

      // 3. Bold text: **text**
      if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length >= 4) {
        return (
          <strong key={idx} className="font-semibold text-navy-950">
            {chunk.slice(2, -2)}
          </strong>
        );
      }

      // 4. Plain text
      return <span key={idx}>{chunk}</span>;
    });
  };

  // Helper parse markdown ảnh, link, tiêu đề thành giao diện trực quan hoàn chỉnh
  const renderFormattedMessage = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, lIdx) => {
      const trimmed = line.trim();

      // Dải phân cách ---
      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        return <hr key={lIdx} className="my-2.5 border-slate-200" />;
      }

      // Tự động nhận diện dòng chứa link ảnh (dù AI in dạng "* Link ảnh: https://...", "Ảnh: https://...", hoặc "Hình ảnh: https://...")
      const linkImageMatch = trimmed.match(/^(?:\*\s*)?(?:Link\s*ảnh|Ảnh\s*sản\s*phẩm|Ảnh|Hình\s*ảnh):\s*(https?:\/\/[^\s\)]+)/i);
      if (linkImageMatch && linkImageMatch[1]) {
        return <ChatImage key={lIdx} url={linkImageMatch[1].trim()} alt="Hình ảnh sản phẩm" />;
      }

      // Tiêu đề ###
      if (trimmed.startsWith("### ")) {
        return (
          <h4 key={lIdx} className="font-bold text-sm text-navy-950 mt-3 mb-1 border-b border-banana-200 pb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-3.5 bg-banana-500 rounded-full inline-block"></span>
            <span>{parseInlineFormatting(trimmed.substring(4))}</span>
          </h4>
        );
      }

      // Tiêu đề ##
      if (trimmed.startsWith("## ")) {
        return (
          <h3 key={lIdx} className="font-bold text-base text-navy-950 mt-3.5 mb-1.5">
            {parseInlineFormatting(trimmed.substring(3))}
          </h3>
        );
      }

      return (
        <div
          key={lIdx}
          className={`min-h-[1.25rem] leading-relaxed ${
            trimmed.startsWith("- ") || trimmed.startsWith("* ") ? "pl-2" : ""
          }`}
        >
          {parseInlineFormatting(line)}
        </div>
      );
    });
  };

  const quickPrompts = [
    { label: "🎮 Máy chơi game Nhật 3tr", query: "Cho tôi xem link và hình tham khảo các dòng máy chơi game nội địa Nhật trong tầm giá 3 triệu" },
    { label: "👔 Hướng dẫn chọn Size", query: "Tư vấn cách chọn size quần áo Uniqlo và giày dép Nhật Bản" },
    { label: "⚡ Đồ điện 100V dùng sao?", query: "Đồ điện nội địa Nhật 100V dùng ở Việt Nam cần mua biến áp loại nào?" },
    { label: "✈ Tiết kiệm cước Gộp Đơn", query: "Tính năng gộp đơn Group Buy tiết kiệm 25% cước bay thế nào?" },
  ];

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        id="ai-chat-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-br from-banana-400 via-banana-500 to-amber-600 hover:from-banana-500 hover:to-amber-700 text-navy-950 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 flex items-center justify-center group border-2 border-white"
        aria-label="Open ChillBanana AI"
      >
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
        </span>
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <div className="flex items-center space-x-1.5 px-1">
            <span className="text-xl">🍌</span>
            <span className="inline text-xs font-extrabold font-serif pr-1 text-navy-950 tracking-tight">ChillBanana AI</span>
          </div>
        )}
      </button>

      {/* Chat Window Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-2 sm:right-6 z-50 w-[96vw] sm:w-[500px] h-[640px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header */}
          <div className="bg-navy-900 text-white p-4 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-banana-500 flex items-center justify-center text-lg shadow">
                  🍌
                </div>
                <div>
                  <h3 className="text-sm font-bold font-serif flex items-center">
                    ChillBanana AI
                    <span className="ml-1.5 w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  </h3>
                  <p className="text-[10px] text-banana-300">Trợ lý mua sắm Nhật Bản 24/7 (AI Agent 2.5)</p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Personality Selector Toggle */}
            <div className="bg-black/30 p-1 rounded-xl flex items-center text-xs">
              <button
                onClick={() => handlePersonalityChange("omotenashi")}
                className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all flex items-center justify-center space-x-1 ${
                  personality === "omotenashi"
                    ? "bg-banana-500 text-navy-950 shadow-sm"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span>🇯🇵 Omotenashi (Lịch sự)</span>
              </button>
              <button
                onClick={() => handlePersonalityChange("vietnamese")}
                className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all flex items-center justify-center space-x-1 ${
                  personality === "vietnamese"
                    ? "bg-banana-500 text-navy-950 shadow-sm"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span>🇻🇳 Thân Thiện (Chill)</span>
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-2 ${
                  msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                    msg.sender === "user"
                      ? "bg-navy-900 text-white"
                      : "bg-banana-500 text-navy-950 font-extrabold"
                  }`}
                >
                  {msg.sender === "user" ? "Bạn" : "🍌"}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[88%] p-3.5 rounded-2xl shadow-sm text-xs leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-navy-900 text-white rounded-tr-none"
                      : msg.isGuardrail
                      ? "bg-amber-50 border border-amber-300 text-amber-950 rounded-tl-none"
                      : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                  }`}
                >
                  {msg.isGuardrail && (
                    <div className="flex items-center space-x-1 text-[10px] font-bold text-amber-800 mb-1">
                      <ShieldAlert className="w-3 h-3 text-amber-600" />
                      <span>Thông Báo Phạm Vi Tư Vấn</span>
                    </div>
                  )}
                  <div className="whitespace-pre-line space-y-2 leading-relaxed">
                    {renderFormattedMessage(msg.text)}
                  </div>
                  <span
                    className={`block text-[9px] mt-1 text-right ${
                      msg.sender === "user" ? "text-slate-400" : "text-slate-400"
                    }`}
                  >
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-slate-400 text-xs py-1 pl-8">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-banana-600" />
                <span>ChillBanana Gemini AI đang phản hồi...</span>
              </div>
            )}
            {imageAnalyzing && (
              <div className="flex items-center space-x-2 text-xs py-1 pl-8">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-banana-600" />
                <span className="text-banana-700 font-semibold">AI Vision đang phân tích ảnh sản phẩm...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p.query)}
                className="whitespace-nowrap px-2.5 py-1 bg-slate-100 hover:bg-banana-50 hover:text-banana-800 text-slate-700 text-[11px] font-semibold rounded-xl border border-slate-200 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-slate-200">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageAnalyzing || loading}
                className="p-2.5 bg-slate-100 hover:bg-banana-100 disabled:opacity-40 text-slate-600 hover:text-banana-700 rounded-2xl transition-all shrink-0"
                title="Gửi ảnh sản phẩm để AI nhận diện"
              >
                {imageAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4" />
                )}
              </button>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  personality === "omotenashi"
                    ? "Kính mời Quý khách nhập câu hỏi tư vấn..."
                    : "Hỏi em về size đồ, điện 100V, cước gộp nha..."
                }
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white transition-all"
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="p-2.5 bg-banana-500 hover:bg-banana-600 disabled:opacity-40 text-navy-950 rounded-2xl shadow transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
