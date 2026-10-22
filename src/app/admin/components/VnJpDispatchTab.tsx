"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  Search,
  Phone,
  CheckCircle,
  Clock,
  Plane,
  Truck,
  Box,
  MapPin,
  Calendar,
  AlertTriangle,
  X,
  FileText,
  ShieldCheck,
  Scale,
  ArrowRight,
  ChevronRight,
  Filter,
  Sparkles,
  Bot,
} from "lucide-react";
import { useAdminToast } from "@/context/AdminToastContext";

interface VnJpShipmentItem {
  id: string;
  trackingCode: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  senderCity: string;
  pickupDate: string | null;
  receiverName: string;
  receiverPhone: string;
  receiverPostalCode: string;
  receiverPrefecture: string;
  receiverAddress: string;
  cargoType: string;
  cargoDetails: string;
  estimatedWeightKg: number;
  actualWeightKg: number | null;
  dimensionLengthCm: number | null;
  dimensionWidthCm: number | null;
  dimensionHeightCm: number | null;
  chargeableWeightKg: number | null;
  unitPricePerKg: number;
  totalShippingFeeVnd: number;
  paymentStatus: string;
  maffAgreement: boolean;
  status: string;
  dispatcherNote: string | null;
  flightNumber: string | null;
  japanCourier: string | null;
  japanTrackingCode: string | null;
  createdAt: string;
  updatedAt: string;
}

const CARGO_LABELS: Record<string, string> = {
  gift: "Kiện quà / Đồ cá nhân",
  food: "Thực phẩm khô / Cà phê",
  doc: "Tài liệu / Du học (EMS)",
  other: "Hàng mẫu / Khác",
};

export default function VnJpDispatchTab() {
  const { adminToast } = useAdminToast();
  const [shipments, setShipments] = useState<VnJpShipmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPrefecture, setSelectedPrefecture] = useState("ALL");
  const [counts, setCounts] = useState<Record<string, number>>({
    PENDING_CONFIRMATION: 0,
    CONFIRMED_PICKUP: 0,
    WAREHOUSE_VN_INSPECTED: 0,
    IN_FLIGHT_TO_JP: 0,
    DELIVERED_JP: 0,
    CANCELLED: 0,
  });

  // Modal State
  const [selectedShipment, setSelectedShipment] = useState<VnJpShipmentItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showWeighModal, setShowWeighModal] = useState(false);
  const [showFlightModal, setShowFlightModal] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [generatingCn23, setGeneratingCn23] = useState(false);
  const [cn23Result, setCn23Result] = useState<any | null>(null);

  // Form Fields for Modal updates
  const [editNote, setEditNote] = useState("");
  const [editActWeight, setEditActWeight] = useState<number>(0);
  const [editLength, setEditLength] = useState<number>(0);
  const [editWidth, setEditWidth] = useState<number>(0);
  const [editHeight, setEditHeight] = useState<number>(0);
  const [editFlight, setEditFlight] = useState("VN310 (HAN ➔ NRT - Vietnam Airlines)");
  const [editCourier, setEditCourier] = useState("Yamato Transport (Kuroneko Takkyubin)");
  const [editJpTracking, setEditJpTracking] = useState("");
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedPrefecture && selectedPrefecture !== "ALL") params.append("prefecture", selectedPrefecture);
      const res = await fetch(`/api/vn-jp-shipments?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setShipments(data.shipments || []);
        if (data.counts) setCounts(data.counts);
        setTotalCount(typeof data.totalCount === "number" ? data.totalCount : (data.shipments || []).length);
      } else {
        adminToast.error("Lỗi tải danh sách vận đơn VN ➔ JP");
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [search, selectedPrefecture]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleGenerateCn23Ai = async () => {
    if (!selectedShipment) return;
    setGeneratingCn23(true);
    try {
      const res = await fetch("/api/ai/vn-jp-inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "ADMIN",
          cargoDetails: selectedShipment.cargoDetails,
          estimatedWeightKg: selectedShipment.actualWeightKg || selectedShipment.estimatedWeightKg,
          receiverName: selectedShipment.receiverName,
          receiverPostalCode: selectedShipment.receiverPostalCode,
          receiverPrefecture: selectedShipment.receiverPrefecture,
          senderCity: selectedShipment.senderCity,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.inspection) {
        setCn23Result(data.inspection);
        adminToast.success("AI đã tạo tờ khai CN23 & đề xuất điều phối chuyến bay!");
      } else {
        adminToast.error(data.error || "Không thể tạo tờ khai CN23 từ AI.");
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ AI");
    } finally {
      setGeneratingCn23(false);
    }
  };

  const handleApplyCn23ToShipment = () => {
    if (!cn23Result?.adminCustomsDeclaration) return;
    const decl = cn23Result.adminCustomsDeclaration;
    setEditFlight(decl.recommendedFlight);
    setEditCourier(decl.recommendedCourier);
    const appendedNote = `[CN23 EN]: ${decl.invoiceSummaryEn}\n[CN23 JP]: ${decl.invoiceSummaryJp}\n[Lộ trình]: ${decl.routingReasonVi}`;
    setEditNote((prev) => (prev ? `${prev}\n\n${appendedNote}` : appendedNote));
    adminToast.success("Đã áp dụng thông tin tờ khai CN23 & chuyến bay vào form!");
  };

  const updateShipmentStatus = async (id: string, payload: any) => {
    setSavingAction(true);
    try {
      const res = await fetch(`/api/vn-jp-shipments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success(data.message || "Cập nhật thành công!");
        setShowDetailModal(false);
        setShowWeighModal(false);
        setShowFlightModal(false);
        fetchShipments();
      } else {
        adminToast.error(data.error || "Lỗi cập nhật vận đơn.");
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setSavingAction(false);
    }
  };

  const filteredShipments = shipments.filter((s) => {
    if (selectedPrefecture !== "ALL" && s.receiverPrefecture !== selectedPrefecture) {
      return false;
    }
    return true;
  });

  const getByStatus = (st: string) => filteredShipments.filter((s) => s.status === st);

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-navy-950 text-white p-6 rounded-3xl shadow-md border border-emerald-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full mb-2 border border-emerald-500/30">
            <Plane className="w-3.5 h-3.5 text-emerald-400" />
            <span>Phân Hệ Vận Đơn Hàng Không Việt Nam ➔ Nhật Bản (Ký Gửi & Forwarding)</span>
          </div>
          <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
            <span>Bàn Điều Phối Vận Đơn VN ➔ JP</span>
            <span className="text-xs font-mono font-semibold bg-emerald-900/60 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
              Kanban 5 Chặng
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Tiếp nhận phiếu gửi hàng, rà soát kiểm dịch MAFF (thịt/đồ cấm), xếp lịch bưu tá lấy tận nhà, đo cân IATA tại kho VN và điều phối bưu tá Yamato/Sagawa phát tận tay tại Nhật.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchShipments}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow transition-all flex items-center space-x-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Tổng Vận Đơn</div>
          <div className="text-xl font-black text-navy-950 font-mono mt-1">{totalCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Tất cả các chặng</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>1. Mới Tiếp Nhận</span>
          </div>
          <div className="text-xl font-black text-amber-950 font-mono mt-1">{counts.PENDING_CONFIRMATION || 0}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Cần gọi điện xác minh</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 shadow-sm">
          <div className="text-[11px] font-bold text-blue-800 uppercase flex items-center gap-1">
            <Truck className="w-3 h-3 text-blue-600" />
            <span>2. Chờ Lấy Hàng</span>
          </div>
          <div className="text-xl font-black text-blue-950 font-mono mt-1">{counts.CONFIRMED_PICKUP || 0}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Bưu tá đang qua lấy</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 shadow-sm">
          <div className="text-[11px] font-bold text-purple-800 uppercase flex items-center gap-1">
            <Scale className="w-3 h-3 text-purple-600" />
            <span>3. Kho VN Cân Đo</span>
          </div>
          <div className="text-xl font-black text-purple-950 font-mono mt-1">{counts.WAREHOUSE_VN_INSPECTED || 0}</div>
          <div className="text-[10px] text-purple-700 mt-0.5">Soát MAFF & đo IATA</div>
        </div>
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 shadow-sm">
          <div className="text-[11px] font-bold text-rose-800 uppercase flex items-center gap-1">
            <Plane className="w-3 h-3 text-rose-600" />
            <span>4. Đang Bay Sang JP</span>
          </div>
          <div className="text-xl font-black text-rose-950 font-mono mt-1">{counts.IN_FLIGHT_TO_JP || 0}</div>
          <div className="text-[10px] text-rose-700 mt-0.5">Haneda / Narita / KIX</div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-800 uppercase flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>5. Đã Giao Thành Công</span>
          </div>
          <div className="text-xl font-black text-emerald-950 font-mono mt-1">{counts.DELIVERED_JP || 0}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Yamato phát tận tay</div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã VNJP, SĐT, Tên, Mã 〒..."
            className="w-full pl-9 pr-3.5 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-bold text-slate-600">Tỉnh/Thành Nhật:</span>
          <select
            value={selectedPrefecture}
            onChange={(e) => setSelectedPrefecture(e.target.value)}
            className="px-3 py-1.5 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Tất cả các tỉnh (Toàn Nhật Bản)</option>
            <option value="Tokyo">Tokyo (東京都)</option>
            <option value="Osaka">Osaka (大阪府)</option>
            <option value="Kanagawa">Kanagawa (神奈川県)</option>
            <option value="Aichi">Aichi (愛知県)</option>
            <option value="Saitama">Saitama (埼玉県)</option>
            <option value="Chiba">Chiba (千葉県)</option>
            <option value="Fukuoka">Fukuoka (福岡県)</option>
            <option value="Other">Tỉnh khác</option>
          </select>
        </div>
      </div>

      {/* KANBAN BOARD 5 CỘT CHUYÊN BIỆT */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
        {/* CỘT 1: MỚI TIẾP NHẬN */}
        <div className="bg-slate-100/90 rounded-2xl p-3 border border-slate-200 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200">
            <div className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>1. MỚI TIẾP NHẬN</span>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {getByStatus("PENDING_CONFIRMATION").length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto">
            {getByStatus("PENDING_CONFIRMATION").map((s) => (
              <div key={s.id} className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm hover:shadow transition space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    #{s.trackingCode}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(s.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div>
                  <div className="font-bold text-xs text-navy-950">{s.senderName}</div>
                  <a href={`tel:${s.senderPhone}`} className="text-[11px] text-emerald-700 font-semibold hover:underline flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    <span>{s.senderPhone}</span>
                  </a>
                  <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">📍 {s.senderAddress}</div>
                </div>

                <div className="bg-slate-50 p-2 rounded-lg text-[10px] text-slate-600 space-y-0.5 border border-slate-100">
                  <div>🇯🇵 Đến: <b>{s.receiverPrefecture}</b> (〒 {s.receiverPostalCode})</div>
                  <div>📦 <b>{s.estimatedWeightKg} kg</b> · {CARGO_LABELS[s.cargoType] || s.cargoType}</div>
                  <div className="text-emerald-700 font-bold font-mono text-[11px]">
                    {s.totalShippingFeeVnd.toLocaleString("vi-VN")} đ
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      setSelectedShipment(s);
                      setEditNote(s.dispatcherNote || "");
                      setCn23Result(null);
                      setShowDetailModal(true);
                    }}
                    className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-navy-950 font-bold text-[11px] rounded-lg transition text-center flex items-center justify-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Xác Minh & Hẹn Lấy</span>
                  </button>
                </div>
              </div>
            ))}
            {getByStatus("PENDING_CONFIRMATION").length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">Không có yêu cầu mới.</div>
            )}
          </div>
        </div>

        {/* CỘT 2: ĐÃ CHỐT & CHỜ LẤY HÀNG */}
        <div className="bg-slate-100/90 rounded-2xl p-3 border border-slate-200 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200">
            <div className="font-extrabold text-xs text-blue-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>2. CHỜ LẤY HÀNG VN</span>
            </div>
            <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              {getByStatus("CONFIRMED_PICKUP").length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto">
            {getByStatus("CONFIRMED_PICKUP").map((s) => (
              <div key={s.id} className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm hover:shadow transition space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    #{s.trackingCode}
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                    🛵 Bưu tá qua lấy
                  </span>
                </div>

                <div>
                  <div className="font-bold text-xs text-navy-950">{s.senderName}</div>
                  <div className="text-[11px] text-slate-600 font-medium">📞 {s.senderPhone}</div>
                  <div className="text-[10px] text-slate-500 mt-1">📍 <b>Điểm lấy:</b> {s.senderAddress}</div>
                  {s.pickupDate && (
                    <div className="text-[10px] text-amber-700 font-bold mt-0.5">🕒 Hẹn: {s.pickupDate}</div>
                  )}
                </div>

                {s.dispatcherNote && (
                  <div className="bg-amber-50 p-1.5 rounded text-[10px] text-amber-900 border border-amber-200">
                    📝 <i>{s.dispatcherNote}</i>
                  </div>
                )}

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => updateShipmentStatus(s.id, { status: "WAREHOUSE_VN_INSPECTED" })}
                    disabled={savingAction}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] rounded-lg transition text-center flex items-center justify-center gap-1"
                  >
                    <Box className="w-3 h-3" />
                    <span>Đã Nhận Về Kho VN</span>
                  </button>
                  <button
                    onClick={() => updateShipmentStatus(s.id, { action: "rollback" })}
                    disabled={savingAction}
                    className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200"
                    title="Lùi về chặng trước (Rollback)"
                  >
                    ↺
                  </button>
                  <button
                    onClick={() => {
                      setSelectedShipment(s);
                      setEditNote(s.dispatcherNote || "");
                      setCn23Result(null);
                      setShowDetailModal(true);
                    }}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg"
                    title="Xem chi tiết"
                  >
                    Xem
                  </button>
                </div>
              </div>
            ))}
            {getByStatus("CONFIRMED_PICKUP").length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">Chưa có đơn chờ lấy.</div>
            )}
          </div>
        </div>

        {/* CỘT 3: KHO VN CÂN ĐO IATA */}
        <div className="bg-slate-100/90 rounded-2xl p-3 border border-slate-200 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200">
            <div className="font-extrabold text-xs text-purple-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <span>3. KHO VN CÂN ĐO IATA</span>
            </div>
            <span className="text-xs font-mono font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
              {getByStatus("WAREHOUSE_VN_INSPECTED").length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto">
            {getByStatus("WAREHOUSE_VN_INSPECTED").map((s) => (
              <div key={s.id} className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-sm hover:shadow transition space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    #{s.trackingCode}
                  </span>
                  <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    🏬 Kho Nội Bài/TSN
                  </span>
                </div>

                <div>
                  <div className="font-bold text-xs text-navy-950">{s.senderName} ➔ {s.receiverName}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">📦 {s.cargoDetails}</div>
                </div>

                {/* Khối Cân Đo Thực Tế */}
                <div className="bg-purple-50/70 p-2 rounded-lg text-[10px] text-purple-950 border border-purple-200 space-y-1">
                  <div className="flex justify-between">
                    <span>Cân ước tính:</span>
                    <b>{s.estimatedWeightKg} kg</b>
                  </div>
                  {s.actualWeightKg ? (
                    <>
                      <div className="flex justify-between text-purple-900">
                        <span>Cân thực tế:</span>
                        <b>{s.actualWeightKg} kg</b>
                      </div>
                      {s.dimensionLengthCm && (
                        <div className="flex justify-between text-slate-600">
                          <span>Kích thước (cm):</span>
                          <span>{s.dimensionLengthCm}×{s.dimensionWidthCm}×{s.dimensionHeightCm}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-purple-200 pt-1 text-emerald-800 font-bold">
                        <span>Cân tính cước:</span>
                        <b>{s.chargeableWeightKg || s.actualWeightKg} kg</b>
                      </div>
                      <div className="text-right font-mono font-black text-xs text-purple-900">
                        {s.totalShippingFeeVnd.toLocaleString("vi-VN")} đ
                      </div>
                    </>
                  ) : (
                    <div className="text-amber-800 font-bold text-[10px]">⚠️ Chưa nhập kích thước & cân đo</div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      setSelectedShipment(s);
                      setEditActWeight(s.actualWeightKg || s.estimatedWeightKg);
                      setEditLength(s.dimensionLengthCm || 30);
                      setEditWidth(s.dimensionWidthCm || 20);
                      setEditHeight(s.dimensionHeightCm || 15);
                      setShowWeighModal(true);
                    }}
                    className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] rounded-lg transition text-center flex items-center justify-center gap-1"
                  >
                    <Scale className="w-3 h-3" />
                    <span>Cân Đo IATA</span>
                  </button>
                  <button
                    onClick={() => updateShipmentStatus(s.id, { action: "rollback" })}
                    disabled={savingAction}
                    className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200"
                    title="Lùi về chặng trước (Rollback)"
                  >
                    ↺
                  </button>
                  <button
                    onClick={() => {
                      setSelectedShipment(s);
                      setEditFlight("VN310 (HAN ➔ NRT - Vietnam Airlines)");
                      setEditCourier(s.japanCourier || "Yamato Transport (Kuroneko Takkyubin)");
                      setEditJpTracking(s.japanTrackingCode || "");
                      setShowFlightModal(true);
                    }}
                    disabled={savingAction || !s.actualWeightKg || s.actualWeightKg <= 0}
                    className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[11px] rounded-lg transition"
                    title={!s.actualWeightKg || s.actualWeightKg <= 0 ? "Cần cân đo IATA trước khi xuất bay" : "Xuất kho ra sân bay"}
                  >
                    Bay ➔
                  </button>
                </div>
              </div>
            ))}
            {getByStatus("WAREHOUSE_VN_INSPECTED").length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">Kho VN đang trống.</div>
            )}
          </div>
        </div>

        {/* CỘT 4: ĐANG BAY SANG NHẬT */}
        <div className="bg-slate-100/90 rounded-2xl p-3 border border-slate-200 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200">
            <div className="font-extrabold text-xs text-rose-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>4. ĐANG BAY SANG JP</span>
            </div>
            <span className="text-xs font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
              {getByStatus("IN_FLIGHT_TO_JP").length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto">
            {getByStatus("IN_FLIGHT_TO_JP").map((s) => (
              <div key={s.id} className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-sm hover:shadow transition space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    #{s.trackingCode}
                  </span>
                  <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                    <Plane className="w-3 h-3" />
                    <span>In Flight</span>
                  </span>
                </div>

                <div>
                  <div className="font-bold text-xs text-navy-950">Đến: {s.receiverPrefecture} (〒 {s.receiverPostalCode})</div>
                  <div className="text-[11px] text-slate-700 font-medium">Người nhận: <b>{s.receiverName}</b> ({s.receiverPhone})</div>
                </div>

                <div className="bg-rose-50/70 p-2 rounded-lg text-[10px] text-rose-950 border border-rose-200 space-y-1">
                  <div>✈️ Chuyến bay: <b>{s.flightNumber || "VN310 HAN-NRT"}</b></div>
                  <div>🚚 Hãng phát JP: <b>{s.japanCourier || "Yamato Transport"}</b></div>
                  {s.japanTrackingCode && (
                    <div className="font-mono text-blue-700">Mã bưu tá JP: #{s.japanTrackingCode}</div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => updateShipmentStatus(s.id, { status: "DELIVERED_JP" })}
                    disabled={savingAction}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition text-center flex items-center justify-center gap-1"
                  >
                    <CheckCircle className="w-3 h-3" />
                    <span>Báo Phát Thành Công</span>
                  </button>
                  <button
                    onClick={() => updateShipmentStatus(s.id, { action: "rollback" })}
                    disabled={savingAction}
                    className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200"
                    title="Lùi về chặng trước (Rollback)"
                  >
                    ↺
                  </button>
                  <button
                    onClick={() => {
                      setSelectedShipment(s);
                      setEditNote(s.dispatcherNote || "");
                      setCn23Result(null);
                      setShowDetailModal(true);
                    }}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg"
                  >
                    Xem
                  </button>
                </div>
              </div>
            ))}
            {getByStatus("IN_FLIGHT_TO_JP").length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">Không có kiện nào đang bay.</div>
            )}
          </div>
        </div>

        {/* CỘT 5: GIAO THÀNH CÔNG TẠI NHẬT */}
        <div className="bg-slate-100/90 rounded-2xl p-3 border border-slate-200 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200">
            <div className="font-extrabold text-xs text-emerald-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>5. GIAO THÀNH CÔNG</span>
            </div>
            <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              {getByStatus("DELIVERED_JP").length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto">
            {getByStatus("DELIVERED_JP").map((s) => (
              <div key={s.id} className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm space-y-2 opacity-95">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    #{s.trackingCode}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    ✅ Hoàn Tất
                  </span>
                </div>

                <div>
                  <div className="font-bold text-xs text-navy-950">{s.receiverName} (〒 {s.receiverPostalCode})</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">📍 {s.receiverAddress}</div>
                </div>

                <div className="bg-emerald-50/50 p-2 rounded-lg text-[10px] text-emerald-950 border border-emerald-100 space-y-0.5">
                  <div>📦 Cân tính cước: <b>{s.chargeableWeightKg || s.actualWeightKg || s.estimatedWeightKg} kg</b></div>
                  <div className="font-mono font-bold text-emerald-800">
                    Cước: {s.totalShippingFeeVnd.toLocaleString("vi-VN")} đ
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      setSelectedShipment(s);
                      setEditNote(s.dispatcherNote || "");
                      setCn23Result(null);
                      setShowDetailModal(true);
                    }}
                    className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition"
                  >
                    Xem Hồ Sơ Vận Đơn
                  </button>
                  <button
                    onClick={() => updateShipmentStatus(s.id, { action: "rollback" })}
                    disabled={savingAction}
                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200"
                    title="Lùi về chặng trước (Rollback)"
                  >
                    ↺ Lùi
                  </button>
                </div>
              </div>
            ))}
            {getByStatus("DELIVERED_JP").length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">Chưa có đơn hoàn tất.</div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CHI TIẾT VẬN ĐƠN & GHI CHÚ ĐIỀU PHỐI VIÊN */}
      {/* ========================================================================= */}
      {showDetailModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  AWB: #{selectedShipment.trackingCode}
                </span>
                <h3 className="font-bold text-base mt-1">Hồ Sơ Điều Phối Vận Đơn Tuyến VN ➔ JP</h3>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
              {/* KHỐI GỬI & NHẬN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>🇻🇳 Người Gửi Tại Việt Nam</span>
                  </div>
                  <div>Họ tên: <b>{selectedShipment.senderName}</b></div>
                  <div>SĐT: <a href={`tel:${selectedShipment.senderPhone}`} className="text-emerald-700 font-bold hover:underline">📞 {selectedShipment.senderPhone}</a></div>
                  <div>Điểm lấy hàng: <b>{selectedShipment.senderAddress}</b> ({selectedShipment.senderCity})</div>
                  {selectedShipment.pickupDate && (
                    <div className="text-amber-800 font-bold">🕒 Hẹn lấy: {selectedShipment.pickupDate}</div>
                  )}
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>🇯🇵 Người Nhận Tại Nhật Bản</span>
                  </div>
                  <div>Họ tên Romaji: <b className="font-mono text-navy-950 uppercase">{selectedShipment.receiverName}</b></div>
                  <div>SĐT nội địa Nhật: <b className="font-mono">{selectedShipment.receiverPhone}</b></div>
                  <div>Mã bưu điện: <b className="font-mono bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">〒 {selectedShipment.receiverPostalCode}</b></div>
                  <div>Địa chỉ chi tiết: <b>{selectedShipment.receiverPrefecture}</b> · {selectedShipment.receiverAddress}</div>
                </div>
              </div>

              {/* HÀNG HÓA & PHÁP LÝ MAFF */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900">📦 Chi Tiết Hàng Hóa & Cam Kết Kiểm Dịch MAFF</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Loại hàng: <b>{CARGO_LABELS[selectedShipment.cargoType] || selectedShipment.cargoType}</b></div>
                  <div>Cân nặng ước tính: <b>{selectedShipment.estimatedWeightKg} kg</b></div>
                </div>
                <div>Danh mục khai báo: <b className="text-navy-950">{selectedShipment.cargoDetails}</b></div>
                <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-emerald-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><b>Đã cam kết MAFF:</b> Khách hàng cam kết kiện hàng không chứa thịt, xúc xích, đồ cấm kiểm dịch Nhật Bản.</span>
                </div>
              </div>

              {/* KHỐI AI COPILOT: TỜ KHAI HẢI QUAN CN23 & GỢI Ý CHUYẾN BAY (ADMIN MODE) */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                    <span className="font-bold text-slate-900 text-xs">
                      Neo AI Customs & Flight Dispatch Copilot (Chế độ Quản trị)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateCn23Ai}
                    disabled={generatingCn23}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Bot className={`w-3.5 h-3.5 ${generatingCn23 ? "animate-spin" : ""}`} />
                    <span>{generatingCn23 ? "Đang phân tích..." : "🤖 AI Tạo Tờ Khai CN23 & Gợi Ý Chuyến Bay"}</span>
                  </button>
                </div>

                {cn23Result?.adminCustomsDeclaration && (
                  <div className="bg-white p-3 rounded-xl border border-indigo-200 space-y-2.5 text-slate-700 text-[11px]">
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                      <span className="font-bold text-indigo-950 flex items-center gap-1">
                        📄 Tờ Khai Hải Quan Quốc Tế CN23 / Invoice
                      </span>
                      <span className="font-mono text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                        {cn23Result.adminCustomsDeclaration.declaredCategory}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div>
                        <span className="text-slate-500 font-semibold block text-[10px]">Tên tiếng Anh & HS Code (English):</span>
                        <div className="font-mono text-slate-800 bg-slate-50 p-1.5 rounded border border-slate-100 font-medium">
                          {cn23Result.adminCustomsDeclaration.invoiceSummaryEn}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[10px]">Tên tiếng Nhật (Japanese):</span>
                        <div className="font-medium text-slate-800 bg-slate-50 p-1.5 rounded border border-slate-100">
                          {cn23Result.adminCustomsDeclaration.invoiceSummaryJp}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-lg border border-indigo-100 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">✈️ Chuyến bay đề xuất:</span>
                        <b className="text-indigo-900 font-mono">{cn23Result.adminCustomsDeclaration.recommendedFlight}</b>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">🚚 Đối tác giao phát JP:</span>
                        <b className="text-slate-900">{cn23Result.adminCustomsDeclaration.recommendedCourier}</b>
                      </div>
                      <div className="text-[10px] text-slate-500 italic mt-0.5 border-t border-slate-200/60 pt-1">
                        💡 {cn23Result.adminCustomsDeclaration.routingReasonVi}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyCn23ToShipment}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                    >
                      <span>⚡ Áp Dụng Ngay Vào Vận Đơn (Điền Flight, Hãng & Ghi Chú)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* GHI CHÚ ĐIỀU PHỐI VIÊN */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">📝 Ghi Chú Điều Phối Viên / Lịch Sử Gọi Điện:</label>
                <textarea
                  rows={2}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="VD: Đã gọi khách lúc 10h, xác nhận chỉ gửi 2 hộp bánh và áo ấm. Tài xế qua lấy sáng mai."
                  className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              {/* Nút Hoàn tác lùi bước (Rollback) & Xác nhận thu cước (PAID) */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {selectedShipment.status !== "PENDING_CONFIRMATION" &&
                    selectedShipment.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateShipmentStatus(selectedShipment.id, { action: "rollback" })
                        }
                        disabled={savingAction}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl border border-amber-300"
                      >
                        ↺ Lùi Bước (Rollback)
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() =>
                      updateShipmentStatus(selectedShipment.id, {
                        paymentStatus:
                          selectedShipment.paymentStatus === "PAID" ? "UNPAID" : "PAID",
                      })
                    }
                    disabled={savingAction}
                    className={`px-3 py-2 font-bold rounded-xl border ${
                      selectedShipment.paymentStatus === "PAID"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    {selectedShipment.paymentStatus === "PAID"
                      ? "✅ Đã Thu Cước (PAID)"
                      : "💳 Đánh Dấu Đã Thu Cước"}
                  </button>
                </div>
              </div>

              {/* CHUYỂN TRẠNG THÁI NHANH (P2-03: Chỉ cho phép chốt/hủy khi đang chờ xác nhận) */}
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                {selectedShipment.status === "PENDING_CONFIRMATION" && (
                  <button
                    type="button"
                    onClick={() => updateShipmentStatus(selectedShipment.id, { dispatcherNote: editNote, status: "CANCELLED" })}
                    disabled={savingAction}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200"
                  >
                    Hủy Vận Đơn
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  {selectedShipment.status === "PENDING_CONFIRMATION" && (
                    <button
                      type="button"
                      onClick={() => updateShipmentStatus(selectedShipment.id, { dispatcherNote: editNote, status: "CONFIRMED_PICKUP" })}
                      disabled={savingAction}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-navy-950 font-bold rounded-xl shadow-sm"
                    >
                      Chốt & Lên Lịch Lấy Hàng
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => updateShipmentStatus(selectedShipment.id, { dispatcherNote: editNote })}
                    disabled={savingAction}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl shadow-sm"
                  >
                    Lưu Ghi Chú
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: NHẬP KÍCH THƯỚC & CÂN ĐO THEO CHUẨN IATA TẠI KHO VN */}
      {/* ========================================================================= */}
      {showWeighModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Kho Hàng Không: Cân Đo Chuẩn IATA</h3>
                <span className="text-[11px] text-purple-200 font-mono">#{selectedShipment.trackingCode}</span>
              </div>
              <button onClick={() => setShowWeighModal(false)} className="text-purple-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Cân nặng thực tế cân tại kho (kg) *</label>
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  value={editActWeight}
                  onChange={(e) => setEditActWeight(Number(e.target.value))}
                  className="w-full p-2.5 border rounded-xl font-bold font-mono text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Kích thước 3 chiều thùng carton (cm) *</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Dài (cm)</span>
                    <input
                      type="number"
                      value={editLength}
                      onChange={(e) => setEditLength(Number(e.target.value))}
                      className="w-full p-2 border rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Rộng (cm)</span>
                    <input
                      type="number"
                      value={editWidth}
                      onChange={(e) => setEditWidth(Number(e.target.value))}
                      className="w-full p-2 border rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Cao (cm)</span>
                    <input
                      type="number"
                      value={editHeight}
                      onChange={(e) => setEditHeight(Number(e.target.value))}
                      className="w-full p-2 border rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Công thức tính tự động IATA */}
              {(() => {
                const volWeight = Number(((editLength * editWidth * editHeight) / 5000).toFixed(2));
                const finalWeight = Math.max(editActWeight, volWeight);
                const finalFee = Math.round(selectedShipment.unitPricePerKg * finalWeight);
                return (
                  <div className="bg-purple-50 border border-purple-200 p-3 rounded-2xl space-y-1 text-purple-950">
                    <div className="flex justify-between">
                      <span>Cân thể tích IATA (D×R×C/5000):</span>
                      <b>{volWeight} kg</b>
                    </div>
                    <div className="flex justify-between">
                      <span>Cân nặng thực tế:</span>
                      <b>{editActWeight} kg</b>
                    </div>
                    <div className="flex justify-between border-t border-purple-200 pt-1 text-emerald-800 font-bold">
                      <span>Cân tính cước (Lấy số lớn hơn):</span>
                      <b className="text-sm">{finalWeight} kg</b>
                    </div>
                    <div className="flex justify-between text-navy-950 font-bold pt-0.5">
                      <span>Tổng cước phí cuối cùng:</span>
                      <b className="text-sm text-purple-900 font-mono">{finalFee.toLocaleString("vi-VN")} đ</b>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWeighModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateShipmentStatus(selectedShipment.id, {
                      actualWeightKg: editActWeight,
                      dimensionLengthCm: editLength,
                      dimensionWidthCm: editWidth,
                      dimensionHeightCm: editHeight,
                    })
                  }
                  disabled={savingAction}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow"
                >
                  Lưu & Chốt Cước IATA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: XUẤT KHO LÊN CHUYẾN BAY QUỐC TẾ SANG NHẬT */}
      {/* ========================================================================= */}
      {showFlightModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-rose-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Xuất Kho Lên Chuyến Bay Quốc Tế</h3>
                <span className="text-[11px] text-rose-200 font-mono">#{selectedShipment.trackingCode}</span>
              </div>
              <button onClick={() => setShowFlightModal(false)} className="text-rose-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Số hiệu chuyến bay hàng không (Flight No.)</label>
                <select
                  value={editFlight}
                  onChange={(e) => setEditFlight(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold font-mono focus:ring-2 focus:ring-rose-500"
                >
                  <option value="VN310 (HAN ➔ NRT - Vietnam Airlines)">VN310 (HAN ➔ NRT - Vietnam Airlines)</option>
                  <option value="VN300 (SGN ➔ NRT - Vietnam Airlines)">VN300 (SGN ➔ NRT - Vietnam Airlines)</option>
                  <option value="JL752 (HAN ➔ NRT - Japan Airlines)">JL752 (HAN ➔ NRT - Japan Airlines)</option>
                  <option value="NH898 (HAN ➔ HND - All Nippon Airways)">NH898 (HAN ➔ HND - All Nippon Airways)</option>
                  <option value="VN330 (HAN ➔ KIX - Osaka Kansai)">VN330 (HAN ➔ KIX - Osaka Kansai)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Đơn vị giao phát chặng cuối tại Nhật (Carrier)</label>
                <select
                  value={editCourier}
                  onChange={(e) => setEditCourier(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Yamato Transport (Kuroneko Takkyubin)">Yamato Transport (Kuroneko Takkyubin)</option>
                  <option value="Sagawa Express">Sagawa Express</option>
                  <option value="Japan Post (Yu-Pack)">Japan Post (Yu-Pack)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Mã vận đơn bưu tá tại Nhật (Japan Tracking Code)</label>
                <input
                  type="text"
                  placeholder="VD: 4829-1029-3810"
                  value={editJpTracking}
                  onChange={(e) => setEditJpTracking(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl text-[11px] text-rose-900 leading-relaxed">
                ✈️ Kiện hàng sẽ được niêm phong túi khí hàng không, dán tem AWB và thông quan hải quan tại Sân bay Narita/Haneda trong vòng 4 - 6 giờ sau khi hạ cánh.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFlightModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateShipmentStatus(selectedShipment.id, {
                      flightNumber: editFlight,
                      japanCourier: editCourier,
                      japanTrackingCode: editJpTracking.trim() || undefined,
                      status: "IN_FLIGHT_TO_JP",
                    })
                  }
                  disabled={savingAction}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow"
                >
                  Xác Nhận Xuất Bay ✈️
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
