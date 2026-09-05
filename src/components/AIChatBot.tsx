"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Send, 
  X, 
  Bot, 
  ShieldAlert, 
  RefreshCw,
  ShoppingBag
} from "lucide-react";
import { AIPersonality } from "@/types";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  isGuardrail?: boolean;
  time: string;
}

export default function AIChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [personality, setPersonality] = useState<AIPersonality>("omotenashi");
  const [sessionId, setSessionId] = useState<string>("");
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "bot",
      text: "Kính chào Quý khách! Em là ChillBanana Gemini 2.5 AI Agent 🍌 - Trợ lý thông minh hỗ trợ Quý khách: tìm kiếm sản phẩm nội địa Nhật, tra cứu link & hình ảnh, tư vấn kỹ thuật điện 100V, mẹo săn sale, tính bill cước vận chuyển và giảm 25% cước gộp đơn ạ!",
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

  // Helper parse markdown ảnh và link thành giao diện trực quan
  const renderFormattedMessage = (content: string) => {
    // Tách dòng
    const lines = content.split("\n");
    return lines.map((line, lIdx) => {
      // 1. Kiểm tra ảnh markdown ![alt](url)
      const imgMatch = line.match(/!\[(.*?)\]\((https?:\/\/.*?)\)/);
      if (imgMatch) {
        return (
          <div key={lIdx} className="my-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200 inline-block max-w-full">
            <img
              src={imgMatch[2]}
              alt={imgMatch[1] || "Hình ảnh sản phẩm"}
              className="max-h-48 max-w-full rounded-lg object-contain bg-white mx-auto shadow-sm"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            {imgMatch[1] && <p className="text-[10px] text-slate-500 text-center mt-1 font-semibold">{imgMatch[1]}</p>}
          </div>
        );
      }

      // 2. Kiểm tra link markdown [text](url)
      const parts = [];
      let lastIdx = 0;
      const linkRegex = /\[(.*?)\]\((https?:\/\/.*?)\)/g;
      let match;

      while ((match = linkRegex.exec(line)) !== null) {
        if (match.index > lastIdx) {
          parts.push(line.substring(lastIdx, match.index));
        }
        const linkText = match[1];
        const linkUrl = match[2];
        parts.push(
          <a
            key={match.index}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-banana-700 hover:text-banana-800 underline font-bold mx-0.5"
          >
            <span>{linkText}</span>
            <span className="text-[10px] ml-0.5">↗</span>
          </a>
        );
        lastIdx = match.index + match[0].length;
      }

      if (lastIdx < line.length) {
        parts.push(line.substring(lastIdx));
      }

      return (
        <span key={lIdx} className="block">
          {parts.length > 0 ? parts : line}
        </span>
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
          <div className="flex items-center space-x-2 px-1">
            <span className="text-xl">🍌</span>
            <span className="hidden sm:inline text-xs font-extrabold font-serif pr-1 text-navy-950">Gemini AI</span>
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
                    ChillBanana Gemini AI
                    <span className="ml-1.5 w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  </h3>
                  <p className="text-[10px] text-banana-300">Trợ lý mua sắm Nhật Bản 24/7 (Gemini 2.5 Flash)</p>
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
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
