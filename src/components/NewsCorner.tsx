"use client";

import React, { useState } from "react";
import { Newspaper, Clock, ArrowRight, X } from "lucide-react";
import { KIZUNA_NEWS } from "@/lib/data";
import { NewsItem } from "@/types";

export default function NewsCorner() {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  return (
    <section id="news" className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-banana-800 bg-banana-100 px-3 py-1 rounded-full uppercase tracking-wider mb-2 border border-banana-200">
            <Newspaper className="w-3.5 h-3.5 text-banana-600" />
            <span>ChillBanana Cẩm Nang Mua Hàng Nhật</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-navy-900">
            Kinh Nghiệm Săn Deal &amp; Cẩm Nang Mua Sắm Nội Địa Nhật
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tổng hợp kinh nghiệm săn sale Amazon JP, mẹo chọn size đồ Uniqlo và giải pháp biến áp an toàn cho đồ điện 100V.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {KIZUNA_NEWS.map((item) => (
          <article
            key={item.id}
            onClick={() => setSelectedNews(item)}
            className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="relative h-44 overflow-hidden bg-slate-100">
                <img
                  src={item.coverImage}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2.5 left-2.5 bg-navy-900/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">
                  {item.categoryName}
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center space-x-2 text-[11px] text-slate-400 mb-2">
                  <Clock className="w-3 h-3" />
                  <span>{item.readTime}</span>
                  <span>•</span>
                  <span>{item.publishedAt}</span>
                </div>

                <h3 className="text-sm font-bold text-navy-900 line-clamp-2 group-hover:text-banana-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-3 mt-2">
                  {item.excerpt}
                </p>
              </div>
            </div>

            <div className="p-4 pt-0">
              <span className="inline-flex items-center text-xs font-bold text-banana-700 group-hover:underline">
                Đọc bài viết <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </span>
            </div>
          </article>
        ))}
      </div>

      {/* Modal Đọc Chi Tiết Bài Viết */}
      {selectedNews && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border relative my-8">
            <button
              onClick={() => setSelectedNews(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="space-y-4">
              <span className="text-xs font-bold text-banana-900 uppercase tracking-wider bg-banana-100 px-3 py-1 rounded-full border border-banana-200">
                {selectedNews.categoryName}
              </span>
              <h3 className="text-xl sm:text-2xl font-serif font-bold text-navy-900">
                {selectedNews.title}
              </h3>
              <div className="flex items-center text-xs text-slate-400 space-x-3 pb-3 border-b">
                <span>Thời lượng: {selectedNews.readTime}</span>
                <span>Ngày đăng: {selectedNews.publishedAt}</span>
              </div>

              <div className="h-56 rounded-2xl overflow-hidden">
                <img
                  src={selectedNews.coverImage}
                  alt={selectedNews.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="text-sm text-slate-700 leading-relaxed space-y-3 whitespace-pre-line bg-slate-50 p-4 rounded-2xl border">
                {selectedNews.content}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedNews(null)}
                  className="px-6 py-2.5 bg-navy-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
