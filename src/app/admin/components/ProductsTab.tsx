"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  ShoppingBag,
  Plus,
  Edit3,
  Trash2,
  Search,
  X
} from "lucide-react";
import { CuratedProduct } from "@/types";
import { useAdminToast } from "@/context/AdminToastContext";

export default function ProductsTab() {
  const { adminToast } = useAdminToast();
  const [products, setProducts] = useState<CuratedProduct[]>([]);
  const [exchangeRate, setExchangeRate] = useState(172);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CuratedProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "cosmetics",
    priceJpy: 3000,
    weightKg: 0.4,
    imageUrl: "",
    description: "",
    originalStore: "Amazon JP",
    stockSlots: 10,
    isHot: false,
    featuredNote: "",
    voltageNote: "",
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (res.ok && data.products) {
        setProducts(data.products);
        if (Number.isFinite(data.exchangeRate) && data.exchangeRate > 0) setExchangeRate(data.exchangeRate);
      }
    } catch { adminToast.error("Lỗi tải sản phẩm"); }
    finally { setLoadingProducts(false); }
  };

  useEffect(() => {
    fetchProducts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: "", category: "cosmetics", priceJpy: 3500, weightKg: 0.4,
      imageUrl: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
      description: "Sản phẩm nội địa Nhật Bản chính hãng gom mua trực tiếp.",
      originalStore: "Amazon JP", stockSlots: 10, isHot: true,
      featuredNote: "Mặt hàng săn sale số lượng có hạn", voltageNote: "",
    });
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (prod: CuratedProduct) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name, category: prod.category, priceJpy: prod.priceJpy,
      weightKg: prod.weightKg, imageUrl: prod.imageUrl,
      description: prod.description || "", originalStore: prod.originalStore || "Amazon JP",
      stockSlots: prod.stockSlots ?? 10, isHot: Boolean(prod.isHot),
      featuredNote: prod.featuredNote || "", voltageNote: prod.voltageNote || "",
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.priceJpy) {
      adminToast.error("Vui lòng điền tên sản phẩm và giá Yên!");
      return;
    }
    setIsSavingProduct(true);
    try {
      if (editingProduct) {
        const res = await fetch("/api/products", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingProduct.id, ...productForm }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          adminToast.success("Cập nhật sản phẩm thành công!");
          setIsProductModalOpen(false);
          fetchProducts();
        } else {
          adminToast.error(data.error || "Lỗi cập nhật");
        }
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productForm),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          adminToast.success("Đã thêm sản phẩm mới thành công!");
          setIsProductModalOpen(false);
          fetchProducts();
        } else {
          adminToast.error(data.error || "Lỗi tạo sản phẩm");
        }
      }
    } catch { adminToast.error("Lỗi kết nối máy chủ"); }
    finally { setIsSavingProduct(false); }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${name}" khỏi trang chủ?`)) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success("Đã xóa sản phẩm!");
        fetchProducts();
      } else {
        adminToast.error(data.error || "Lỗi khi xóa");
      }
    } catch { adminToast.error("Lỗi kết nối"); }
  };

  return (
          <div className="space-y-6">
            
            {/* Header Banner */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-1.5 bg-banana-100 text-banana-800 text-xs font-bold px-3 py-1 rounded-full mb-2">
                  <ShoppingBag className="w-3.5 h-3.5 text-banana-600" />
                  <span>Kho Sản Phẩm & Gom Order</span>
                </div>
                <h2 className="text-2xl font-serif font-bold text-navy-900">
                  Quản Lý Sản Phẩm Nội Địa Nhật
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Thêm mới hoặc điều chỉnh danh sách sản phẩm hot hiển thị trên trang chủ để khách hàng chọn nhanh và tính bill tự động.
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <button
                  onClick={fetchProducts}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all"
                  title="Tải lại danh sách"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingProducts ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={openCreateProductModal}
                  className="px-4 py-2.5 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold text-xs rounded-2xl shadow-md transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Sản Phẩm Mới</span>
                </button>
              </div>
            </div>

            {/* Quick Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm sản phẩm theo tên..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto text-xs">
                {["all", "cosmetics", "health", "gadgets", "anime"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setProductCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      productCategoryFilter === cat
                        ? "bg-navy-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat === "all" && `Tất Cả (${products.length})`}
                    {cat === "cosmetics" && "Mỹ Phẩm"}
                    {cat === "health" && "Sức Khỏe"}
                    {cat === "gadgets" && "Gia Dụng 100V"}
                    {cat === "anime" && "Anime Figure"}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Sản Phẩm</th>
                      <th className="px-6 py-4">Danh Mục</th>
                      <th className="px-6 py-4">Nguồn Bán</th>
                      <th className="px-6 py-4">Giá Yên &amp; VNĐ</th>
                      <th className="px-6 py-4">Trọng Lượng</th>
                      <th className="px-6 py-4">Slot Còn</th>
                      <th className="px-6 py-4">Hot Deal</th>
                      <th className="px-6 py-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products
                      .filter((p) => {
                        const matchCat = productCategoryFilter === "all" || p.category === productCategoryFilter;
                        const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
                        return matchCat && matchSearch;
                      })
                      .map((prod) => (
                        <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                              />
                              <div>
                                <div className="font-bold text-navy-900 line-clamp-1 max-w-xs">{prod.name}</div>
                                {prod.voltageNote && (
                                  <span className="text-[10px] text-amber-700 font-medium">⚡ {prod.voltageNote}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                              {prod.categoryName || prod.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-600">
                            {prod.originalStore}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-navy-900 font-mono">{prod.priceJpy?.toLocaleString()} ¥</div>
                            <div className="text-[11px] text-banana-700 font-semibold">{prod.priceVnd?.toLocaleString("vi-VN")} đ</div>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-600 font-mono">
                            {prod.weightKg} kg
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                              {prod.stockSlots} slots
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {prod.isHot ? (
                              <span className="text-[10px] bg-banana-100 text-banana-900 font-extrabold px-2 py-0.5 rounded border border-banana-300">
                                🔥 HOT
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Thường</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => openEditProductModal(prod)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
                                title="Chỉnh sửa sản phẩm"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all"
                                title="Xóa sản phẩm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

      {/* MODAL 3: THÊM / SỬA SẢN PHẨM TRANG CHỦ */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8">
            <button
              onClick={() => setIsProductModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="mb-6">
              <span className="text-[10px] font-bold text-banana-900 bg-banana-100 px-3 py-1 rounded-full border border-banana-200">
                {editingProduct ? "Cập Nhật Sản Phẩm" : "Thêm Mới Sản Phẩm"}
              </span>
              <h3 className="text-xl font-serif font-bold text-navy-900 mt-2">
                {editingProduct ? `Chỉnh sửa: ${editingProduct.name}` : "Thêm Sản Phẩm Gom Mua Vào Trang Chủ"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sản phẩm sau khi lưu sẽ xuất hiện trực tiếp trong mục gợi ý săn deal trên trang chủ ChillBanana.
              </p>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              
              {/* Tên sản phẩm */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên sản phẩm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nồi Cơm Điện Cao Tần Zojirushi IH 1L"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                />
              </div>

              {/* Danh mục & Nguồn Store */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Danh mục</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      let voltageNote = productForm.voltageNote;
                      if (cat === "gadgets" && !voltageNote) {
                        voltageNote = "Điện áp 100V - Cần dùng biến áp đổi nguồn";
                      }
                      setProductForm({ ...productForm, category: cat, voltageNote });
                    }}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 bg-white"
                  >
                    <option value="cosmetics">🌸 Mỹ Phẩm & Chăm Sóc Da</option>
                    <option value="health">🌿 Thực Phẩm Chức Năng</option>
                    <option value="gadgets">⚡ Gia Dụng & Điện Tử Mini (100V)</option>
                    <option value="anime">🎎 Anime, Manga & Sưu Tầm</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nguồn website mua hộ</label>
                  <input
                    type="text"
                    placeholder="Amazon JP, Rakuten, Mercari..."
                    value={productForm.originalStore}
                    onChange={(e) => setProductForm({ ...productForm, originalStore: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                  />
                </div>
              </div>

              {/* Giá Yên & Cân Nặng & Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Giá gốc (JPY ¥) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={productForm.priceJpy}
                    onChange={(e) => setProductForm({ ...productForm, priceJpy: Number(e.target.value) })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 font-mono font-bold"
                  />
                  <span className="text-[11px] text-banana-700 font-semibold mt-1 block">
                    ≈ {Math.round(productForm.priceJpy * exchangeRate).toLocaleString("vi-VN")} đ
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trọng lượng (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={productForm.weightKg}
                    onChange={(e) => setProductForm({ ...productForm, weightKg: Number(e.target.value) })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số slot gom</label>
                  <input
                    type="number"
                    min={1}
                    value={productForm.stockSlots}
                    onChange={(e) => setProductForm({ ...productForm, stockSlots: Number(e.target.value) })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 font-mono"
                  />
                </div>
              </div>

              {/* URL Hình ảnh */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Đường dẫn hình ảnh (URL)</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={productForm.imageUrl}
                    onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                    className="flex-1 p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                  />
                  {productForm.imageUrl && (
                    <img
                      src={productForm.imageUrl}
                      alt="Preview"
                      className="w-11 h-11 object-cover rounded-xl border shrink-0"
                    />
                  )}
                </div>
              </div>

              {/* Ghi chú điện áp & Nổi bật */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cảnh báo điện áp (nếu có)
                  </label>
                  <input
                    type="text"
                    placeholder="Điện áp 100V - Cần dùng biến áp đổi nguồn"
                    value={productForm.voltageNote}
                    onChange={(e) => setProductForm({ ...productForm, voltageNote: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ghi chú nổi bật / Tag</label>
                  <input
                    type="text"
                    placeholder="Top 1 Cosme Nhật Bản, Săn sale 30%..."
                    value={productForm.featuredNote}
                    onChange={(e) => setProductForm({ ...productForm, featuredNote: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                  />
                </div>
              </div>

              {/* Hot Deal Checkbox */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isHot"
                  checked={productForm.isHot}
                  onChange={(e) => setProductForm({ ...productForm, isHot: e.target.checked })}
                  className="w-4 h-4 text-banana-600 rounded border-slate-300 focus:ring-banana-500"
                />
                <label htmlFor="isHot" className="font-bold text-navy-900 cursor-pointer">
                  Gắn nhãn 🔥 HOT DEAL trên trang chủ
                </label>
              </div>

              {/* Mô tả */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả ngắn</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả công dụng, tính năng hoặc lưu ý khi đặt hàng..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-6 py-2.5 bg-banana-500 hover:bg-banana-600 text-navy-950 rounded-xl font-bold transition-all shadow-md disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSavingProduct ? (
                    <span>Đang lưu sản phẩm...</span>
                  ) : (
                    <span>{editingProduct ? "Lưu Thay Đổi" : "Tạo Sản Phẩm"}</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

          </div>
  );
}
