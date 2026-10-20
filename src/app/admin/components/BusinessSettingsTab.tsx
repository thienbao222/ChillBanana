"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save, RotateCw, Settings2 } from "lucide-react";

type PricingValues = {
  serviceFeePercent: number;
  serviceFeeMinimumVnd: number;
  airShippingPerKgVnd: number;
  groupBuyShippingDiscountPercent: number;
  groupBuyMaxWeightKg: number;
  minimumBaseOrderVnd: number;
  fallbackJpyVndRate: number;
  usdVndReferenceRate: number;
  fxSpreadPercent: number;
};

type PricingVersion = {
  version: number;
  values: PricingValues;
  changedBy: string;
  changeReason: string | null;
  createdAt: string;
};

type EmailLog = {
  id: string;
  emailType: string;
  providerMode: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  lastErrorCode: string | null;
  nextRetryAt: string | null;
  sentAt: string | null;
  createdAt: string;
  order: { orderCode: string } | null;
};

type ServiceModes = {
  paymentMode: "mock" | "sandbox" | "blocked-live" | "misconfigured";
  vnpaySandboxReady: boolean;
  emailMode: "mock" | "smtp";
  smtpReady: boolean;
  livePaymentEnabled: false;
};

const PRICE_FIELDS: Array<{ key: keyof PricingValues; label: string; suffix: string; step?: string; help: string }> = [
  { key: "serviceFeePercent", label: "Phí dịch vụ", suffix: "%", step: "0.1", help: "Tính trên giá trị hàng; áp dụng thêm mức phí tối thiểu." },
  { key: "serviceFeeMinimumVnd", label: "Phí dịch vụ tối thiểu", suffix: "đ", help: "Mức sàn cho mỗi báo giá." },
  { key: "airShippingPerKgVnd", label: "Cước bay tham chiếu", suffix: "đ/kg", help: "Cước dự kiến; nhân viên vẫn xác nhận chi phí thực tế." },
  { key: "groupBuyShippingDiscountPercent", label: "Giảm cước khi gộp đơn", suffix: "%", step: "0.1", help: "Chỉ áp dụng trong giới hạn trọng lượng bên dưới." },
  { key: "groupBuyMaxWeightKg", label: "Giới hạn trọng lượng gộp đơn", suffix: "kg", step: "0.01", help: "Vượt mức này thì không áp dụng giảm cước." },
  { key: "minimumBaseOrderVnd", label: "Giá trị hàng tối thiểu", suffix: "đ", help: "So với tiền hàng cộng phí dịch vụ, chưa gồm cước." },
  { key: "fallbackJpyVndRate", label: "Tỷ giá JPY/VND dự phòng", suffix: "đ/¥", help: "Chỉ dùng khi mọi nguồn tỷ giá trực tuyến lỗi; đơn vẫn bị chặn nếu tỷ giá stale." },
  { key: "usdVndReferenceRate", label: "USD/VND tham chiếu", suffix: "đ/$", help: "Dùng để tính cross-rate JPY/VND từ Frankfurter." },
  { key: "fxSpreadPercent", label: "Biên độ tỷ giá an toàn (FX Spread)", suffix: "%", step: "0.1", help: "Cộng thêm vào tỷ giá Live quốc tế để bù phí chuyển đổi ngoại tệ ngân hàng và trượt giá (mô hình Buyee/ZenMarket)." },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function formatValue(value: number, suffix: string) {
  return `${value.toLocaleString("vi-VN")}${suffix === "%" || suffix === "kg" ? "" : " "}${suffix}`;
}

export default function BusinessSettingsTab() {
  const [current, setCurrent] = useState<PricingVersion | null>(null);
  const [history, setHistory] = useState<PricingVersion[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [serviceModes, setServiceModes] = useState<ServiceModes | null>(null);
  const [draft, setDraft] = useState<PricingValues | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pricingResponse, emailResponse, modesResponse] = await Promise.all([
        fetch("/api/admin/pricing-config", { cache: "no-store" }),
        fetch("/api/admin/email-logs", { cache: "no-store" }),
        fetch("/api/admin/service-modes", { cache: "no-store" }),
      ]);
      const [pricingData, emailData, modesData] = await Promise.all([pricingResponse.json(), emailResponse.json(), modesResponse.json()]);
      if (!pricingResponse.ok) throw new Error(pricingData.error || "Không tải được cấu hình giá.");
      if (!emailResponse.ok) throw new Error(emailData.error || "Không tải được nhật ký email.");
      if (!modesResponse.ok) throw new Error(modesData.error || "Không tải được trạng thái provider.");
      const currentValues = {
        ...pricingData.current.values,
        fxSpreadPercent: pricingData.current.values.fxSpreadPercent ?? 0,
      };
      setCurrent({ ...pricingData.current, values: currentValues });
      setDraft(currentValues);
      setHistory((pricingData.history || []).map((h: PricingVersion) => ({
        ...h,
        values: { ...h.values, fxSpreadPercent: h.values?.fxSpreadPercent ?? 0 },
      })));
      setLogs(emailData.logs || []);
      setServiceModes(modesData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải cài đặt nghiệp vụ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/pricing-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: draft, changeReason: reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không lưu được bảng giá.");
      setNotice(data.unchanged
        ? `Cấu hình không đổi; hệ thống giữ nguyên phiên bản v${data.current.version}.`
        : `Đã lưu phiên bản giá v${data.current.version}. Báo giá mới sẽ dùng phiên bản này.`);
      setReason("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được cấu hình.");
    } finally {
      setSaving(false);
    }
  };

  const retry = async (id: string) => {
    setRetryingId(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/email-logs/${encodeURIComponent(id)}/retry`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thử lại được email.");
      setNotice(data.message || "Đã xử lý yêu cầu thử gửi lại.");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thử lại được email.");
    } finally {
      setRetryingId(null);
    }
  };

  if (loading && !current) {
    return <div className="rounded-2xl bg-white p-10 text-center text-slate-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />Đang tải cài đặt nghiệp vụ…</div>;
  }

  return (
    <section className="space-y-6" aria-label="Cài đặt nghiệp vụ">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800"><Settings2 className="h-3.5 w-3.5" />Cấu hình nghiệp vụ</div>
          <h1 className="text-2xl font-extrabold text-slate-900">Giá, thanh toán mô phỏng & email</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Thay đổi bảng giá sẽ tạo phiên bản mới và lưu lại người sửa. Thanh toán live luôn bị khóa; chế độ mock không chuyển tiền thật.</p>
        </div>
        <button type="button" onClick={() => void reload()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Làm mới</button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {serviceModes && <section className="grid gap-3 sm:grid-cols-3" aria-label="Trạng thái dịch vụ">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">Thanh toán</p><p className="mt-1 text-lg font-extrabold text-slate-900">{serviceModes.paymentMode === "mock" ? "Mock" : serviceModes.paymentMode === "sandbox" ? "VNPAY Sandbox" : serviceModes.paymentMode === "blocked-live" ? "Live bị khóa" : "Cấu hình lỗi"}</p><p className="mt-1 text-xs text-slate-500">{serviceModes.paymentMode === "sandbox" ? (serviceModes.vnpaySandboxReady ? "Merchant sandbox đã cấu hình." : "Merchant sandbox chưa đủ credentials.") : "Live luôn tắt; mock/sandbox không xác nhận tiền thật."}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">Email</p><p className="mt-1 text-lg font-extrabold text-slate-900">{serviceModes.emailMode === "smtp" ? "SMTP" : "Mock"}</p><p className="mt-1 text-xs text-slate-500">{serviceModes.emailMode === "smtp" ? (serviceModes.smtpReady ? "SMTP credentials đã cấu hình." : "SMTP credentials chưa đủ.") : "Không gửi email thật; log ghi SIMULATED."}</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"><p className="text-xs font-bold uppercase text-emerald-700">Thanh toán live</p><p className="mt-1 text-lg font-extrabold text-emerald-950">Đang khóa</p><p className="mt-1 text-xs text-emerald-800">Không thể bật thu tiền thật từ trang quản trị.</p></div>
      </section>}

      {draft && current && <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(330px,0.7fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div><h2 className="text-lg font-bold text-slate-900">Bảng giá hiện hành</h2><p className="text-xs text-slate-500">Phiên bản v{current.version} · cập nhật {formatDate(current.createdAt)} bởi {current.changedBy}</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {PRICE_FIELDS.map(({ key, label, suffix, step = "1", help }) => (
              <label key={key} className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-800">{label} <span className="font-normal text-slate-500">({suffix})</span></span>
                <input
                  type="number"
                  min={0}
                  step={step}
                  value={draft[key]}
                  onChange={(event) => setDraft((previous) => previous ? { ...previous, [key]: event.target.value === "" ? 0 : Number(event.target.value) } : previous)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
                <span className="mt-1 block text-xs leading-5 text-slate-500">{help}</span>
              </label>
            ))}
          </div>
          <label className="mt-4 block"><span className="mb-1 block text-sm font-semibold text-slate-800">Lý do thay đổi</span><input maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: cập nhật cước bay quý 4" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>
          <button type="button" disabled={saving || !reason.trim()} onClick={() => void save()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Đang lưu…" : "Lưu phiên bản giá mới"}</button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Lịch sử thay đổi</h2>
          <p className="mb-4 text-xs text-slate-500">Phiên bản cũ được giữ nguyên để truy vết báo giá.</p>
          <ol className="max-h-[560px] space-y-3 overflow-y-auto">
            {history.map((item) => <li key={item.version} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-900">Phiên bản v{item.version}</strong><time className="text-xs text-slate-500">{formatDate(item.createdAt)}</time></div>
              <p className="mt-1 text-xs text-slate-500">Bởi {item.changedBy}{item.changeReason ? ` · ${item.changeReason}` : ""}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-700">
                {PRICE_FIELDS.map(({ key, label, suffix }) => <span key={key}>{label}: <b>{formatValue(item.values[key], suffix)}</b></span>)}
              </div>
            </li>)}
            {!history.length && <li className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có lịch sử cấu hình.</li>}
          </ol>
        </section>
      </div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-bold text-slate-900">Nhật ký email giao dịch</h2><p className="text-xs text-slate-500">Không lưu địa chỉ email hoặc nội dung thư trong nhật ký này.</p></div><span className="text-xs text-slate-500">Tối đa 100 bản ghi gần nhất</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="px-3 py-3">Thời điểm</th><th className="px-3 py-3">Loại thư</th><th className="px-3 py-3">Đơn hàng</th><th className="px-3 py-3">Chế độ</th><th className="px-3 py-3">Trạng thái</th><th className="px-3 py-3">Lần gửi</th><th className="px-3 py-3">Thao tác</th></tr></thead>
            <tbody>
              {logs.map((log) => <tr key={log.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3 text-xs text-slate-600">{formatDate(log.createdAt)}</td>
                <td className="px-3 py-3 font-medium text-slate-800">{log.emailType}</td>
                <td className="px-3 py-3 font-mono text-xs text-slate-600">{log.order?.orderCode || "—"}</td>
                <td className="px-3 py-3 text-xs uppercase text-slate-600">{log.providerMode}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${log.status === "SENT" ? "bg-emerald-50 text-emerald-700" : log.status === "FAILED" ? "bg-rose-50 text-rose-700" : log.status === "SIMULATED" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}>{log.status}</span>{log.lastErrorCode && <div className="mt-1 text-[11px] text-rose-700">{log.lastErrorCode}</div>}</td>
                <td className="px-3 py-3 text-xs text-slate-600">{log.attemptCount}/{log.maxAttempts}</td>
                <td className="px-3 py-3">{log.status === "FAILED" && !["customer-email-verification", "password-reset"].includes(log.emailType) ? <button type="button" disabled={retryingId === log.id || Boolean(log.nextRetryAt && new Date(log.nextRetryAt).getTime() > Date.now())} onClick={() => void retry(log.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><RotateCw className={`h-3.5 w-3.5 ${retryingId === log.id ? "animate-spin" : ""}`} />Thử gửi lại</button> : <span className="text-xs text-slate-400">—</span>}</td>
              </tr>)}
              {!logs.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">Chưa có nhật ký email.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">Chế độ mock ghi “SIMULATED”, không gửi thư. SMTP chỉ hoạt động khi EMAIL_MODE=smtp được cấu hình rõ ràng.</p>
      </section>
    </section>
  );
}
