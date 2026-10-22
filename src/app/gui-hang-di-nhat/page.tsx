"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plane,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Package,
  Scale,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  FileText,
  HelpCircle,
  Copy,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  VnJpCargoType,
  VN_JP_RATES_VND_PER_KG,
  VN_JP_CARGO_LABELS,
  JAPAN_PREFECTURES,
  getVnJpRatePerKg,
  calculateIataChargeableWeight,
} from "@/features/pricing/vn-jp-rates";

export default function GuiHangDiNhatPage() {
  // Form fields: Người gửi tại Việt Nam
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [senderCity, setSenderCity] = useState("Hà Nội");
  const [pickupDate, setPickupDate] = useState("Sáng mai (8h00 - 12h00)");

  // Người nhận tại Nhật Bản
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverPostalCode, setReceiverPostalCode] = useState("");
  const [receiverPrefecture, setReceiverPrefecture] = useState("Tokyo");
  const [receiverAddress, setReceiverAddress] = useState("");

  // Thông tin kiện hàng
  const [cargoType, setCargoType] = useState<VnJpCargoType>("gift");
  const [cargoDetails, setCargoDetails] = useState("");
  const [actualWeightKg, setActualWeightKg] = useState<number>(2.5);
  const [lengthCm, setLengthCm] = useState<number>(30);
  const [widthCm, setWidthCm] = useState<number>(20);
  const [heightCm, setHeightCm] = useState<number>(15);
  const [useDimensions, setUseDimensions] = useState(false);

  // Điều khoản MAFF
  const [maffAgreement, setMaffAgreement] = useState(true);

  // Trạng thái gửi
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [inspectingAi, setInspectingAi] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<any | null>(null);

  const handleInspectMaffAi = async () => {
    if (!cargoDetails.trim()) {
      setErrorMsg("Vui lòng nhập mô tả chi tiết hàng hóa trước khi quét AI.");
      return;
    }
    setInspectingAi(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/ai/vn-jp-inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cargoDetails,
          estimatedWeightKg: actualWeightKg,
          receiverName,
          receiverPostalCode,
          receiverPrefecture,
          senderCity,
          mode: "CUSTOMER",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.inspection) {
        setInspectionResult(data.inspection);
      } else {
        setErrorMsg(data.error || "Không thể thực hiện quét kiểm dịch AI.");
      }
    } catch {
      setErrorMsg("Lỗi kết nối máy chủ AI kiểm dịch.");
    } finally {
      setInspectingAi(false);
    }
  };

  const handleApplyCleanedCargo = () => {
    if (!inspectionResult) return;
    if (inspectionResult.cleanedCargoDetails) {
      setCargoDetails(inspectionResult.cleanedCargoDetails);
    }
    if (inspectionResult.suggestedCargoType) {
      setCargoType(inspectionResult.suggestedCargoType);
    }
    if (inspectionResult.normalizedRomajiName) {
      setReceiverName(inspectionResult.normalizedRomajiName);
    }
    if (inspectionResult.recommendedBox) {
      setUseDimensions(true);
      setLengthCm(inspectionResult.recommendedBox.lengthCm);
      setWidthCm(inspectionResult.recommendedBox.widthCm);
      setHeightCm(inspectionResult.recommendedBox.heightCm);
    }
    setInspectionResult(null);
  };

    const [successShipment, setSuccessShipment] = useState<{
    trackingCode: string;
    totalFee: number;
    chargeableWeight: number;
  } | null>(null);

  // Tính toán cân nặng IATA và cước phí theo thời gian thực (Single Source of Truth)
  const unitRate = getVnJpRatePerKg(cargoType);
  const weightCalc = useMemo(() => {
    return calculateIataChargeableWeight({
      actualWeightKg,
      lengthCm: useDimensions ? lengthCm : null,
      widthCm: useDimensions ? widthCm : null,
      heightCm: useDimensions ? heightCm : null,
      unitPricePerKg: unitRate,
    });
  }, [actualWeightKg, useDimensions, lengthCm, widthCm, heightCm, unitRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!senderName.trim() || !senderPhone.trim() || !senderAddress.trim()) {
      setErrorMsg("Vui lòng điền đầy đủ họ tên, SĐT và địa chỉ người gửi tại Việt Nam.");
      return;
    }
    if (!receiverName.trim() || !receiverPhone.trim() || !receiverPostalCode.trim() || !receiverAddress.trim()) {
      setErrorMsg("Vui lòng điền đầy đủ thông tin người nhận tại Nhật Bản (gồm mã bưu điện 〒 7 số).");
      return;
    }
    if (!cargoDetails.trim()) {
      setErrorMsg("Vui lòng ghi rõ danh mục hàng hóa chi tiết (không ghi chung chung quà tặng).");
      return;
    }
    if (!maffAgreement) {
      setErrorMsg("Bắt buộc phải tích chọn cam kết không gửi thực phẩm cấm kiểm dịch MAFF sang Nhật Bản.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/vn-jp-shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: senderName.trim(),
          senderPhone: senderPhone.trim(),
          senderAddress: senderAddress.trim(),
          senderCity,
          pickupDate,
          receiverName: receiverName.trim().toUpperCase(),
          receiverPhone: receiverPhone.trim(),
          receiverPostalCode: receiverPostalCode.trim(),
          receiverPrefecture,
          receiverAddress: receiverAddress.trim(),
          cargoType,
          cargoDetails: cargoDetails.trim(),
          estimatedWeightKg: weightCalc.chargeableWeightKg,
          maffAgreement: Boolean(maffAgreement),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessShipment({
          trackingCode: data.trackingCode,
          totalFee: data.shipment?.totalShippingFeeVnd || weightCalc.totalShippingFeeVnd,
          chargeableWeight: data.shipment?.estimatedWeightKg || weightCalc.chargeableWeightKg,
        });
      } else {
        setErrorMsg(data.error || "Không thể tạo phiếu gửi hàng. Vui lòng kiểm tra lại thông tin.");
      }
    } catch {
      setErrorMsg("Lỗi kết nối máy chủ. Vui lòng thử lại sau giây lát.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <Link href="/" className="hover:text-emerald-600">Trang chủ</Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Gửi Hàng Đi Nhật (VN ➔ JP)</span>
          </div>
          <Link
            href="/tracking"
            className="inline-flex items-center space-x-1 text-emerald-700 font-bold hover:underline"
          >
            <span>Tra cứu vận đơn</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Hero Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-900/50">
          <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full mb-3 border border-emerald-500/30">
            <Plane className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chuyên Tuyến Hàng Không Việt Nam ➔ Nhật Bản</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Ký Gửi Vận Chuyển Hàng Sang Nhật Bản
          </h1>
          <p className="mt-2 text-slate-300 text-sm max-w-2xl leading-relaxed">
            Nhận tận nhà tại 63 tỉnh thành Việt Nam, bay thẳng chuyên tuyến Hà Nội / TP.HCM ➔ Tokyo Narita trong 48h - 72h. Kết nối bưu tá Yamato Kuroneko & Sagawa Express phát tận tay người nhận trên 47 tỉnh thành Nhật Bản.
          </p>

          {/* Biểu phí tóm tắt Single Source of Truth */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {(["gift", "food", "doc", "other"] as VnJpCargoType[]).map((type) => (
              <div
                key={type}
                className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 hover:border-emerald-400/50 transition cursor-pointer"
                onClick={() => setCargoType(type)}
              >
                <div className="text-[11px] text-slate-300 line-clamp-1">{VN_JP_CARGO_LABELS[type]}</div>
                <div className="text-base font-bold font-mono text-emerald-300 mt-0.5">
                  {VN_JP_RATES_VND_PER_KG[type].toLocaleString("vi-VN")} đ
                  <span className="text-[10px] text-slate-400 font-normal">/kg</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Thành công sau khi tạo đơn */}
        {successShipment && (
          <div className="bg-emerald-50 border-2 border-emerald-400 rounded-3xl p-6 sm:p-8 space-y-4 shadow-lg animate-fadeIn">
            <div className="flex items-center space-x-3 text-emerald-800">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-extrabold">Đã Tiếp Nhận Phiếu Ký Gửi Thành Công!</h2>
                <p className="text-xs text-emerald-700">Điều phối viên ChillBanana sẽ liên hệ số điện thoại người gửi để xác nhận giờ lấy hàng.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Mã vận đơn AWB:</span>
                <span className="font-mono font-black text-blue-700 text-sm">#{successShipment.trackingCode}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Trọng lượng tính cước IATA:</span>
                <span className="font-bold text-slate-800">{successShipment.chargeableWeight} kg</span>
              </div>
              <div>
                <span className="text-slate-500 block">Tổng cước dự kiến:</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">{successShipment.totalFee.toLocaleString("vi-VN")} đ</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={`/tracking?code=${encodeURIComponent(successShipment.trackingCode)}`}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition inline-flex items-center space-x-1.5"
              >
                <span>Theo dõi hành trình vận đơn</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(successShipment.trackingCode);
                  alert(`Đã sao chép mã vận đơn: ${successShipment.trackingCode}`);
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition inline-flex items-center space-x-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép mã đơn</span>
              </button>
              <button
                type="button"
                onClick={() => setSuccessShipment(null)}
                className="px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-semibold ml-auto"
              >
                Tạo thêm phiếu khác
              </button>
            </div>
          </div>
        )}

        {/* Cảnh báo kiểm dịch MAFF */}
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 flex items-start space-x-3 text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-extrabold text-sm text-rose-800">Quy Định Kiểm Dịch Nghiêm Ngặt Của Bộ Nông Nghiệp Nhật Bản (MAFF)</div>
            <p className="text-rose-700 leading-relaxed">
              Tuyệt đối <b>KHÔNG</b> gửi: Thịt gia súc, gia cầm tươi sống hoặc đã qua chế biến (chà bông, xúc xích, lạp xưởng, giò chả, khô bò, nem chua), các loại hạt giống có mầm, quả tươi chưa qua kiểm dịch. Vi phạm có thể bị hải quan Nhật Bản tiêu hủy và phạt đến 3.000.000 JPY.
            </p>
          </div>
        </div>

        {/* Form Đăng ký */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-8">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-semibold">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Phần 1: Người gửi tại Việt Nam */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold border-b pb-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs flex items-center justify-center font-bold">1</span>
              <h2 className="text-sm font-extrabold uppercase tracking-wide">Thông Tin Người Gửi (Việt Nam)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Họ và tên người gửi *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Đỗ Thiên Bảo"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Số điện thoại liên hệ *</label>
                <input
                  type="tel"
                  required
                  placeholder="VD: 0912345678"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Địa chỉ lấy hàng tận nơi *</label>
                <input
                  type="text"
                  required
                  placeholder="Số nhà, ngõ/hẻm, tên đường, phường/xã, quận/huyện"
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tỉnh / Thành phố *</label>
                <select
                  value={senderCity}
                  onChange={(e) => setSenderCity(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white font-medium"
                >
                  <option value="Hà Nội">Hà Nội</option>
                  <option value="Hồ Chí Minh">TP. Hồ Chí Minh</option>
                  <option value="Bình Dương">Bình Dương</option>
                  <option value="Đà Nẵng">Đà Nẵng</option>
                  <option value="Hải Phòng">Hải Phòng</option>
                  <option value="Cần Thơ">Cần Thơ</option>
                  <option value="Đồng Nai">Đồng Nai</option>
                  <option value="Khác">Tỉnh thành khác</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Khung giờ bưu tá đến lấy</label>
                <select
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white font-medium"
                >
                  <option value="Sáng mai (8h00 - 12h00)">Sáng mai (8h00 - 12h00)</option>
                  <option value="Chiều mai (13h30 - 17h30)">Chiều mai (13h30 - 17h30)</option>
                  <option value="Trong ngày hôm nay (Gấp)">Trong ngày hôm nay (Hỏa tốc)</option>
                  <option value="Hẹn ngày khác">Hẹn ngày khác (sẽ gọi điện chốt)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Phần 2: Người nhận tại Nhật Bản */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-blue-900 font-bold border-b pb-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs flex items-center justify-center font-bold">2</span>
              <h2 className="text-sm font-extrabold uppercase tracking-wide">Thông Tin Người Nhận (Nhật Bản 🇯🇵)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Họ tên người nhận (Romaji/Katakana) *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: NGUYEN VAN AN hoặc ヤマダ タロウ"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">SĐT tại Nhật Bản *</label>
                <input
                  type="tel"
                  required
                  placeholder="VD: 08012345678 hoặc 090..."
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mã bưu điện Nhật Bản (〒 7 số) *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: 160-0022"
                  value={receiverPostalCode}
                  onChange={(e) => setReceiverPostalCode(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tỉnh / Thành phố Nhật Bản *</label>
                <select
                  value={receiverPrefecture}
                  onChange={(e) => setReceiverPrefecture(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white font-medium"
                >
                  {JAPAN_PREFECTURES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Địa chỉ chi tiết tại Nhật (Quận, tên tòa nhà, số phòng) *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Shinjuku-ku, Shinjuku 3-Chome 1-1, Mansion 402"
                  value={receiverAddress}
                  onChange={(e) => setReceiverAddress(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Phần 3: Kiện hàng & Cân đo IATA */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-purple-900 font-bold border-b pb-2">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 text-xs flex items-center justify-center font-bold">3</span>
              <h2 className="text-sm font-extrabold uppercase tracking-wide">Quy Cách Kiện Hàng & Tính Cước IATA</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Loại danh mục hàng hóa *</label>
                <select
                  value={cargoType}
                  onChange={(e) => setCargoType(e.target.value as VnJpCargoType)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white font-bold text-purple-900"
                >
                  <option value="gift">Kiện quà biếu / Quần áo / Đồ cá nhân (180.000 đ/kg)</option>
                  <option value="food">Thực phẩm khô / Cà phê (220.000 đ/kg - Hỗ trợ nhãn MAFF)</option>
                  <option value="doc">Tài liệu / Hồ sơ du học EMS (210.000 đ/kg)</option>
                  <option value="other">Hàng mẫu kinh doanh / Khác (200.000 đ/kg)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cân nặng thực tế ước tính (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="500"
                  required
                  value={actualWeightKg}
                  onChange={(e) => setActualWeightKg(Math.max(0.1, Number(e.target.value)))}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white font-mono font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Mô tả chi tiết đồ bên trong kiện *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="VD: 3 áo len mùa đông, 2 gói trà ô long hút chân không, 1 cuốn sổ tay..."
                  value={cargoDetails}
                  onChange={(e) => setCargoDetails(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white"
                />

                {/* NÚT KÍCH HOẠT NEO AI QUÉT KIỂM DỊCH */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleInspectMaffAi}
                    disabled={inspectingAi || !cargoDetails.trim()}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>{inspectingAi ? "✨ Neo AI Đang Quét..." : "✨ Neo AI Quét Kiểm Dịch MAFF & Chuẩn Hóa Địa Chỉ"}</span>
                  </button>
                  <span className="text-[11px] text-slate-500">Phát hiện món cấm, đối chiếu mã 〒 & chuẩn hóa Romaji</span>
                </div>

                {/* THẺ KẾT QUẢ NEO UNIVERSE AI */}
                {inspectionResult && (
                  <div className="mt-4 p-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50/90 via-indigo-50/50 to-slate-50 space-y-3.5 text-xs animate-fadeIn shadow-sm">
                    {/* Header: Lời bình Neo Universe */}
                    <div className="flex items-start space-x-2.5">
                      <span className="text-xl">🛸</span>
                      <div className="flex-1">
                        <div className="font-extrabold text-purple-950 flex items-center gap-1.5">
                          <span>Neo Universe AI Kiểm Dịch & Bưu Chính</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inspectionResult.overallRisk === "PROHIBITED"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : inspectionResult.overallRisk === "CONDITIONAL"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          }`}>
                            {inspectionResult.overallRisk === "PROHIBITED" ? "🔴 CÓ MÓN CẤM" : inspectionResult.overallRisk === "CONDITIONAL" ? "🟡 CẦN HÚT CHÂN KHÔNG" : "🟢 100% HỢP LỆ BAY"}
                          </span>
                        </div>
                        <p className="text-slate-700 italic mt-0.5 leading-relaxed font-serif">
                          &ldquo;{inspectionResult.neoKuudereComment}&rdquo;
                        </p>
                      </div>
                    </div>

                    {/* Danh sách từng món phân tích */}
                    <div className="space-y-1.5 pt-1 border-t border-purple-200/60">
                      <div className="font-bold text-slate-800 text-[11px]">Chi tiết phân tích từng món hàng:</div>
                      <div className="grid grid-cols-1 gap-2">
                        {inspectionResult.items.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 ${
                              item.status === "PROHIBITED"
                                ? "bg-rose-50 border-rose-200 text-rose-950"
                                : item.status === "CONDITIONAL"
                                ? "bg-amber-50 border-amber-200 text-amber-950"
                                : "bg-emerald-50 border-emerald-200 text-emerald-950"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="font-bold flex items-center gap-1.5">
                                <span>{item.status === "PROHIBITED" ? "🔴" : item.status === "CONDITIONAL" ? "🟡" : "🟢"}</span>
                                <b>{item.rawText}</b>
                                <span className="text-[10px] font-mono text-slate-500">[{item.englishCustomsName}]</span>
                              </div>
                              <div className="text-[11px] text-slate-600">{item.reasonVi}</div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border self-start sm:self-center">
                              {item.status === "PROHIBITED" ? "CẤM BAY" : item.status === "CONDITIONAL" ? "ĐIỀU KIỆN" : "AN TOÀN"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Kiểm tra đối chiếu mã bưu điện 〒 */}
                    {!inspectionResult.postalPrefectureMatch.isValid && (
                      <div className="p-2.5 bg-amber-100/80 border border-amber-300 rounded-xl text-amber-900 font-semibold text-[11px] flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-700" />
                        <span>{inspectionResult.postalPrefectureMatch.expectedRegionNote}</span>
                      </div>
                    )}

                    {/* Gợi ý thùng Carton IATA & Tên Romaji */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white/70 p-2.5 rounded-xl border border-purple-200">
                      <div>
                        <span className="text-slate-500">Gợi ý thùng IATA: </span>
                        <b className="text-purple-900">{inspectionResult.recommendedBox.boxCode}</b> ({inspectionResult.recommendedBox.lengthCm}×{inspectionResult.recommendedBox.widthCm}×{inspectionResult.recommendedBox.heightCm} cm)
                      </div>
                      <div>
                        <span className="text-slate-500">Tên người nhận chuẩn Romaji: </span>
                        <b className="text-blue-900 font-mono">{inspectionResult.normalizedRomajiName || receiverName || "(Chưa nhập)"}</b>
                      </div>
                    </div>

                    {/* Nút hành động 1-click */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-200/60">
                      <button
                        type="button"
                        onClick={handleApplyCleanedCargo}
                        className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-extrabold rounded-xl text-xs shadow transition inline-flex items-center space-x-1.5"
                      >
                        <span>🧹 Tự động loại bỏ món cấm & Chuẩn hóa Romaji (1-Click)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectionResult(null)}
                        className="text-slate-500 hover:text-slate-700 text-xs font-semibold px-2"
                      >
                        Đóng thẻ kết quả
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tùy chọn cân thể tích IATA */}
              <div className="sm:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useDimensions}
                      onChange={(e) => setUseDimensions(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="font-bold text-slate-800">Kiện hàng cồng kềnh (Nhập kích thước Dài × Rộng × Cao cm)</span>
                  </label>
                  <span className="text-[11px] text-slate-500">Quy đổi IATA: (D×R×C)/5000</span>
                </div>

                {useDimensions && (
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div>
                      <span className="text-[11px] text-slate-500">Dài (cm):</span>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={lengthCm}
                        onChange={(e) => setLengthCm(Number(e.target.value))}
                        className="w-full p-2 border rounded-lg bg-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Rộng (cm):</span>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={widthCm}
                        onChange={(e) => setWidthCm(Number(e.target.value))}
                        className="w-full p-2 border rounded-lg bg-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Cao (cm):</span>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={heightCm}
                        onChange={(e) => setHeightCm(Number(e.target.value))}
                        className="w-full p-2 border rounded-lg bg-white font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Kết quả tính cân IATA trực quan */}
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Cân thực tế: <b>{weightCalc.actualWeightKg} kg</b></span>
                    {useDimensions && (
                      <span className="ml-3 text-purple-700">Cân thể tích IATA: <b>{weightCalc.volumetricWeightKg} kg</b></span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-600">Cân tính cước áp dụng: </span>
                    <span className="font-extrabold text-sm text-purple-900 bg-purple-100 px-2.5 py-0.5 rounded-lg font-mono">
                      {weightCalc.chargeableWeightKg} kg
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cam kết MAFF bắt buộc */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={maffAgreement}
                onChange={(e) => setMaffAgreement(e.target.checked)}
                className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span className="text-xs text-amber-950 leading-relaxed font-semibold">
                Tôi cam kết kiện hàng không chứa bất kỳ sản phẩm từ thịt, trứng, xúc xích hoặc các vật phẩm thuộc danh mục cấm nhập khẩu của Bộ Nông Nghiệp Nhật Bản (MAFF). Nếu sai phạm, tôi hoàn toàn chịu trách nhiệm theo quy định hải quan.
              </span>
            </label>
          </div>

          {/* Tổng tiền & Nút Submit */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">Tổng cước vận chuyển dự kiến (Bao gồm bưu tá Nhật phát tận tay):</div>
              <div className="text-2xl font-black font-mono text-emerald-700">
                {weightCalc.totalShippingFeeVnd.toLocaleString("vi-VN")} đ
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 text-sm"
            >
              {loading ? (
                <span>Đang xử lý tạo vận đơn...</span>
              ) : (
                <>
                  <span>Xác Nhận Gửi Hàng Đi Nhật</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
