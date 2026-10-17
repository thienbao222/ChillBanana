"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Trang "Quên mật khẩu" — Bước 1
 * Khách nhập email → hệ thống gửi link đặt lại (1h hết hạn)
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/auth/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email: email.trim().toLowerCase() }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("done");
        setMessage(data.message || "Đã gửi email hướng dẫn đặt lại mật khẩu.");
      } else if (res.status === 429) {
        setStatus("error");
        setMessage("Quá nhiều yêu cầu. Vui lòng thử lại sau vài phút.");
      } else {
        setStatus("error");
        setMessage(data.error || "Đã xảy ra lỗi. Vui lòng thử lại.");
      }
    } catch {
      setStatus("error");
      setMessage("Không thể kết nối máy chủ. Vui lòng kiểm tra internet.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-4xl">🍌</span>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">ChillBanana</h1>
          </Link>
          <p className="text-gray-500 text-sm mt-1">Mua hàng Nhật Bản · Giao tận tay Việt Nam</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Quên mật khẩu?</h2>
          <p className="text-gray-500 text-sm mb-6">
            Nhập email đăng ký của bạn — chúng tôi sẽ gửi link đặt lại mật khẩu (có hiệu lực 1 giờ).
          </p>

          {status === "done" ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">📧</div>
              <p className="text-green-700 font-semibold">{message}</p>
              <p className="text-gray-500 text-sm mt-2">
                Kiểm tra hộp thư đến (và thư mục Spam nếu không thấy).
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block text-yellow-600 hover:text-yellow-700 font-medium text-sm"
              >
                ← Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email đăng ký
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@gmail.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  disabled={status === "loading"}
                />
              </div>

              {status === "error" && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  ⚠️ {message}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading" || !email.trim()}
                className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-bold py-3 rounded-xl
                           hover:from-yellow-500 hover:to-orange-500 transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "loading" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Đang gửi...
                  </span>
                ) : (
                  "Gửi link đặt lại mật khẩu"
                )}
              </button>

              <p className="text-center text-sm text-gray-500">
                Nhớ mật khẩu rồi?{" "}
                <Link href="/login" className="text-yellow-600 hover:text-yellow-700 font-medium">
                  Đăng nhập
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
