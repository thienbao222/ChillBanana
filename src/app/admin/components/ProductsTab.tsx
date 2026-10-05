"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw, ShoppingBag, Plus, Edit3, Trash2, Search,
  AlertCircle, CheckCircle2, Tag, X, ExternalLink
} from "lucide-react";
import { CuratedProduct } from "@/types";
import { useAdminToast } from "@/context/AdminToastContext";

export default function ProductsTab() {
  const { adminToast } = useAdminToast();
  const [products, setProducts] = useState<CuratedProduct[]>([]);
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
      if (res.ok && data.products) setProducts(data.products);
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
      stockSlots: prod.stockSlots || 10, isHot: Boolean(prod.isHot),
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

          </div>
  );
}
