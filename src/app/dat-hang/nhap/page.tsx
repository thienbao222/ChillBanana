"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { validateBookmarkletPayload, ValidatedBookmarkletItem } from "@/features/purchasing/bookmarklet-validator";

export default function BookmarkletImportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<ValidatedBookmarkletItem | null>(null);
  const [weightKg, setWeightKg] = useState(0.5);

  useEffect(() => {
    try {
      const hash = window.location.hash;
      if (!hash || !hash.includes("data=")) {
        setError("Không tìm thấy dữ liệu sản phẩm trong liên kết.");
        setLoading(false);
        return;
      }

      const rawEncoded = hash.split("data=")[1];
      const decoded = decodeURIComponent(rawEncoded);
      const parsed = JSON.parse(decoded);

      const validation = validateBookmarkletPayload(parsed);
      if (!validation.isValid) {
        setError(validation.error);
        setLoading(false);
        return;
      }

      setItem(validation.data);
      setWeightKg(validation.data.weightKg || 0.5);
      setLoading(false);
    } catch (err: any) {
      setError("Dữ liệu gửi từ Bookmarklet bị lỗi định dạng hoặc không thể giải mã.");
      setLoading(false);
    }
  }, []);

  const handleAddToCart = () => {
    if (!item) return;

    try {
      const finalItem = {
        ...item,
        weightKg,
      };

      const existingCartStr = localStorage.getItem("chillbanana_cart") || "[]";
      let cart = [];
      try {
        cart = JSON.parse(existingCartStr);
        if (!Array.isArray(cart)) cart = [];
      } catch {
        cart = [];
      }

      cart.push({
        id: finalItem.id,
        name: finalItem.name,
        priceJpy: finalItem.priceJpy,
        weightKg: finalItem.weightKg,
        originalUrl: finalItem.originalUrl,
        imageUrl: finalItem.imageUrl,
        quantity: 1,
        quoteSource: "EXTENSION",
      });

      localStorage.setItem("chillbanana_cart", JSON.stringify(cart));
      alert("Đã thêm sản phẩm vào giỏ hàng thành công!");
      router.push("/dat-hang");
    } catch (err) {
      alert("Có lỗi xảy ra khi lưu vào giỏ hàng trình duyệt.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center text-stone-600">
        Đang xử lý và kiểm định an toàn dữ liệu từ Bookmarklet...
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center">
          <h2 className="text-lg font-bold mb-2">Không thể tiếp nhận sản phẩm</h2>
          <p className="text-sm mb-4">{error}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900"
          >
            Quay về trang chủ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <div className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold mb-4">
          Nguồn: Tiện ích Bookmarklet (EXTENSION)
        </div>

        <h1 className="text-2xl font-bold text-stone-900 mb-4">
          Xác Nhận Nhập Sản Phẩm Vào Giỏ Hàng
        </h1>

        <div className="flex gap-6 items-start border-b border-stone-100 pb-6 mb-6">
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-24 h-24 object-contain rounded-lg border border-stone-200 bg-stone-50"
            />
          )}
          <div className="flex-1">
            <h2 className="font-semibold text-stone-800 line-clamp-2 mb-2">{item.name}</h2>
            <p className="text-xs text-stone-500 break-all mb-2">{item.originalUrl}</p>
            <div className="text-xl font-bold text-amber-600">
              {item.priceJpy.toLocaleString()} ¥
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Trọng lượng ước tính (kg):
            </label>
            <input
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(Math.max(0.1, Number(e.target.value) || 0.5))}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg text-sm"
            />
            <p className="text-xs text-stone-500 mt-1">
              Cân nặng sẽ được cân đo chính xác khi kiện hàng về tới kho Tokyo.
            </p>
          </div>

          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>Lưu ý xác minh:</strong> Mọi thông tin giá cả và chi tiết sản phẩm nhập qua Bookmarklet chỉ mang tính gợi ý ban đầu. Đơn hàng sẽ được nhân viên chuyên trách của ChillBanana thẩm định và báo giá chính thức trước khi tiến hành thanh toán đặt cọc.
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleAddToCart}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold rounded-xl shadow text-center"
          >
            🍌 Thêm vào giỏ & Tiến hành đặt hàng
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-center"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

