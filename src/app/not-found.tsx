import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <span className="text-5xl block mb-4">🍌</span>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">404 - Không tìm thấy trang</h2>
        <p className="text-slate-600 text-sm mb-6">
          Trang bạn đang tìm kiếm không tồn tại hoặc đã được chuyển sang địa chỉ mới.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 bg-sky-600 text-white font-medium text-sm rounded-xl hover:bg-sky-700 transition-colors"
        >
          Trở về Trang chủ
        </Link>
      </div>
    </div>
  );
}
