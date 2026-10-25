"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  RefreshCw,
  ShoppingBag,
  Plus,
  Edit3,
  Trash2,
  Search,
  X,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Package,
} from "lucide-react";
import { CuratedProduct } from "@/types";
import { useAdminToast } from "@/context/AdminToastContext";
import { normalizeProductImageUrl, isGoogleDriveLink } from "@/lib/image-url";

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
    fulfillmentOrigin: "JP" as "JP" | "VN",
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isConvertedDriveLink, setIsConvertedDriveLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUrlChange = (inputVal: string) => {
    const isDrive = isGoogleDriveLink(inputVal);
    const normalized = normalizeProductImageUrl(inputVal);
    setIsConvertedDriveLink(isDrive && normalized !== inputVal);
    setImageLoadError(false);
    setProductForm((prev) => ({ ...prev, imageUrl: normalized }));
  };

  const handleImageFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      adminToast.error("Vui lòng chọn tệp hình ảnh (PNG, JPG, WebP)!");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      adminToast.error("Kích thước ảnh tối đa là 15MB!");
      return;
    }
    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        setIsUploadingImage(false);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 960;
        let w = img.width;
        let h = img.height;
        if (w > h && w > MAX_DIM) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else if (h > MAX_DIM) {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setIsUploadingImage(false);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/webp", 0.82) || canvas.toDataURL("image/jpeg", 0.82);
        setProductForm((prev) => ({ ...prev, imageUrl: compressed }));
        setImageLoadError(false);
        setIsConvertedDriveLink(false);
        setIsUploadingImage(false);
        adminToast.success("Đã tải và tối ưu ảnh sản phẩm thành công!");
      };
      img.onerror = () => {
        setIsUploadingImage(false);
        adminToast.error("Không thể xử lý hình ảnh này.");
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setIsUploadingImage(false);
      adminToast.error("Lỗi khi đọc file ảnh từ máy.");
    };
    reader.readAsDataURL(file);
  };

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
      fulfillmentOrigin: "JP",
    });
    setImageLoadError(false);
    setIsConvertedDriveLink(false);
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
      fulfillmentOrigin: (prod.fulfillmentOrigin === "VN" ? "VN" : "JP") as "JP" | "VN",
    });
    setImageLoadError(false);
    setIsConvertedDriveLink(false);
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
            <span>Kho Sản Phẩm &amp; Gom Order</span>
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
          {["all", "warehouse-vn", "cosmetics", "health", "gadgets", "anime"].map((cat) => (
            <button
              key={cat}
              onClick={() => setProductCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                productCategoryFilter === cat
                  ? cat === "warehouse-vn"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-navy-900 text-white shadow-sm"
                  : cat === "warehouse-vn"
                  ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat === "all" && `Tất Cả (${products.length})`}
              {cat === "warehouse-vn" && `🇻🇳 Sẵn Kho VN (${products.filter((p) => p.fulfillmentOrigin === "VN").length})`}
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
                  const matchCat =
                    productCategoryFilter === "all"
                      ? true
                      : productCategoryFilter === "warehouse-vn"
                      ? p.fulfillmentOrigin === "VN"
                      : p.category === productCategoryFilter;
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
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80";
                          }}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                        />
                        <div>
                          <div className="font-bold text-navy-900 line-clamp-1 max-w-xs">{prod.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {prod.fulfillmentOrigin === "VN" ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-300">
                                🇻🇳 Kho VN (0đ bay)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-medium px-1.5 py-0.5 rounded">
                                🇯🇵 Kho Tokyo
                              </span>
                            )}
                          </div>
                          {prod.voltageNote && (() => {
                            const n = prod.voltageNote.toLowerCase();
                            const icon =
                              n.includes("100v") || n.includes("điện") || n.includes("volt")
                                ? "⚡"
                                : n.includes("seal") || n.includes("hãng") || n.includes("bandai")
                                ? "🛡️"
                                : n.includes("vỡ") || n.includes("xốp")
                                ? "📦"
                                : "📌";
                            return (
                              <span className="text-[10px] text-slate-600 font-medium line-clamp-1 mt-0.5">
                                {icon} {prod.voltageNote}
                              </span>
                            );
                          })()}
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

      {/* MODAL: THÊM / SỬA SẢN PHẨM TRANG CHỦ */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8 max-h-[90vh] overflow-y-auto">
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
                  placeholder="Ví dụ: Mô Hình Gunpla RG 1/144 RX-78-2 Gundam Ver. 2.0 Bandai Spirits"
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
                      if (!voltageNote) {
                        if (cat === "gadgets") voltageNote = "Điện áp 100V - Cần dùng biến áp đổi nguồn";
                        else if (cat === "anime") voltageNote = "Hàng chính hãng Bandai Nhật, nguyên seal hộp";
                        else if (cat === "cosmetics") voltageNote = "Cam kết chính hãng mua trực tiếp Store Cosme Nhật Bản";
                        else if (cat === "health") voltageNote = "Hàng nội địa Nhật, đầy đủ tem mác & date mới nhất";
                      }
                      setProductForm({ ...productForm, category: cat, voltageNote });
                    }}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 bg-white"
                  >
                    <option value="cosmetics">🌸 Mỹ Phẩm &amp; Chăm Sóc Da</option>
                    <option value="health">🌿 Thực Phẩm Chức Năng</option>
                    <option value="gadgets">⚡ Gia Dụng &amp; Điện Tử Mini (100V)</option>
                    <option value="anime">🎎 Anime, Manga &amp; Sưu Tầm</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nguồn website mua hộ</label>
                  <input
                    type="text"
                    placeholder="Amazon JP, Bandai Hobby JP, Rakuten, Mercari..."
                    value={productForm.originalStore}
                    onChange={(e) => setProductForm({ ...productForm, originalStore: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                  />
                </div>
              </div>

              {/* Vị trí kho hàng xuất xứ & Cước bay */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <Package className="w-4 h-4 text-banana-600" />
                    <span>Kho hàng xuất xứ &amp; Cước bay quốc tế</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Chọn kho VN để tự động miễn cước bay (0đ)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Kho Tokyo Nhật Bản */}
                  <button
                    type="button"
                    onClick={() => setProductForm({ ...productForm, fulfillmentOrigin: "JP" })}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      productForm.fulfillmentOrigin === "JP"
                        ? "border-banana-500 bg-white ring-2 ring-banana-300 shadow-sm"
                        : "border-slate-200 bg-white/60 hover:bg-white hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 font-bold text-navy-950">
                        <span className="text-base">🇯🇵</span>
                        <span>Kho Tokyo (Mua hộ Nhật)</span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                          productForm.fulfillmentOrigin === "JP"
                            ? "border-banana-600 bg-banana-500 text-navy-950 font-bold"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {productForm.fulfillmentOrigin === "JP" ? "✓" : ""}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Bay quốc tế Tokyo → VN. Tự động tính cước bay theo cân nặng khi đặt hàng.
                    </p>
                    <div className="mt-2 inline-flex items-center text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md self-start border border-slate-200">
                      Tính cước bay theo cân nặng
                    </div>
                  </button>

                  {/* Có sẵn tại Kho Việt Nam */}
                  <button
                    type="button"
                    onClick={() => setProductForm({ ...productForm, fulfillmentOrigin: "VN" })}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      productForm.fulfillmentOrigin === "VN"
                        ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-300 shadow-sm"
                        : "border-slate-200 bg-white/60 hover:bg-white hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 font-bold text-emerald-950">
                        <span className="text-base">🇻🇳</span>
                        <span>Có sẵn tại Kho Việt Nam</span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                          productForm.fulfillmentOrigin === "VN"
                            ? "border-emerald-600 bg-emerald-500 text-white font-bold"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {productForm.fulfillmentOrigin === "VN" ? "✓" : ""}
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-900 mt-1 leading-relaxed font-medium">
                      Hàng có sẵn tại kho VN. Khách đặt được miễn cước bay quốc tế (0đ).
                    </p>
                    <div className="mt-2 inline-flex items-center text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md self-start border border-emerald-300">
                      ✨ 0đ cước bay quốc tế
                    </div>
                  </button>
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

              {/* Hình ảnh sản phẩm (Hỗ trợ URL, Google Drive CDN, Tải file máy tính) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">
                    Hình ảnh sản phẩm <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Tự chuyển link Google Drive hoặc tải file ảnh từ máy
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Dán link ảnh (hỗ trợ cả link chia sẻ Google Drive)..."
                        value={productForm.imageUrl}
                        onChange={(e) => handleImageUrlChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 text-xs"
                      />
                    </div>

                    {/* Nút tải ảnh trực tiếp từ máy tính */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFileUpload(file);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-navy-950 font-bold rounded-xl transition-all flex items-center space-x-1.5 shrink-0 text-xs border border-slate-200 disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5 text-banana-600" />
                      <span>{isUploadingImage ? "Đang xử lý..." : "Tải Ảnh Từ Máy"}</span>
                    </button>
                  </div>

                  {/* Thông báo chuyển đổi Google Drive */}
                  {isConvertedDriveLink && (
                    <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Đã tự động chuyển đổi link Google Drive sang định dạng ảnh CDN hiển thị trực tiếp.</span>
                    </div>
                  )}

                  {/* Thẻ Preview Ảnh */}
                  {productForm.imageUrl && (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-start space-x-3">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0">
                        <img
                          src={productForm.imageUrl}
                          alt="Preview sản phẩm"
                          className="w-full h-full object-cover"
                          onError={() => setImageLoadError(true)}
                          onLoad={() => setImageLoadError(false)}
                        />
                      </div>
                      <div className="flex-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700">Xem trước hình ảnh:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setProductForm((prev) => ({ ...prev, imageUrl: "" }));
                              setIsConvertedDriveLink(false);
                              setImageLoadError(false);
                            }}
                            className="text-[10px] text-rose-500 hover:text-rose-700 underline"
                          >
                            Xóa ảnh
                          </button>
                        </div>
                        {imageLoadError ? (
                          <div className="mt-1 p-2 bg-rose-50 rounded-lg border border-rose-200 text-rose-800 text-[11px] leading-relaxed">
                            <div className="flex items-center space-x-1 font-bold text-rose-700 mb-0.5">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>Ảnh chưa tải được</span>
                            </div>
                            Nếu dùng Google Drive, hãy đảm bảo link ở chế độ <strong>&quot;Bất kỳ ai có đường liên kết đều xem được&quot;</strong> (Public). Hoặc bấm nút <strong>&quot;Tải Ảnh Từ Máy&quot;</strong> để chọn file ảnh trực tiếp không lo lỗi mạng.
                          </div>
                        ) : (
                          <p className="text-[11px] text-emerald-700 mt-1 flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Hình ảnh hiển thị tốt và sẵn sàng xuất hiện trên trang chủ!</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Gợi ý ảnh mẫu */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold">Ảnh mẫu theo danh mục:</span>
                    {[
                      { label: "Gundam RX-78", url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80" },
                      { label: "Figure Anime", url: "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=600&q=80" },
                      { label: "Mỹ Phẩm Cosme", url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80" },
                      { label: "Tảo Xoắn / TP CN", url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80" },
                      { label: "Gia Dụng Zojirushi", url: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=600&q=80" },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setProductForm((prev) => ({ ...prev, imageUrl: preset.url }));
                          setImageLoadError(false);
                          setIsConvertedDriveLink(false);
                        }}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200 transition-all"
                      >
                        + {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lưu ý & Cảnh báo sản phẩm & Ghi chú nổi bật */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">
                      Lưu ý / Cảnh báo sản phẩm (Điện áp, Bảo quản, Đóng gói...)
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Điện áp 100V / Bọc xốp giữ hộp Seal / Hàng dễ vỡ..."
                    value={productForm.voltageNote}
                    onChange={(e) => setProductForm({ ...productForm, voltageNote: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 text-xs"
                  />
                  {/* Preset chips chọn nhanh */}
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {[
                      { label: "⚡ Điện 100V (Cần biến áp)", val: "Điện áp 100V - Cần dùng biến áp đổi nguồn" },
                      { label: "🔌 Đa điện áp 100V-240V", val: "Hỗ trợ điện áp toàn cầu 100V-240V (Cắm trực tiếp tại VN)" },
                      { label: "📦 Bọc xốp giữ hộp Seal", val: "Hàng nguyên seal hộp Bandai/Figure, bọc xốp nổ giữ seal" },
                      { label: "❄️ Bảo quản mát < 25°C", val: "Bảo quản nơi thoáng mát < 25°C, tránh nhiệt độ cao" },
                      { label: "⚠️ Hàng dễ vỡ / Thủy tinh", val: "Hàng dễ vỡ, ChillBanana gia cố bọc xốp nổ & chống sốc nhiều lớp" },
                      { label: "🌸 Hàng Cosme JP", val: "Cam kết chính hãng mua trực tiếp Store Cosme Nhật Bản" },
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setProductForm({ ...productForm, voltageNote: chip.val })}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                          productForm.voltageNote === chip.val
                            ? "bg-banana-100 text-banana-900 border-banana-300 font-bold"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                    {productForm.voltageNote && (
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, voltageNote: "" })}
                        className="text-[10px] text-rose-500 hover:text-rose-700 underline px-1"
                      >
                        Xóa lưu ý
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ghi chú nổi bật / Tag</label>
                  <input
                    type="text"
                    placeholder="Top 1 Cosme Nhật Bản, Săn sale 30%..."
                    value={productForm.featuredNote}
                    onChange={(e) => setProductForm({ ...productForm, featuredNote: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Ghi chú ngắn xuất hiện kèm icon ngôi sao (✨) trên card sản phẩm ngoài trang chủ.
                  </p>
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
