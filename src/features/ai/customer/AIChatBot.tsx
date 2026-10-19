"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  X,
  ShieldAlert,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { AIPersonality } from "@/types";
import NeoUniverseSprite, { NeoUniverseAnimation } from "@/components/NeoUniverseSprite";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  isGuardrail?: boolean;
  imagePreviewUrl?: string;
  sources?: MessageSource[];
  time: string;
}

interface MessageSource {
  label: string;
  href: string;
  checkedAt: string;
}

function formatSourceTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "vừa kiểm tra"
    : date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

type PendingImage = { file: File; previewUrl: string };

const COSMIC_HOVER_HINTS = [
  "Tọa độ của tôi đang bị chạm vào... Kéo để đổi quỹ đạo, chạm để mở kênh tư vấn.",
  "Tín hiệu tiếp xúc đã nhận diện. Cần Neo quét dữ liệu hàng Nhật từ vũ trụ không?",
  "Trọng lực ổn định. Nhấp vào Neo để kích hoạt kênh liên lạc xuyên ngân hà nhé.",
  "Đừng chọc tôi mãi thế chứ... Cần tìm món gì ở Nhật thì cứ chạm vào tôi.",
  "Kênh truyền tin vũ trụ đang mở. Chạm để trao đổi dữ liệu cùng Neo.",
];

const COSMIC_AMBIENT_HINTS = [
  "Đang thu nhận sóng vô tuyến từ các sàn Tokyo... Cần Neo hỗ trợ không?",
  "Tôi không tò mò đâu... nhưng bạn đang tìm figure anime hay đồ công nghệ vậy?",
  "Quỹ đạo Narita ➔ Tân Sơn Nhất ổn định. Kiện hàng của bạn sẽ hạ cánh an toàn.",
  "Tỷ giá JPY/VND vừa đồng bộ vào bộ vi xử lý của Neo. Cần tính giá món nào không?",
  "Trọng lực website này rất êm... Neo đang chờ chỉ lệnh tiếp theo từ bạn.",
  "Khoảng cách giữa Trái Đất và Nhật Bản chỉ là vài mili-giây với dữ liệu của tôi.",
  "Nếu phân vân điện áp 100V, nhớ hỏi tôi... Tôi ghét nhìn thấy thiết bị bị chập điện.",
  "Đang tuần tra quanh quỹ đạo website ChillBanana... Mọi chỉ số đều bình thường.",
];

const COSMIC_DRAG_HINTS = [
  "Thiết lập quỹ đạo mới thành công. Trọng lực tại đây khá ổn.",
  "Tọa độ mới đã khóa. Neo tiếp tục quan sát cùng bạn.",
  "Hạ cánh tại vị trí mới an toàn. Tín hiệu vẫn 100%.",
];

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
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageAnalyzing, setImageAnalyzing] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [imageInputError, setImageInputError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImageRef = useRef<PendingImage | null>(null);
  const imagePreviewUrlsRef = useRef(new Set<string>());
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "bot",
      text: "Kết nối thành công... Tôi là Neo Universe, quan sát viên và trợ lý mua sắm của ChillBanana. Không gian sàn Nhật khá rộng lớn, nhưng mọi tọa độ từ Mercari, Rakuten đến Amazon JP đều nằm trong tầm quét của tôi. Bạn cần tính toán chi phí, lùng món hiếm, kiểm tra điện áp 100V hay phân tích ảnh sản phẩm? Cứ truyền tín hiệu cho tôi nhé.",
      time: "Vừa xong",
    },
  ]);
  const [showGreetingAnimation, setShowGreetingAnimation] = useState(false);
  const [petVisible, setPetVisible] = useState(true);
  const [petConversationOpen, setPetConversationOpen] = useState(false);
  const [showPetGreeting, setShowPetGreeting] = useState(false);
  const [petConversationPosition, setPetConversationPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [ambientAnimation, setAmbientAnimation] = useState<NeoUniverseAnimation>("idle");
  const [ambientHint, setAmbientHint] = useState("");
  const [typedHint, setTypedHint] = useState("");
  const [typedReply, setTypedReply] = useState<{ id: string; text: string } | null>(null);
  const [petPosition, setPetPosition] = useState<{ left: number; top: number } | null>(null);
  const [wanderingEnabled] = useState(false);
  const [isPetHovered, setIsPetHovered] = useState(false);
  const [isPetDragging, setIsPetDragging] = useState(false);
  const [isPageScrolling, setIsPageScrolling] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const petRef = useRef<HTMLDivElement>(null);
  const petDialogueRef = useRef<HTMLDivElement>(null);
  const petPositionRef = useRef(petPosition);
  const scrollTimerRef = useRef<number | null>(null);
  const pageScrollActiveRef = useRef(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null);
  const draggedRef = useRef(false);
  petPositionRef.current = petPosition;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    imagePreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    imagePreviewUrlsRef.current.clear();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setShowGreetingAnimation(false);
      return;
    }
    setShowGreetingAnimation(true);
    const timer = window.setTimeout(() => setShowGreetingAnimation(false), 2200);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!petConversationOpen) {
      setShowPetGreeting(false);
      return;
    }
    setShowPetGreeting(true);
    const timer = window.setTimeout(() => setShowPetGreeting(false), 1500);
    return () => window.clearTimeout(timer);
  }, [petConversationOpen]);

  useEffect(() => {
    const handleOpen = () => {
      setPetVisible(true);
      setPetConversationOpen(false);
      setAmbientHint("");
      setIsOpen(true);
    };
    window.addEventListener("open-ai-chat", handleOpen);
    return () => window.removeEventListener("open-ai-chat", handleOpen);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("neo-universe-pet-position");
      if (saved) {
        const position = JSON.parse(saved) as { left?: number; top?: number };
        if (typeof position.left === "number" && typeof position.top === "number") {
          const width = petRef.current?.offsetWidth ?? 120;
          const height = petRef.current?.offsetHeight ?? 170;
          setPetPosition({
            left: Math.max(8, Math.min(window.innerWidth - width - 8, position.left)),
            top: Math.max(8, Math.min(window.innerHeight - height - 8, position.top)),
          });
        }
      } else if (petRef.current) {
        const rect = petRef.current.getBoundingClientRect();
        setPetPosition({ left: rect.left, top: rect.top });
      }
    } catch { /* Storage is optional. */ }
  }, []);

  // Neo strolls to new places in the viewport, pauses on hover or while dragged,
  // and honors the browser's reduced-motion preference.
  useEffect(() => {
    if (isOpen || petConversationOpen || !petVisible || !wanderingEnabled || isPetHovered || isPetDragging || isPageScrolling || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const hints = COSMIC_AMBIENT_HINTS;
    let actionTimer: number;
    let settleTimer: number;
    let hintTimer: number;
    let stopped = false;

    const scheduleStroll = (delay: number) => {
      actionTimer = window.setTimeout(() => {
        if (stopped || !petRef.current) return;
        const rect = petRef.current.getBoundingClientRect();
        const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
        const maxTop = Math.max(80, window.innerHeight - rect.height - 12);
        const current = petPositionRef.current ?? { left: rect.left, top: rect.top };
        let nextLeft = 8 + Math.random() * maxLeft;
        let nextTop = 80 + Math.random() * Math.max(0, maxTop - 80);
        if (Math.abs(nextLeft - current.left) < 100 && Math.abs(nextTop - current.top) < 80) {
          nextLeft = (nextLeft + maxLeft / 2) % maxLeft;
          nextTop = nextTop < window.innerHeight / 2 ? maxTop : 80;
        }
        setFacingLeft(nextLeft < current.left);
        setPetPosition({ left: Math.min(maxLeft, nextLeft), top: Math.min(maxTop, nextTop) });
        setAmbientAnimation("walk");

        if (Math.random() > 0.65) {
          setAmbientHint(hints[Math.floor(Math.random() * hints.length)]);
          hintTimer = window.setTimeout(() => setAmbientHint(""), 4200);
        }

        settleTimer = window.setTimeout(() => {
          setAmbientAnimation("idle");
          scheduleStroll(11000 + Math.random() * 14000);
        }, 2100);
      }, delay);
    };

    scheduleStroll(10000 + Math.random() * 8000);
    return () => {
      stopped = true;
      window.clearTimeout(actionTimer);
      window.clearTimeout(settleTimer);
      window.clearTimeout(hintTimer);
    };
  }, [isOpen, petConversationOpen, petVisible, wanderingEnabled, isPetHovered, isPetDragging, isPageScrolling]);

  const clampPetPosition = (left: number, top: number) => {
    const width = petRef.current?.offsetWidth ?? 120;
    const height = petRef.current?.offsetHeight ?? 170;
    return {
      left: Math.max(8, Math.min(window.innerWidth - width - 8, left)),
      top: Math.max(8, Math.min(window.innerHeight - height - 8, top)),
    };
  };

  useEffect(() => {
    const keepPetInViewport = () => {
      const position = petPositionRef.current;
      if (position) setPetPosition(clampPetPosition(position.left, position.top));
    };
    window.addEventListener("resize", keepPetInViewport);
    return () => window.removeEventListener("resize", keepPetInViewport);
  }, []);

  useEffect(() => {
    const onPageScroll = () => {
      if (!petVisible || isOpen || petConversationOpen || isPetDragging) return;
      setIsPageScrolling(true);
      setAmbientHint("Điều chỉnh quỹ đạo bám sát tọa độ bạn đang xem...");
      if (wanderingEnabled && !pageScrollActiveRef.current && petRef.current) {
        const rect = petRef.current.getBoundingClientRect();
        const current = petPositionRef.current ?? { left: rect.left, top: rect.top };
        const target = clampPetPosition(current.left + (current.left > window.innerWidth / 2 ? -52 : 52), current.top - 18);
        setFacingLeft(target.left < current.left);
        setPetPosition(target);
        setAmbientAnimation("walk");
      }
      pageScrollActiveRef.current = true;
      if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(() => {
        pageScrollActiveRef.current = false;
        setIsPageScrolling(false);
        setAmbientAnimation("idle");
        setAmbientHint("");
        scrollTimerRef.current = null;
      }, 1500);
    };
    window.addEventListener("scroll", onPageScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onPageScroll);
      if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
      pageScrollActiveRef.current = false;
      setIsPageScrolling(false);
    };
  }, [isOpen, petConversationOpen, petVisible, isPetDragging, wanderingEnabled]);

  useEffect(() => {
    if (!ambientHint) {
      setTypedHint("");
      return;
    }
    let cursor = 0;
    setTypedHint("");
    const timer = window.setInterval(() => {
      cursor = Math.min(ambientHint.length, cursor + 2);
      setTypedHint(ambientHint.slice(0, cursor));
      if (cursor >= ambientHint.length) window.clearInterval(timer);
    }, 28);
    return () => window.clearInterval(timer);
  }, [ambientHint]);

  useEffect(() => {
    if (!petConversationOpen) {
      setPetConversationPosition(null);
      return;
    }
    const positionPanel = () => {
      const rect = petRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(360, window.innerWidth - 24);
      const height = Math.min(360, window.innerHeight - 24);
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
      const above = rect.top - height - 12;
      const top = above >= 12 ? above : Math.max(12, Math.min(window.innerHeight - height - 12, rect.bottom + 12));
      setPetConversationPosition({ left, top, width });
    };
    positionPanel();
    window.addEventListener("resize", positionPanel);
    return () => window.removeEventListener("resize", positionPanel);
  }, [petConversationOpen, petPosition]);

  useEffect(() => {
    if (petConversationOpen && petDialogueRef.current) {
      petDialogueRef.current.scrollTop = petDialogueRef.current.scrollHeight;
    }
  }, [petConversationOpen, messages.length, loading]);

  const handlePetPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !petRef.current) return;
    const rect = petRef.current.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePetPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 7) return;
    drag.moved = true;
    draggedRef.current = true;
    setIsPetDragging(true);
    setAmbientAnimation("walk");
    if (deltaX !== 0) setFacingLeft(deltaX < 0);
    setAmbientHint("Đang dịch chuyển tọa độ...");
    setPetPosition(clampPetPosition(drag.left + deltaX, drag.top + deltaY));
  };

  const handlePetPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved && petPositionRef.current) {
      setAmbientHint(COSMIC_DRAG_HINTS[Math.floor(Math.random() * COSMIC_DRAG_HINTS.length)]);
      try { window.localStorage.setItem("neo-universe-pet-position", JSON.stringify(petPositionRef.current)); } catch { /* Storage is optional. */ }
      window.setTimeout(() => setAmbientHint(""), 2800);
      window.setTimeout(() => setAmbientAnimation("idle"), 2800);
    }
    dragRef.current = null;
    setIsPetDragging(false);
    window.setTimeout(() => { draggedRef.current = false; }, 0);
  };

  const latestAssistantMessage = [...messages].reverse().find(
    (message) => message.sender === "bot" && message.id !== "welcome-1"
  );
  const latestBotMessage = [...messages].reverse().find((message) => message.sender === "bot");

  useEffect(() => {
    if (isOpen || petConversationOpen || !petVisible || !latestAssistantMessage) return;
    const speech = latestAssistantMessage.text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[#*_`>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const preview = speech.length > 112 ? `${speech.slice(0, 109).trimEnd()}…` : speech;
    if (!preview) return;
    setAmbientHint(preview);
    const timer = window.setTimeout(() => setAmbientHint(""), 7000);
    return () => window.clearTimeout(timer);
  }, [isOpen, petConversationOpen, petVisible, latestAssistantMessage]);

  useEffect(() => {
    if (!(isOpen || petConversationOpen) || !latestBotMessage) return;
    const response = latestBotMessage;
    let cursor = 0;
    const chunkSize = Math.max(2, Math.ceil(response.text.length / 80));
    setTypedReply({ id: response.id, text: "" });
    const timer = window.setInterval(() => {
      cursor = Math.min(response.text.length, cursor + chunkSize);
      setTypedReply({ id: response.id, text: response.text.slice(0, cursor) });
      if (cursor >= response.text.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [isOpen, petConversationOpen, latestBotMessage]);

  const responseAnimation = (text: string): NeoUniverseAnimation => {
    if (/đặt cọc|xác nhận đơn|xác nhận đặt|hoàn tất giao dịch|đã tạo đơn/i.test(text)) return "confirm";
    if (/đề xuất|gợi ý|nên chọn|phù hợp nhất|khuyên chọn/i.test(text)) return "recommend";
    if (/sản phẩm|mặt hàng|giá ước tính|tìm kiếm trên amazon|mercari/i.test(text)) return "presentation";
    if (/\?\s*$/.test(text.trim())) return "ask-alt";
    return "explain";
  };
  const petAnimation: NeoUniverseAnimation = (() => {
    if (!isOpen && !petConversationOpen) return ambientAnimation;
    if (petConversationOpen && showPetGreeting) return "ask-alt";
    if (isOpen && showGreetingAnimation) return "ask-alt";
    if (imageAnalyzing || loading) return "analyze";
    if (inputMessage.trim()) return "listen";
    return latestAssistantMessage ? responseAnimation(latestAssistantMessage.text) : "listen";
  })();

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
    if (!query.trim() || loading || imageAnalyzing) return;

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
      let enrichedQuery = query;
      let scrapedProductForQuote: { title: string; priceJpy: number; url: string } | null = null;

      // Detect links for automatic scraping
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = query.match(urlRegex);
      if (urls && urls.length > 0) {
        const targetUrl = urls[0];
        setMessages((prev) => [...prev, {
          id: "system-scrape-" + Date.now(),
          sender: "bot",
          text: `Đang kéo thông tin giá và sản phẩm từ link Nhật Bản...`,
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        }]);

        try {
          const scrapeRes = await fetch("/api/scrape-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: targetUrl }),
          });
          const scrapeData = await scrapeRes.json();
          
          if (scrapeRes.ok && scrapeData.success) {
            const sd = scrapeData.data;

            // Xây dựng context phong phú hơn với dữ liệu Agent mới trích xuất
            const variantInfo = sd.variants && sd.variants.length > 0
              ? `Biến thể có sẵn: ${sd.variants.map((v: { label: string; priceJpy: number | null }) => `${v.label}${v.priceJpy ? ` (¥${v.priceJpy.toLocaleString()})` : ""}`).join(", ")}.`
              : "";
            const riskInfo = sd.riskFlags && sd.riskFlags.length > 0
              ? `Cảnh báo: ${[
                  sd.riskFlags.includes("voltage_100v") ? "⚡ Điện áp 100V - cần biến áp tại VN" : null,
                  sd.riskFlags.includes("new_seller") || sd.riskFlags.includes("low_seller_rating") ? "⚠️ Shop ít đánh giá - khuyên kiểm tra kỹ" : null,
                  sd.riskFlags.includes("limited_stock") ? "🔥 Hàng giới hạn - nên đặt sớm" : null,
                ].filter(Boolean).join(", ")}.`
              : "";
            const sellerInfo = typeof sd.sellerRating === "number"
              ? `Đánh giá shop: ${sd.sellerRating}/5.`
              : "";
            const stockInfo = sd.stockStatus && sd.stockStatus !== "unknown"
              ? `Tình trạng kho: ${sd.stockStatus === "available" ? "Còn hàng" : sd.stockStatus === "sold_out" ? "Hết hàng" : "Hàng giới hạn"}.`
              : "";

            enrichedQuery += `\n\nThông tin trích xuất từ link: ${sd.title}${sd.titleJp ? ` (${sd.titleJp})` : ""}. ${variantInfo} ${stockInfo} ${sellerInfo} ${riskInfo}`;
            if (Number.isSafeInteger(sd.priceJpy) && sd.priceJpy > 0) {
              scrapedProductForQuote = {
                title: String(sd.title || "Sản phẩm từ link").slice(0, 200),
                priceJpy: sd.priceJpy,
                url: String(sd.url || targetUrl),
              };
            }

            // Remove the temporary "Đang kéo..." message
            setMessages((prev) => prev.filter(m => !m.id.startsWith("system-scrape-")));
          } else {
             // Let Gemini handle the error or raw link
             setMessages((prev) => prev.filter(m => !m.id.startsWith("system-scrape-")));
          }
        } catch {
           setMessages((prev) => prev.filter(m => !m.id.startsWith("system-scrape-")));
        }
      }

      // Chuẩn bị lịch sử hội thoại ngắn gửi kèm lên Gemini
      const conversationHistory = messages.filter(m => !m.id.startsWith("system-scrape-")).map((m) => ({
        role: m.sender === "user" ? "user" : "model",
        text: m.text,
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: enrichedQuery,
          personality,
          history: conversationHistory,
          scrapedProduct: scrapedProductForQuote,
        }),
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        const sources: MessageSource[] = Array.isArray(data.sources)
          ? data.sources.flatMap((source: unknown) => {
              if (!source || typeof source !== "object") return [];
              const item = source as Record<string, unknown>;
              if (
                typeof item.label !== "string" || typeof item.href !== "string" ||
                !item.href.startsWith("/") || item.href.startsWith("//") ||
                typeof item.checkedAt !== "string"
              ) return [];
              return [{ label: item.label.slice(0, 80), href: item.href, checkedAt: item.checkedAt }];
            })
          : [];
        const botMsg: Message = {
          id: "bot-" + Date.now(),
          sender: "bot",
          text: data.reply,
          isGuardrail: data.isGuardrailTriggered,
          sources,
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error(data.error || "Lỗi không xác định");
      }
    } catch {
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

  const selectImageFile = (file: File) => {
    if (loading || imageAnalyzing) return;
    const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!supportedTypes.includes(file.type.toLowerCase())) {
      setImageInputError("Neo hỗ trợ ảnh JPG, PNG, WebP hoặc GIF. Hãy thử chụp màn hình ảnh cần tìm.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageInputError("Ảnh gốc tối đa 10 MB. Bạn có thể chụp màn hình riêng vùng sản phẩm rồi dán lại.");
      return;
    }

    const previous = pendingImageRef.current;
    if (previous) {
      URL.revokeObjectURL(previous.previewUrl);
      imagePreviewUrlsRef.current.delete(previous.previewUrl);
    }
    const next = { file, previewUrl: URL.createObjectURL(file) };
    imagePreviewUrlsRef.current.add(next.previewUrl);
    pendingImageRef.current = next;
    setPendingImage(next);
    setImageInputError("");
  };

  const clearPendingImage = () => {
    const current = pendingImageRef.current;
    if (current) {
      URL.revokeObjectURL(current.previewUrl);
      imagePreviewUrlsRef.current.delete(current.previewUrl);
    }
    pendingImageRef.current = null;
    setPendingImage(null);
    setImageInputError("");
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) selectImageFile(file);
    event.currentTarget.value = "";
  };

  const handleClipboardPaste = (event: React.ClipboardEvent<HTMLElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find(
      (item) => item.kind === "file" && item.type.startsWith("image/")
    );
    const file = imageItem?.getAsFile();
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();
    selectImageFile(file);
  };

  const compressImageForVision = async (file: File): Promise<string> => {
    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Không đọc được ảnh. Hãy chọn một ảnh khác."));
        element.src = sourceUrl;
      });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Trình duyệt không thể xử lý ảnh này.");

      const qualities = [0.86, 0.78, 0.7, 0.62, 0.55];
      let maxDimension = 1600;
      let compressed: Blob | null = null;
      for (const quality of qualities) {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (compressed && compressed.size <= 3 * 1024 * 1024) break;
        maxDimension = Math.round(maxDimension * 0.82);
      }
      if (!compressed || compressed.size > 3 * 1024 * 1024) {
        throw new Error("Không thể giảm ảnh xuống dung lượng hỗ trợ. Hãy chọn ảnh nhỏ hoặc chụp riêng sản phẩm.");
      }

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Không thể chuẩn bị ảnh để gửi."));
        reader.readAsDataURL(compressed);
      });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const analyzeProductImage = async (file: File, question: string, previewUrl: string) => {
    setImageAnalyzing(true);
    setImageInputError("");
    setMessages((previous) => [...previous, {
      id: "user-img-" + Date.now(),
      sender: "user",
      text: question ? `🔎 Tìm sản phẩm từ ảnh\n${question}` : "🔎 Tìm sản phẩm có hình ảnh tương tự",
      imagePreviewUrl: previewUrl,
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    }]);

    try {
      const imageData = await compressImageForVision(file);
      const res = await fetch("/api/ai/image-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, question }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.analysis) {
        throw new Error(data.error || "Neo chưa phân tích được ảnh này. Vui lòng thử lại.");
      }

      const analysis = data.analysis;
      const categoryName: Record<string, string> = {
        cosmetics: "Mỹ phẩm",
        health: "Thực phẩm bổ sung / chăm sóc sức khỏe",
        gadgets: "Gia dụng / điện tử",
        anime: "Anime / mô hình",
        other: "Khác",
      };

      // ── Bước 1: Hiển thị thẻ nhận diện ảnh ──────────────────────────────────
      let replyText = "### 🔎 Nhận diện sản phẩm từ ảnh\n\n";
      if (analysis.nameJp) replyText += `**Tên tiếng Nhật:** ${analysis.nameJp}\n`;
      if (analysis.nameVi) replyText += `**Nhận diện sơ bộ:** ${analysis.nameVi}\n`;
      if (typeof analysis.visiblePriceJpy === "number") replyText += `**Giá nhìn thấy trong ảnh:** ¥${analysis.visiblePriceJpy.toLocaleString("ja-JP")} (chưa xác minh giá hiện tại)\n`;
      if (analysis.category) replyText += `**Danh mục:** ${categoryName[analysis.category] || "Khác"}\n`;
      if (analysis.voltageWarning) replyText += "\n⚠️ Ảnh có dấu hiệu ghi 100V/AC100V. Cần biến áp khi dùng tại Việt Nam.\n";
      if (analysis.riskNotes) replyText += `\n**Lưu ý từ ảnh:** ${analysis.riskNotes}\n`;
      if (analysis.description) replyText += `\n${analysis.description}\n`;

      const catalogMatches = analysis.catalogMatches as {
        status?: "matched" | "no_match" | "unavailable" | "not_searched";
        products?: Array<{ name: string; category: string; priceJpy: number }>;
      } | undefined;
      if (catalogMatches?.status === "matched" && catalogMatches.products?.length) {
        replyText += "\n\n**Gợi ý gần trong danh mục ChillBanana (đối chiếu từ khóa, chưa xác nhận đúng sản phẩm):**\n";
        catalogMatches.products.forEach((product) => {
          const safeName = String(product.name || "Sản phẩm").replace(/[\r\n<>\[\]()*_`!#>|]/g, " ").slice(0, 120);
          const safeCategory = String(product.category || "Hàng Nhật").replace(/[\r\n<>\[\]()*_`!#>|]/g, " ").slice(0, 80);
          const safePrice = Number.isSafeInteger(product.priceJpy) && product.priceJpy > 0
            ? `¥${product.priceJpy.toLocaleString("ja-JP")} (giá tham khảo trong danh mục)`
            : "giá cần kiểm tra";
          replyText += `- **${safeName}** — ${safeCategory} · ${safePrice} · [Mở danh mục](/#products)\n`;
        });
      } else if (catalogMatches?.status === "no_match") {
        replyText += "\n\nNeo chưa tìm thấy sản phẩm tương ứng trong danh mục ChillBanana. Từ khóa bên dưới chỉ mở kết quả tìm kiếm trên sàn Nhật; bạn có thể gửi thêm tên hoặc mã model để thu hẹp kết quả.\n";
      } else if (catalogMatches?.status === "unavailable") {
        replyText += "\n\nDanh mục sản phẩm ChillBanana hiện chưa truy cập được; các từ khóa bên dưới chỉ mở tìm kiếm trên sàn Nhật.\n";
      }

      const searchKeywords: string[] = Array.isArray(analysis.searchKeywords) ? analysis.searchKeywords : [];
      if (searchKeywords.length) {
        replyText += "\n**Mở tìm kiếm bằng từ khóa trên sàn Nhật:**\n";
        searchKeywords.forEach((keyword) => {
          const encoded = encodeURIComponent(keyword);
          replyText += `- **${keyword}** — [Amazon JP](https://www.amazon.co.jp/s?k=${encoded}) · [Mercari](https://jp.mercari.com/search?keyword=${encoded}) · [Rakuten](https://search.rakuten.co.jp/search/mall/${encoded}/)\n`;
        });
      } else {
        replyText += "\nNeo chưa đọc đủ tên hoặc đặc điểm để tạo từ khóa đáng tin cậy. Bạn hãy gửi ảnh rõ phần nhãn/model hoặc nhập thêm tên sản phẩm nhé.\n";
      }
      replyText += "\n*Gợi ý từ nội dung nhìn thấy trong ảnh — không phải xác nhận sản phẩm trùng khớp.*";

      setMessages((previous) => [...previous, {
        id: "bot-img-" + Date.now(),
        sender: "bot",
        text: replyText,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      }]);

    } catch (error) {
      const message = error instanceof Error ? error.message : "Neo chưa phân tích được ảnh này. Vui lòng thử ảnh khác.";
      setMessages((previous) => [...previous, {
        id: "err-img-" + Date.now(),
        sender: "bot",
        text: `Xin lỗi, ${message}`,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally {
      setImageAnalyzing(false);
    }
  };


  const submitComposer = () => {
    if (loading || imageAnalyzing) return;
    const image = pendingImageRef.current;
    if (!image) {
      void handleSendMessage();
      return;
    }

    pendingImageRef.current = null;
    setPendingImage(null);
    setInputMessage("");
    void analyzeProductImage(image.file, inputMessage.trim(), image.previewUrl);
  };
  const parseInlineFormatting = (text: string) => {
    // Keep URL query strings intact (for example %E9..., &, + and # in marketplace searches).
    // Also linkify raw URLs because model output is not always consistent about Markdown.
    const tokenRegex = /(!\[[^\]]*\]\(https?:\/\/[^\s)]+\)|\[[^\]]*\]\((?:https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*)\)|\*\*.*?\*\*|https?:\/\/[^\s<>()\]]+)/g;
    const parts = text.split(tokenRegex);

    const getSafeLink = (rawUrl: string) => {
      if (rawUrl.startsWith("/") && !rawUrl.startsWith("//") && !rawUrl.includes("\\")) {
        return { href: rawUrl, external: false };
      }
      try {
        const parsedUrl = new URL(rawUrl);
        if (parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:") {
          return { href: parsedUrl.toString(), external: true };
        }
      } catch {
        // Render malformed or unsupported links as plain text below.
      }
      return null;
    };

    return parts.map((chunk, idx) => {
      if (!chunk) return null;

      // 1. Ảnh Markdown: ![alt](url)
      if (chunk.startsWith("![") && chunk.endsWith(")")) {
        const imgMatch = chunk.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
        if (imgMatch) {
          const alt = imgMatch[1];
          const url = imgMatch[2];
          return <ChatImage key={idx} url={url} alt={alt} />;
        }
      }

      // 2. Link Markdown: [text](url)
      if (chunk.startsWith("[") && chunk.endsWith(")")) {
        const linkMatch = chunk.match(/^\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*)\)$/);
        if (linkMatch) {
          const linkText = linkMatch[1];
          const safeLink = getSafeLink(linkMatch[2]);
          if (!safeLink) return <span key={idx}>{chunk}</span>;
          return (
            <a
              key={idx}
              href={safeLink.href}
              target={safeLink.external ? "_blank" : undefined}
              rel={safeLink.external ? "noopener noreferrer nofollow" : undefined}
              className={`inline-flex max-w-full items-center underline font-semibold mx-1 px-1.5 py-0.5 rounded transition-colors ${
                linkText.includes("ĐẶT CỌC") || linkText.includes("MUA") 
                  ? "bg-banana-500 hover:bg-banana-600 text-navy-950 no-underline shadow-sm" 
                  : "bg-banana-50 text-banana-700 hover:text-banana-800"
              }`}
            >
              <span className="break-words">{linkText}</span>
              {safeLink.external && <span aria-hidden="true" className="text-[10px] ml-0.5 shrink-0">↗</span>}
            </a>
          );
        }
      }

      // 3. URL thuần cũng bấm được; chỉ cho phép HTTP(S), không render javascript: hay data:.
      if (/^https?:\/\//i.test(chunk)) {
        const safeLink = getSafeLink(chunk);
        if (safeLink) {
          return <a key={idx} href={safeLink.href} target="_blank" rel="noopener noreferrer nofollow"
            className="break-all font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900">
            {chunk}<span aria-hidden="true" className="ml-1 text-[10px]">↗</span>
          </a>;
        }
      }

      // 4. Bold text: **text**
      if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length >= 4) {
        return (
          <strong key={idx} className="font-semibold text-navy-950">
            {chunk.slice(2, -2)}
          </strong>
        );
      }

      // 5. Plain text
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

      // Blockquote for AI Quote Card (Báo giá)
      if (trimmed.startsWith("> ")) {
        return (
          <div key={lIdx} className="pl-3 py-0.5 border-l-4 border-banana-500 bg-banana-50/50 my-1 text-navy-900 rounded-r-lg">
            {parseInlineFormatting(trimmed.substring(2))}
          </div>
        );
      }

      const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
      return (
        <div
          key={lIdx}
          className={`min-h-[1.25rem] leading-relaxed ${isBullet ? "flex items-start gap-1.5 pl-1" : ""}`}
        >
          {isBullet ? <><span aria-hidden="true" className="text-banana-600">•</span><span>{parseInlineFormatting(trimmed.slice(2))}</span></> : parseInlineFormatting(line)}
        </div>
      );
    });
  };

  const renderMessageContent = (message: Message) => {
    if (message.sender === "bot" && typedReply?.id === message.id && typedReply.text.length < message.text.length) {
      return <span className="whitespace-pre-wrap">{typedReply.text}<span className="ml-0.5 animate-pulse text-banana-600">▍</span></span>;
    }
    return renderFormattedMessage(message.text);
  };

  const quickPrompts = [
    { label: "🎮 Máy chơi game Nhật 3tr", query: "Cho tôi xem link và hình tham khảo các dòng máy chơi game nội địa Nhật trong tầm giá 3 triệu" },
    { label: "👔 Hướng dẫn chọn Size", query: "Tư vấn cách chọn size quần áo Uniqlo và giày dép Nhật Bản" },
    { label: "⚡ Đồ điện 100V dùng sao?", query: "Đồ điện nội địa Nhật 100V dùng ở Việt Nam cần mua biến áp loại nào?" },
    { label: "✈ Tiết kiệm cước Gộp Đơn", query: "Tính năng gộp đơn Group Buy tiết kiệm 25% cước bay thế nào?" },
  ];

  const pendingImagePreview = (
    <>
      {pendingImage && (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-banana-200 bg-banana-50/70 p-2">
          <img src={pendingImage.previewUrl} alt="Ảnh sản phẩm chờ gửi" className="h-12 w-12 shrink-0 rounded-lg border border-white bg-white object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-navy-900">Ảnh đã sẵn sàng để tìm</p>
            <p className="text-[10px] leading-4 text-slate-600">Neo sẽ đọc dấu hiệu và gợi ý từ khóa trên sàn Nhật.</p>
          </div>
          <button type="button" onClick={clearPendingImage} className="rounded-full p-1.5 text-slate-500 hover:bg-white hover:text-rose-600" aria-label="Bỏ ảnh đính kèm" title="Bỏ ảnh">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {imageInputError && <p role="alert" className="mb-2 text-[11px] font-medium text-rose-600">{imageInputError}</p>}
    </>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleImageUpload}
        aria-label="Chọn ảnh sản phẩm để tìm"
      />
      {/* Floating Toggle Button */}
      {!isOpen && (petVisible ? (
        <div
          ref={petRef}
          className="pointer-events-none fixed z-40"
          style={{ ...(petPosition ? { left: petPosition.left, top: petPosition.top } : { right: 12, bottom: 12 }), transition: isPetDragging ? "none" : "left 2.1s cubic-bezier(.2,.8,.2,1), top 2.1s cubic-bezier(.2,.8,.2,1)" }}
        >
          {ambientHint && !petConversationOpen && (
            <div
              role="status"
              className="pointer-events-none absolute bottom-full right-2 mb-2 w-max max-w-[min(260px,calc(100vw-32px))] whitespace-normal break-words rounded-2xl border border-banana-300 bg-white/95 px-3.5 py-2 text-xs font-semibold leading-snug text-slate-800 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 dark:border-banana-400/50 dark:bg-slate-900/95 dark:text-slate-100"
            >
              {typedHint}
              {typedHint.length < ambientHint.length && <span className="animate-pulse text-banana-600 dark:text-banana-400">▍</span>}
            </div>
          )}
          <button
            id="ai-chat-toggle-btn"
            onClick={() => { if (draggedRef.current) return; setAmbientHint(""); setPetConversationOpen(true); }}
            onPointerDown={handlePetPointerDown}
            onPointerMove={handlePetPointerMove}
            onPointerUp={handlePetPointerUp}
            onPointerCancel={handlePetPointerUp}
            onPointerEnter={() => { setIsPetHovered(true); setAmbientAnimation("ask-alt"); setAmbientHint(COSMIC_HOVER_HINTS[Math.floor(Math.random() * COSMIC_HOVER_HINTS.length)]); }}
            onPointerLeave={() => { setIsPetHovered(false); setAmbientAnimation((current) => current === "ask-alt" ? "idle" : current); setAmbientHint(""); }}
            className="pointer-events-auto flex touch-none select-none flex-col items-center justify-end rounded-2xl p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-banana-500"
            style={{ touchAction: "none" }}
            aria-label="Mở tư vấn AI cùng Neo Universe"
          >
            <span className="relative flex h-[104px] w-[94px] items-end justify-center sm:h-[126px] sm:w-[112px]">
              <NeoUniverseSprite animation={petAnimation} flipX={facingLeft} className="h-full w-full" />
              <span className="absolute right-0 top-2 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
              </span>
            </span>
          </button>
          {petConversationOpen && petConversationPosition && (
            <section
              role="dialog"
              aria-label="Trò chuyện trực tiếp với Neo Universe"
              onPaste={handleClipboardPaste}
              className="pointer-events-auto fixed z-[9998] flex max-h-[min(360px,calc(100vh-24px))] flex-col overflow-hidden rounded-3xl border border-banana-200 bg-white shadow-2xl"
              style={{ left: petConversationPosition.left, top: petConversationPosition.top, width: petConversationPosition.width }}
            >
              <header className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-navy-950 to-navy-800 px-3 py-2.5 text-white">
                <span className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white/10">
                  <NeoUniverseSprite animation={petAnimation} flipX={facingLeft} className="h-full w-full" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Neo Universe</p>
                  <p className="text-[10px] text-emerald-300">{loading ? "Đang xử lý tín hiệu..." : "Đang kết nối cùng bạn"}</p>
                </div>
                <button type="button" onClick={() => { setPetConversationOpen(false); setIsOpen(true); }} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-white/10 hover:text-white" title="Mở khung tư vấn đầy đủ">Mở chat</button>
                <button type="button" onClick={() => setPetConversationOpen(false)} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Đóng hội thoại với Neo">
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div ref={petDialogueRef} className="min-h-0 max-h-52 flex-1 space-y-2 overflow-y-auto bg-slate-50/80 p-3 text-xs" role="log" aria-live="polite" aria-relevant="additions text">
                {messages.slice(-5).map((message) => (
                  <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] overflow-hidden rounded-2xl px-3 py-2 ${message.sender === "user" ? "rounded-br-md bg-navy-900 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm"}`}>
                      {message.imagePreviewUrl && <img src={message.imagePreviewUrl} alt="Ảnh sản phẩm người dùng gửi" className="mb-2 max-h-36 max-w-full rounded-lg object-contain" />}
                      <div className="break-words">{renderMessageContent(message)}</div>
                      {message.sender === "bot" && message.sources?.length ? (
                        <div className="mt-2 border-t border-slate-100 pt-1.5 text-[9px] text-slate-500">
                          Kiểm tra lúc {formatSourceTime(message.sources[0].checkedAt)} · {message.sources.map((source, index) => (
                            <React.Fragment key={`${source.href}-${index}`}>
                              {index > 0 ? ", " : ""}<a href={source.href} className="font-semibold text-blue-700 underline decoration-blue-200 underline-offset-2">{source.label}</a>
                            </React.Fragment>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {loading && <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-slate-600 shadow-sm"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Neo đang phân tích tọa độ dữ liệu…</div>}
              </div>

              {!messages.some((message) => message.sender === "user") && (
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-white px-3 py-2">
                  <button type="button" disabled={loading || imageAnalyzing || Boolean(pendingImage)} onClick={() => handleSendMessage("Quét tọa độ hàng hot nội địa Nhật giúp tôi")} className="rounded-full border border-banana-200 bg-banana-50 px-2.5 py-1 text-[10px] font-semibold text-navy-800 hover:bg-banana-100 disabled:opacity-40">Quét hàng hot Nhật</button>
                  <button type="button" disabled={loading || imageAnalyzing || Boolean(pendingImage)} onClick={() => handleSendMessage("Đồ điện 100V của Nhật dùng ở Việt Nam thế nào?")} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40">Kiểm tra điện 100V</button>
                  <button type="button" disabled={loading || imageAnalyzing || Boolean(pendingImage)} onClick={() => handleSendMessage("Ước tính phí bay Narita về Việt Nam")} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40">Cước bay Narita ➔ VN</button>
                </div>
              )}

              <div className="border-t border-slate-100 bg-white p-2.5">
                {pendingImagePreview}
                <form onSubmit={(event) => { event.preventDefault(); submitComposer(); }} className="flex items-center gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || imageAnalyzing} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-banana-300 hover:bg-banana-50 disabled:opacity-40" aria-label="Chọn hoặc dán ảnh sản phẩm" title="Chọn ảnh hoặc Ctrl+V để dán ảnh">
                  <ImagePlus className="h-4 w-4" />
                </button>
                <input
                  value={inputMessage}
                  onChange={(event) => setInputMessage(event.target.value)}
                  placeholder={pendingImage ? "Hỏi thêm về sản phẩm trong ảnh…" : "Nhắn hoặc dán ảnh để tìm sản phẩm…"}
                  aria-label="Tin nhắn gửi Neo Universe"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-banana-400 focus:ring-2 focus:ring-banana-100"
                  disabled={loading || imageAnalyzing}
                />
                <button type="submit" disabled={loading || imageAnalyzing || (!inputMessage.trim() && !pendingImage)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-banana-500 text-navy-950 hover:bg-banana-400 disabled:cursor-not-allowed disabled:opacity-50" aria-label={pendingImage ? "Tìm sản phẩm từ ảnh" : "Gửi tin nhắn cho Neo"}>
                  {imageAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
                </form>
              </div>
            </section>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setPetVisible(true)} className="fixed bottom-5 right-5 z-40 rounded-full border border-banana-200 bg-white px-3 py-2 text-xs font-bold text-navy-900 shadow-lg hover:bg-banana-50" aria-label="Hiện lại Neo Universe">✦ Hiện Neo</button>
      ))}

      {/* Chat Window Panel */}
      {isOpen && (
        <div onPaste={handleClipboardPaste} className="fixed bottom-20 right-2 sm:right-6 z-[9999] w-[96vw] sm:w-[500px] h-[640px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header */}
          <div className="bg-navy-900 text-white p-4 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-banana-500/15 flex items-center justify-center overflow-hidden shadow">
                  <NeoUniverseSprite animation={petAnimation} className="h-full w-full" />
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
                  {msg.imagePreviewUrl && <img src={msg.imagePreviewUrl} alt="Ảnh sản phẩm người dùng gửi" className="mb-2 max-h-64 max-w-full rounded-xl object-contain" />}
                  {msg.isGuardrail && (
                    <div className="flex items-center space-x-1 text-[10px] font-bold text-amber-800 mb-1">
                      <ShieldAlert className="w-3 h-3 text-amber-600" />
                      <span>Thông Báo Phạm Vi Tư Vấn</span>
                    </div>
                  )}
                  <div className="whitespace-pre-line space-y-2 leading-relaxed">
                    {renderMessageContent(msg)}
                  </div>
                  {msg.sender === "bot" && msg.sources?.length ? (
                    <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-relaxed text-slate-500">
                      <span className="font-semibold">Nguồn đã kiểm tra lúc {formatSourceTime(msg.sources[0].checkedAt)}:</span>{" "}
                      {msg.sources.map((source, index) => (
                        <React.Fragment key={`${source.href}-${index}`}>
                          {index > 0 ? ", " : ""}<a href={source.href} className="font-semibold text-blue-700 underline decoration-blue-200 underline-offset-2">{source.label}</a>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : null}
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
                disabled={loading || imageAnalyzing || Boolean(pendingImage)}
                onClick={() => handleSendMessage(p.query)}
                className="whitespace-nowrap px-2.5 py-1 bg-slate-100 hover:bg-banana-50 hover:text-banana-800 text-slate-700 text-[11px] font-semibold rounded-xl border border-slate-200 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-slate-200">
            {pendingImagePreview}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitComposer();
              }}
              className="flex items-center space-x-2"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageAnalyzing || loading}
                className="p-2.5 bg-slate-100 hover:bg-banana-100 disabled:opacity-40 text-slate-600 hover:text-banana-700 rounded-2xl transition-all shrink-0"
                title="Chọn ảnh hoặc Ctrl+V để tìm sản phẩm trên sàn Nhật"
                aria-label="Chọn hoặc dán ảnh sản phẩm"
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
                  pendingImage
                    ? "Có thể hỏi thêm về sản phẩm trong ảnh..."
                    : personality === "omotenashi"
                    ? "Hỏi Neo hoặc Ctrl+V dán ảnh sản phẩm..."
                    : "Nhắn Neo hoặc dán ảnh để tìm hàng Nhật..."
                }
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white transition-all"
                disabled={loading || imageAnalyzing}
              />
              <button
                type="submit"
                disabled={loading || imageAnalyzing || (!inputMessage.trim() && !pendingImage)}
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
