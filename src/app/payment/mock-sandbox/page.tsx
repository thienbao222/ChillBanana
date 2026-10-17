"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, AlertTriangle, ArrowLeft, ShieldCheck, CreditCard, RefreshCw } from "lucide-react";

interface OrderInfo {
  orderCode: string;
  customerName: string;
  productName: string;
  depositAmountVnd: number;
  totalVnd: number;
  depositPercent: number;
  paymentStatus: string;
  status: string;
}

function MockSandboxInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderCode = searchParams.get("orderCode") || "";

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState<"idle" | "success" | "fail" | "cancel">("idle");
  const [resultMessage, setResultMessage] = useState("");

  // Tải thông tin đơn hàng
  useEffect(() => {
    if (!orderCode) {
      setError("Không tìm thấy mã đơn hàng trong tham số yêu cầu.");
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`);
        const data = await res.json();
        if (res.ok && data.order) {
          setOrder(data.order);
        } else {
          setError(data.error || "Không tìm thấy thông tin đơn hàng.");
        }
      } catch {
        setError("Không thể kết nối máy chủ để lấy thông tin đơn hàng.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderCode]);

  const handleAction = async (action: "success" | "fail" | "cancel") => {
    if (!orderCode) return;
    setProcessing(action);

    try {
      const res = await fetch("/api/payment/mock-sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode, action }),
      });
      const data = await res.json();

      if (data.redirectUrl) {
        setResultMessage(data.message || "Đang chuyển hướng về trang theo dõi đơn hàng...");
        setTimeout(() => {
          router.push(data.redirectUrl);
        }, 1200);
      } else {
        setError(data.error || "Có lỗi xảy ra khi xử lý.");
        setProcessing("idle");
      }
    } catch {
      setError("Không thể gửi yêu cầu đến máy chủ.");
      setProcessing("idle");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center text-white">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-yellow-400 mb-4" />
          <h2 className="text-lg font-bold">Đang tải Cổng Thanh Toán Sandbox...</h2>
          <p className="text-slate-400 text-sm mt-1">Đang kết nối môi trường thử nghiệm ChillBanana</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center text-white">
          <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Lỗi truy cập Sandbox</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Về Trang Chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      <div className="max-w-2xl w-full mx-auto my-auto">
        {/* Banner Sandbox */}
        <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-orange-500/20 border border-amber-500/40 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <div className="bg-amber-500 text-slate-950 rounded-lg p-2 font-black text-xs uppercase tracking-wider">
            Sandbox Mode
          </div>
          <div className="text-xs text-amber-200">
            <strong>Môi trường thử nghiệm Pre-production:</strong> Không trừ tiền thật. Dùng để test luồng thanh toán và cập nhật đơn hàng tự động.
          </div>
        </div>

        {/* Card chính */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-slate-850 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🍌</span>
              <div>
                <h1 className="font-extrabold text-lg text-white">ChillBanana Pay</h1>
                <p className="text-xs text-slate-400">Cổng Giả Lập Thanh Toán Trực Tuyến</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1.5 rounded-full font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>TLS 1.3 Verified</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Thông tin số tiền */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Số tiền cần thanh toán ({order.depositPercent}% đặt cọc)
              </p>
              <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">
                {order.depositAmountVnd.toLocaleString("vi-VN")} <span className="text-lg font-bold text-slate-400">VND</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Tổng giá trị đơn: {order.totalVnd.toLocaleString("vi-VN")} VND
              </p>
            </div>

            {/* Chi tiết đơn */}
            <div className="bg-slate-850/60 rounded-xl p-4 border border-slate-800/60 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Mã đơn hàng:</span>
                <span className="font-mono font-bold text-white">{order.orderCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Khách hàng:</span>
                <span className="font-medium text-white">{order.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sản phẩm:</span>
                <span className="font-medium text-white text-right truncate max-w-[260px]">{order.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trạng thái thanh toán:</span>
                <span className="font-bold text-amber-400">{order.paymentStatus}</span>
              </div>
            </div>

            {/* Thông báo kết quả đang chuyển hướng */}
            {resultMessage && (
              <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 p-4 rounded-xl text-center text-sm font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{resultMessage}</span>
              </div>
            )}

            {/* Nút hành động mô phỏng */}
            <div className="space-y-3 pt-2">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider text-center">
                Chọn kịch bản kiểm thử:
              </p>

              {/* Success */}
              <button
                type="button"
                disabled={processing !== "idle"}
                onClick={() => handleAction("success")}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-950/50"
              >
                {processing === "success" ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                <span>Xác nhận Thanh toán Thành công (Mã 00 - GD Hợp Lệ)</span>
              </button>

              {/* Fail */}
              <button
                type="button"
                disabled={processing !== "idle"}
                onClick={() => handleAction("fail")}
                className="w-full bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-700 border border-slate-700 disabled:opacity-50 text-slate-300 font-medium py-3 px-6 rounded-xl transition flex items-center justify-center gap-2.5 text-sm"
              >
                {processing === "fail" ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                <span>Mô phỏng Thất bại (Mã 51 - Số dư không đủ / Thẻ lỗi)</span>
              </button>

              {/* Cancel */}
              <button
                type="button"
                disabled={processing !== "idle"}
                onClick={() => handleAction("cancel")}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-50 text-slate-400 font-normal py-2.5 px-6 rounded-xl transition flex items-center justify-center gap-2 text-xs"
              >
                {processing === "cancel" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>Khách hàng bấm Hủy giao dịch (Mã 24)</span>
              </button>
            </div>
          </div>

          {/* Footer Card */}
          <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 text-center text-xs text-slate-500">
            ChillBanana Mock Payment Gateway · Pre-Production Testbed v1.0
          </div>
        </div>
      </div>

      {/* Footer page */}
      <footer className="text-center text-xs text-slate-600 mt-6">
        © 2026 ChillBanana.vn — Dành cho mục đích kiểm thử và demo quy trình vận hành.
      </footer>
    </div>
  );
}

export default function MockSandboxPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          Đang khởi tạo Sandbox...
        </div>
      }
    >
      <MockSandboxInner />
    </Suspense>
  );
}
