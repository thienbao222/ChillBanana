"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAdminToast } from "@/context/AdminToastContext";
import { PRICING_CONFIG_FIELDS, type PricingConfigValues } from "@/features/pricing/config";

type HistoryRow = PricingConfigValues & { id: string; effectiveFrom: string; createdBy: string; note: string | null; createdAt: string };

const LABELS: Record<keyof PricingConfigValues, { label: string; hint: string }> = {
  serviceFeeRate: { label: "Tỷ lệ phí mua hộ", hint: "0.04 = 4% trên tiền hàng" },
  minServiceFeeVnd: { label: "Phí mua hộ tối thiểu (đ)", hint: "Áp dụng khi 4% thấp hơn mức này" },
  airShippingPerKgVnd: { label: "Cước bay mỗi kg (đ)", hint: "Cước vận chuyển quốc tế" },
  groupBuyDiscountRate: { label: "Mức giảm cước gộp đơn", hint: "0.25 = giảm 25%" },
  groupBuyMaxWeightKg: { label: "Cân nặng tối đa để giảm cước gộp (kg)", hint: "Vượt mức này thì không giảm" },
  minOrderThresholdVnd: { label: "Giá trị đơn tối thiểu (đ)", hint: "Tiền hàng + phí mua hộ, chưa gồm vận chuyển" },
  reservationMinutes: { label: "Thời gian giữ hàng (phút)", hint: "Giữ tồn kho cho đơn chưa thanh toán" },
};

export default function PricingConfigTab() {
  const { adminToast } = useAdminToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [source, setSource] = useState<string>("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [note, setNote] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pricing-config");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const next: Record<string, string> = {};
      for (const field of PRICING_CONFIG_FIELDS) next[field] = String(data.active[field]);
      setForm(next);
      setSource(data.active.source === "database" ? "Đang dùng cấu hình trong database" : "Đang dùng giá trị mặc định trong code (chưa có bản ghi nào)");
      setHistory(data.history);
    } catch {
      adminToast.error("Không tải được cấu hình giá");
    }
  }, [adminToast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { note };
      for (const field of PRICING_CONFIG_FIELDS) body[field] = form[field];
      if (effectiveFrom) body.effectiveFrom = new Date(effectiveFrom).toISOString();
      const res = await fetch("/api/admin/pricing-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        adminToast.error([data.error, ...(data.details ?? [])].filter(Boolean).join(" "));
        return;
      }
      adminToast.success("Đã lưu cấu hình giá mới. Đơn tạo sau thời điểm hiệu lực sẽ dùng cấu hình này.");
      setNote("");
      setEffectiveFrom("");
      await load();
    } catch {
      adminToast.error("Lỗi lưu cấu hình giá");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900">Cấu hình giá</h2>
        <p className="mt-1 text-xs text-slate-500">
          {source}. Mỗi lần lưu tạo một phiên bản mới; đơn đã tạo giữ nguyên giá đã báo. Chỉ SUPER_ADMIN được lưu.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {PRICING_CONFIG_FIELDS.map((field) => (
            <label key={field} className="block text-sm">
              <span className="font-semibold text-slate-700">{LABELS[field].label}</span>
              <input
                inputMode="decimal"
                value={form[field] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <span className="text-xs text-slate-400">{LABELS[field].hint}</span>
            </label>
          ))}
          <label className="block text-sm">
            <span className="font-semibold text-slate-700">Hiệu lực từ (để trống = ngay bây giờ)</span>
            <input type="datetime-local" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-700">Ghi chú thay đổi</span>
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
        </div>
        <button onClick={save} disabled={saving} className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-amber-300 disabled:opacity-50">
          {saving ? "Đang lưu..." : "Lưu phiên bản mới"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Lịch sử thay đổi</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Chưa có thay đổi nào.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Hiệu lực từ</th><th className="pr-3">Phí</th><th className="pr-3">Cước/kg</th><th className="pr-3">Đơn tối thiểu</th><th className="pr-3">Người đổi</th><th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3">{new Date(row.effectiveFrom).toLocaleString("vi-VN")}</td>
                    <td className="pr-3">{(row.serviceFeeRate * 100).toFixed(1)}% (tối thiểu {row.minServiceFeeVnd.toLocaleString("vi-VN")} đ)</td>
                    <td className="pr-3">{row.airShippingPerKgVnd.toLocaleString("vi-VN")} đ</td>
                    <td className="pr-3">{row.minOrderThresholdVnd.toLocaleString("vi-VN")} đ</td>
                    <td className="pr-3">{row.createdBy}</td>
                    <td>{row.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
