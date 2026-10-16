"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Zap,
  ShoppingBag,
  ShoppingCart
} from "lucide-react";
import { CuratedProduct } from "@/types";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { DEFAULT_EXCHANGE_RATE } from "@/features/pricing/calculator";

type CuratedProductsProps = {
  quoteSectionId?: string;
  quoteHref?: string;
};

export default function CuratedProducts({
  quoteSectionId = "calculator",
  quoteHref = "#calculator",
}: CuratedProductsProps) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [products, setProducts] = useState<CuratedProduct[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.products)) {
        throw new Error(data.error || "Không thể tải danh sách sản phẩm.");
      }
      setProducts(data.products);
      if (Number.isFinite(data.exchangeRate) && data.exchangeRate > 0) {
        setExchangeRate(data.exchangeRate);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const handleGalaxyCategory = (event: Event) => {
      const category = (event as CustomEvent<{ category?: string }>).detail?.category;
      if (category === "all" || ["cosmetics", "health", "gadgets", "anime"].includes(category ?? "")) {
        setSelectedCategory(category ?? "all");
      }
    };

    window.addEventListener("chillbanana:filter_products", handleGalaxyCategory);
    return () => window.removeEventListener("chillbanana:filter_products", handleGalaxyCategory);
  }, []);

  const filteredProducts = selectedCategory === "all"
    ? products
    : products.filter((p) => p.category === selectedCategory);

  const handleOrderThis = (product: CuratedProduct) => {
    window.dispatchEvent(
      new CustomEvent("chillbanana:select_product", {
        detail: {
          id: product.id,
          name: product.name,
          priceJpy: product.priceJpy,
          weightKg: product.weightKg,
          imageUrl: product.imageUrl,
          originalStore: product.originalStore,
          category: product.category,
        },
      })
    );

    const calcSection = document.getElementById(quoteSectionId);
    if (calcSection) {
      calcSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleAddToCart = (product: CuratedProduct) => {
    if (product.stockSlots < 1) return;
    const added = addToCart({
      id: product.id,
      name: product.name,
      priceJpy: product.priceJpy,
      priceVnd: product.priceVnd || Math.round(product.priceJpy * exchangeRate),
      weightKg: product.weightKg,
      imageUrl: product.imageUrl,
      originalStore: product.originalStore,
      category: product.category,
      stockSlots: product.stockSlots,
    });
    if (added) toast.success("Đã thêm sản phẩm vào giỏ hàng.");
  };

  return (
    <section id="products" className="py-12 px-4 sm:px-6 lg:px-8 max-w-[1600px] w-[95%] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-banana-800 bg-banana-100 px-3 py-1 rounded-full uppercase tracking-wider mb-2 border border-banana-200">
            <Sparkles className="w-3.5 h-3.5 text-banana-600" />
            <span>Sản phẩm có sẵn tại kho</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-navy-900">
            Sản Phẩm Có Sẵn Tại Kho ChillBanana
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Sản phẩm được cập nhật theo tồn kho hiện tại. Thời gian giao dự kiến sẽ được xác nhận theo địa chỉ nhận hàng và phương thức vận chuyển.
          </p>
        </motion.div>

        {/* Filter buttons */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-4 md:mt-0 flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-2xl"
        >
          <button
            onClick={() => setSelectedCategory("all")}
            aria-pressed={selectedCategory === "all"}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedCategory === "all"
                ? "bg-navy-900 text-white shadow-sm"
                : "text-slate-600 hover:text-navy-900 hover:bg-slate-200/50"
            }`}
          >
            Tất Cả ({products.length})
          </button>
          <button
            onClick={() => setSelectedCategory("cosmetics")}
            aria-pressed={selectedCategory === "cosmetics"}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedCategory === "cosmetics"
                ? "bg-white text-pink-600 shadow-sm"
                : "text-slate-600 hover:text-pink-600 hover:bg-slate-200/50"
            }`}
          >
            🌸 Mỹ Phẩm
          </button>
          <button
            onClick={() => setSelectedCategory("health")}
            aria-pressed={selectedCategory === "health"}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedCategory === "health"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-600 hover:text-emerald-600 hover:bg-slate-200/50"
            }`}
          >
            🌿 Sức Khỏe
          </button>
          <button
            onClick={() => setSelectedCategory("gadgets")}
            aria-pressed={selectedCategory === "gadgets"}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedCategory === "gadgets"
                ? "bg-white text-banana-700 shadow-sm"
                : "text-slate-600 hover:text-banana-700 hover:bg-slate-200/50"
            }`}
          >
            ⚡ Gia Dụng 100V
          </button>
          <button
            onClick={() => setSelectedCategory("anime")}
            aria-pressed={selectedCategory === "anime"}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedCategory === "anime"
                ? "bg-white text-purple-600 shadow-sm"
                : "text-slate-600 hover:text-purple-600 hover:bg-slate-200/50"
            }`}
          >
            🎎 Anime Figure
          </button>
        </motion.div>
      </div>

      {/* Product Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" aria-label="Đang tải sản phẩm">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-80 rounded-3xl border border-slate-200 bg-white p-4 animate-pulse">
              <div className="h-40 rounded-2xl bg-slate-100" />
              <div className="mt-5 h-3 w-1/3 rounded bg-slate-100" />
              <div className="mt-3 h-4 w-4/5 rounded bg-slate-100" />
              <div className="mt-8 h-8 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-10 text-center" role="alert">
          <p className="font-bold text-rose-900">Chưa tải được danh sách sản phẩm.</p>
          <p className="mt-1 text-sm text-rose-700">Vui lòng thử lại sau ít phút.</p>
          <button onClick={() => void fetchProducts()} className="mt-4 rounded-xl bg-navy-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
            Thử tải lại
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="font-bold text-navy-900">{products.length === 0 ? "Hiện chưa có sản phẩm được đăng bán." : "Chưa có sản phẩm trong danh mục này."}</p>
          <p className="mt-1 text-sm text-slate-500">Bạn có thể dùng công cụ báo giá để gửi link sản phẩm cần mua hộ.</p>
          <a href={quoteHref} className="mt-4 inline-flex rounded-xl bg-navy-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800">
            Gửi link sản phẩm cần mua
          </a>
        </div>
      ) : (
      <motion.div 
        layout 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <AnimatePresence>
          {filteredProducts.map((product, idx) => {
            const inStock = product.stockSlots > 0;
            return (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              key={product.id}
              className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              {/* Image container */}
              <div className="relative h-48 sm:h-52 w-full bg-slate-100 overflow-hidden">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Badges */}
                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                  {product.isHot && (
                    <span className="bg-banana-500 text-navy-950 text-[10px] font-extrabold px-2 py-0.5 rounded-lg shadow-sm">
                      🔥 HOT DEAL
                    </span>
                  )}
                  <span className={`${inStock ? "bg-emerald-700/90" : "bg-slate-600/90"} backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-lg`}>
                    {inStock ? "⚡ Sẵn Hàng" : "Tạm hết hàng"}
                  </span>
                </div>

                {/* Số lượng còn lại */}
                <div className="absolute bottom-2.5 right-2.5 bg-navy-950/85 backdrop-blur-sm text-banana-300 text-[11px] font-bold px-2 py-0.5 rounded-lg">
                  {inStock ? `Còn ${product.stockSlots}` : "Hết hàng"}
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {product.categoryName}
                  </span>
                  <h3 className="text-sm font-bold text-navy-900 line-clamp-2 mt-1 group-hover:text-banana-600 transition-colors">
                    {product.name}
                  </h3>
                  
                  {/* Ghi chú điện áp */}
                  {product.voltageNote && (
                    <div className="mt-2 text-[11px] text-banana-900 bg-banana-50 p-2 rounded-xl border border-banana-200 flex items-center">
                      <Zap className="w-3 h-3 text-banana-600 mr-1 shrink-0" />
                      <span className="line-clamp-1">{product.voltageNote}</span>
                    </div>
                  )}
                  
                  {product.featuredNote && !product.voltageNote && (
                    <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border line-clamp-1">
                      ✨ {product.featuredNote}
                    </div>
                  )}
                </div>

                {/* Price & Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Giá tham khảo tại Nhật: {product.priceJpy.toLocaleString()} ¥
                    </p>
                    <p className="text-base font-bold text-banana-700 font-serif">
                      {(product.priceVnd || Math.round(product.priceJpy * exchangeRate)).toLocaleString("vi-VN")} <span className="text-xs">đ</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={!inStock}
                      className="p-2.5 rounded-xl bg-banana-50 hover:bg-banana-500 text-banana-800 hover:text-navy-950 border border-banana-200 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-banana-50"
                      title={inStock ? "Thêm vào giỏ hàng" : "Sản phẩm đã hết hàng"}
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleOrderThis(product)}
                      disabled={!inStock}
                      className="px-3 py-2 rounded-xl bg-navy-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-navy-900"
                      title={inStock ? "Tính giá và đặt ngay" : "Sản phẩm đã hết hàng"}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Mua ngay</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
      )}
    </section>
  );
}
