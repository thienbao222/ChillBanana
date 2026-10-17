"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Trang "Đặt lại mật khẩu" — Bước 2
 * Đọc ?token= từ URL → form nhập mật khẩu mới → gọi API reset
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setStatus("error");
      setMessage("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/auth/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", token, newPassword: password }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("done");
        setMessage(data.message || "Mật khẩu đã được đặt lại thành công.");
        // Redirect về login sau 3 giây
        setTimeout(() => router.push("/?auth=login"), 3000);
      } else {
        setStatus("error");
        setMessage(data.error || "Không thể đặt lại mật khẩu. Vui lòng thử lại.");
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">Đặt mật khẩu mới</h2>

          {status === "done" ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-green-700 font-semibold">{message}</p>
              <p className="text-gray-400 text-sm mt-2">Đang chuyển hướng về trang đăng nhập...</p>
              <Link
                href="/?auth=login"
                className="mt-6 inline-block bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-bold py-2 px-6 rounded-xl"
              >
                Đăng nhập ngay
              </Link>
            </div>
          ) : !token ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">❌</div>
              <p className="text-red-700 font-semibold">{message}</p>
              <Link
                href="/forgot-password"
                className="mt-6 inline-block text-yellow-600 hover:text-yellow-700 font-medium text-sm"
              >
                → Yêu cầu link mới
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mật khẩu mới
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  disabled={status === "loading"}
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
                  Xác nhận mật khẩu
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  disabled={status === "loading"}
                />
                {confirm && password !== confirm && (
                  <p className="text-red-500 text-xs mt-1">Mật khẩu không khớp.</p>
                )}
              </div>

              {status === "error" && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  ⚠️ {message}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading" || password.length < 8 || password !== confirm}
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
                    Đang cập nhật...
                  </span>
                ) : (
                  "Đặt lại mật khẩu"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Bọc trong Suspense vì dùng useSearchParams (Next.js 15 requirement)
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Đang tải...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
