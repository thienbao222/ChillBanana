"use client";

import Link from "next/link";

export default function BookmarkletGuidePage() {
  const bookmarkletCode = `javascript:(function(){var s=document.createElement('script');s.src='https://chillbanana.vn/bookmarklet.js?t='+Date.now();document.body.appendChild(s);})();`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <h1 className="text-3xl font-extrabold text-stone-900 mb-4">
          Hướng Dẫn Bookmarklet Mua Hàng 1-Click
        </h1>
        <p className="text-stone-600 mb-8 leading-relaxed">
          Bookmarklet là công cụ phím tắt siêu nhỏ trên trình duyệt giúp bạn tự động nhận diện thông tin sản phẩm (tên, giá Yên, hình ảnh) khi đang lướt các sàn thương mại điện tử Nhật Bản và chuyển về giỏ hàng ChillBanana ngay tức thì.
        </p>

        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl mb-8">
          <h2 className="text-lg font-bold text-amber-900 mb-2">Cách cài đặt nhanh trên Máy tính:</h2>
          <ol className="list-decimal list-inside space-y-3 text-stone-700">
            <li>Bật thanh dấu trang (Bookmarks Bar) trên trình duyệt bằng phím tắt <kbd className="bg-stone-200 px-2 py-0.5 rounded text-sm">Ctrl + Shift + B</kbd> (Windows) hoặc <kbd className="bg-stone-200 px-2 py-0.5 rounded text-sm">Cmd + Shift + B</kbd> (Mac).</li>
            <li>
              Kéo thả nút màu vàng dưới đây trực tiếp vào thanh dấu trang của bạn:
              <div className="my-4">
                <a
                  href={bookmarkletCode}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-500 text-stone-900 font-bold rounded-full shadow transition-transform hover:scale-105 cursor-grab active:cursor-grabbing"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Hãy KÉO THẢ nút này lên thanh Bookmarks Bar của trình duyệt (thay vì bấm trực tiếp)!");
                  }}
                >
                  🍌 Thêm vào ChillBanana
                </a>
              </div>
            </li>
            <li>Khi duyệt bất kỳ sản phẩm nào trên Rakuten, Yahoo Shopping, Amazon JP... chỉ cần bấm vào Bookmark này!</li>
          </ol>
        </div>

        <div className="border-t border-stone-200 pt-6 mt-6">
          <h3 className="text-md font-bold text-stone-800 mb-2">Lưu ý về chính sách bảo mật trình duyệt (CSP):</h3>
          <p className="text-stone-600 text-sm leading-relaxed mb-4">
            Một số trang web có chính sách bảo vệ Content Security Policy (CSP) cực kỳ nghiêm ngặt có thể chặn script tự động chạy. Nếu gặp trường hợp này, quý khách chỉ cần copy đường link URL sản phẩm và dán vào thanh tìm kiếm/tính giá tại trang chủ ChillBanana.
          </p>
          <div className="flex gap-4">
            <Link
              href="/"
              className="text-sm font-semibold text-amber-700 hover:underline"
            >
              ← Quay về trang chủ ChillBanana
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
