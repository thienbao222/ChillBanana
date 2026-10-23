"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function MockPaymentContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const orderCode = params.get("orderCode") || "";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const simulate = async (outcome: "success" | "failed" | "pending" | "timeout") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/payment/mock-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, outcome }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể chạy kịch bản mô phỏng.");
      if (result.result === "confirmed" || result.result === "simulated_success") {
        if (result.result === "confirmed") {
          const code = result.orderCode || orderCode;
          router.push(`/tracking?code=${encodeURIComponent(code)}&payment=success`);
          return;
        }
        setMessage("Đã ghi nhận kịch bản thành công. Đơn vẫn ở trạng thái chờ thanh toán thật và chưa chuyển sang xử lý mua hàng.");
        return;
      }
      setMessage(result.result === "pending"
        ? "Kết quả đang chờ. Bạn có thể mô phỏng xác nhận thành công sau đó."
        : result.result === "timeout"
          ? "Đã mô phỏng hết thời gian chờ; đơn chưa được ghi nhận thanh toán. Hãy quay lại trang đơn và tạo lượt thanh toán mới."
          : "Đã mô phỏng giao dịch thất bại; đơn chưa được ghi nhận thanh toán. Hãy quay lại trang đơn và tạo lượt thanh toán mới.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <section className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-6 shadow-xl sm:p-9">
        <div className="mb-6 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">MÔI TRƯỜNG MÔ PHỎNG</div>
        <h1 className="text-2xl font-extrabold">ChillBanana Payment Sandbox</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Trang này chỉ dùng để kiểm thử các kết quả thanh toán. Không kết nối ngân hàng, không thu tiền và không tạo giao dịch thật.</p>
        {orderCode && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">Mã đơn: <strong>{orderCode}</strong></p>}
        {message && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{message}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button disabled={busy || !token} onClick={() => simulate("success")} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Mô phỏng thành công</button>
          <button disabled={busy || !token} onClick={() => simulate("failed")} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Mô phỏng thất bại</button>
          <button disabled={busy || !token} onClick={() => simulate("pending")} className="rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Mô phỏng chờ xử lý</button>
          <button disabled={busy || !token} onClick={() => simulate("timeout")} className="rounded-xl bg-slate-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Mô phỏng timeout</button>
        </div>
        <button onClick={() => router.replace(orderCode ? `/tracking?orderCode=${encodeURIComponent(orderCode)}` : "/tracking")} className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">Quay lại trang theo dõi đơn</button>
        {busy && <p className="mt-4 text-center text-xs text-slate-500" role="status">Đang xử lý kịch bản mô phỏng…</p>}
      </section>
    </main>
  );
}

export default function MockPaymentPage() {
  return <Suspense fallback={<main className="p-10 text-center">Đang tải trang thanh toán mô phỏng…</main>}><MockPaymentContent /></Suspense>;
}
