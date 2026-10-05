"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Zap,
  ShoppingBag,
  ShoppingCart
} from "lucide-react";
import { CURATED_PRODUCTS } from "@/lib/data";
import { CuratedProduct } from "@/types";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";

export default function CuratedProducts() {
  const { addToCart } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [products, setProducts] = useState<CuratedProduct[]>(CURATED_PRODUCTS);
  const [exchangeRate, setExchangeRate] = useState<number>(172);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        if (res.ok && data.products && data.products.length > 0) {
          setProducts(data.products);
          if (data.exchangeRate) {
            setExchangeRate(data.exchangeRate);
          }
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
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-[1600px] w-[95%] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-banana-800 bg-banana-100 px-3 py-1 rounded-full uppercase tracking-wider mb-2 border border-banana-200">
            <Sparkles className="w-3.5 h-3.5 text-banana-600" />
            <span>Sản Phẩm Có Sẵn Tại Shop • Giao Ngay 24H</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-navy-900">
            Sản Phẩm Có Sẵn Tại Kho ChillBanana
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Các mặt hàng nội địa Nhật tuyển chọn chính hãng, đã có sẵn tại kho Hà Nội &amp; TP.HCM. Đặt mua nhận hàng ngay trong 24h - 48h, không cần chờ thời gian gom đơn từ Nhật!
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
      <motion.div 
        layout 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <AnimatePresence>
          {filteredProducts.map((product, idx) => (
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
                  <span className="bg-emerald-700/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-lg">
                    ⚡ Sẵn Hàng
                  </span>
                </div>

                {/* Số lượng còn lại */}
                <div className="absolute bottom-2.5 right-2.5 bg-navy-950/85 backdrop-blur-sm text-banana-300 text-[11px] font-bold px-2 py-0.5 rounded-lg">
                  Còn {product.stockSlots}
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
                    <p className="text-[11px] text-slate-400 font-medium line-through decoration-slate-300">
                      {product.priceJpy.toLocaleString()} ¥
                    </p>
                    <p className="text-base font-bold text-banana-700 font-serif">
                      {(product.priceVnd || Math.round(product.priceJpy * exchangeRate)).toLocaleString("vi-VN")} <span className="text-xs">đ</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() =>
                        addToCart({
                          id: product.id,
                          name: product.name,
                          priceJpy: product.priceJpy,
                          priceVnd: product.priceVnd || Math.round(product.priceJpy * exchangeRate),
                          weightKg: product.weightKg,
                          imageUrl: product.imageUrl,
                          originalStore: product.originalStore,
                          category: product.category,
                        })
                      }
                      className="p-2.5 rounded-xl bg-banana-50 hover:bg-banana-500 text-banana-800 hover:text-navy-950 border border-banana-200 transition-colors"
                      title="Thêm vào giỏ hàng"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleOrderThis(product)}
                      className="px-3 py-2 rounded-xl bg-navy-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1"
                      title="Tính giá và đặt ngay"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Mua ngay</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
