"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Zap, Flame, ShoppingBag, ExternalLink, RefreshCw } from "lucide-react";
import { CURATED_PRODUCTS } from "@/lib/data";
import { CuratedProduct } from "@/types";

export default function CuratedProducts() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [products, setProducts] = useState<CuratedProduct[]>(CURATED_PRODUCTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        if (res.ok && data.products && data.products.length > 0) {
          setProducts(data.products);
        }
      } catch (err) {
        // use fallback CURATED_PRODUCTS
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = selectedCategory === "all"
    ? products
    : products.filter((p) => p.category === selectedCategory);

  const handleOrderThis = (product: CuratedProduct) => {
    // Dispatch custom event to notify OrderCalculator if listening
    window.dispatchEvent(
      new CustomEvent("chillbanana:select_product", {
        detail: {
          name: product.name,
          priceJpy: product.priceJpy,
          weightKg: product.weightKg,
          imageUrl: product.imageUrl,
          originalStore: product.originalStore,
        },
      })
    );

    const calcSection = document.getElementById("calculator");
    if (calcSection) {
      calcSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="py-12 w-full px-4 sm:px-8 lg:px-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-banana-800 bg-banana-100 px-3 py-1 rounded-full uppercase tracking-wider mb-2 border border-banana-200">
            <Flame className="w-3.5 h-3.5 text-banana-600" />
            <span>Sản Phẩm Đang Săn Deal & Sẵn Slot Gom</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-navy-900">
            Gợi Ý Mặt Hàng Bán Chạy Tại Nhật
          </h2>
        </div>

        {/* Filter buttons */}
        <div className="mt-4 md:mt-0 flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-2xl">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedCategory === "all"
                ? "bg-navy-900 text-white shadow-sm"
                : "text-slate-600 hover:text-navy-900"
            }`}
          >
            Tất Cả ({CURATED_PRODUCTS.length})
          </button>
          <button
            onClick={() => setSelectedCategory("cosmetics")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedCategory === "cosmetics"
                ? "bg-white text-pink-600 shadow-sm"
                : "text-slate-600 hover:text-pink-600"
            }`}
          >
            🌸 Mỹ Phẩm
          </button>
          <button
            onClick={() => setSelectedCategory("health")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedCategory === "health"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-600 hover:text-emerald-600"
            }`}
          >
            🌿 Sức Khỏe
          </button>
          <button
            onClick={() => setSelectedCategory("gadgets")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedCategory === "gadgets"
                ? "bg-white text-banana-700 shadow-sm"
                : "text-slate-600 hover:text-banana-700"
            }`}
          >
            ⚡ Gia Dụng 100V
          </button>
          <button
            onClick={() => setSelectedCategory("anime")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedCategory === "anime"
                ? "bg-white text-purple-600 shadow-sm"
                : "text-slate-600 hover:text-purple-600"
            }`}
          >
            🎎 Anime Figure
          </button>
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredProducts.map((product) => (
          <div
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
                <span className="bg-navy-900/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-lg">
                  {product.originalStore}
                </span>
              </div>

              {/* Slot mua hộ còn lại */}
              <div className="absolute bottom-2.5 right-2.5 bg-navy-950/80 backdrop-blur-sm text-banana-300 text-[11px] font-bold px-2 py-0.5 rounded-lg">
                Còn {product.stockSlots} slot gom
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
                    Giá gốc: {product.priceJpy.toLocaleString()} ¥
                  </p>
                  <p className="text-base font-bold text-banana-700 font-serif">
                    {product.priceVnd.toLocaleString("vi-VN")} <span className="text-xs">đ</span>
                  </p>
                </div>

                <button
                  onClick={() => handleOrderThis(product)}
                  className="p-3 rounded-2xl bg-slate-100 hover:bg-banana-500 text-slate-700 hover:text-navy-950 transition-colors"
                  title="Đặt mua sản phẩm này"
                >
                  <ShoppingBag className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
