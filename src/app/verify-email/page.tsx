"use client";

import { useEffect, useState } from "react";

export default function VerifyEmailPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  const verify = async () => {
    if (!token || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/customer/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "Không xác minh được email.");
        setLoading(false);
        return;
      }
      window.location.replace("/profile?verified=success");
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mb-3 text-4xl" aria-hidden="true">✉️</div>
        <h1 className="font-serif text-2xl font-bold text-navy-900">Xác minh email</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Xác minh địa chỉ email để kích hoạt tài khoản và kết nối các đơn hàng cũ thuộc về bạn.
        </p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button
          type="button"
          onClick={verify}
          disabled={!token || loading}
          className="mt-6 w-full rounded-xl bg-navy-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Đang xác minh..." : "Xác minh và kích hoạt tài khoản"}
        </button>
        {!token && <p className="mt-3 text-xs text-rose-600">Liên kết thiếu mã xác minh. Hãy mở lại email xác minh.</p>}
      </section>
    </main>
  );
}
