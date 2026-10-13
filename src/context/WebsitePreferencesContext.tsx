"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type WebsiteLanguage = "vi" | "ja";
export type WebsiteTheme = "system" | "light" | "dark";
export type WebsiteFont = "rounded" | "system" | "serif";
export type WebsiteTextSize = "small" | "normal" | "large";

export type WebsitePreferences = {
  language: WebsiteLanguage;
  theme: WebsiteTheme;
  brightness: number;
  effectsEnabled: boolean;
  font: WebsiteFont;
  textSize: WebsiteTextSize;
};

const JAPANESE_UI_COPY: Record<string, string> = {
  "Tùy chỉnh giao diện": "表示設定",
  "Danh mục chính": "メインメニュー",
  "Điều hướng nhanh": "クイックメニュー",
  "Mở giỏ hàng": "カートを開く",
  "Dán Link Tính Giá": "商品リンクで見積もり",
  "Sản Phẩm Có Sẵn": "在庫商品",
  "Tra Cứu Đơn Hàng": "注文を追跡",
  "ChillBanana AI": "ChillBanana AI",
  "Admin Portal": "管理者ポータル",
  "Giao diện NeoDay": "NeoDayデザイン",
  "Giao diện chính NeoDay": "NeoDayデザイン",
  "Về giao diện cũ": "旧デザインに戻る",
  "Mua hàng Nhật chuẩn – Thư thái & Thảnh thơi": "日本から安心して、ゆったりお買い物",
  "Bảo hiểm hàng hóa 100% – Cam kết nội địa Nhật chính hãng": "商品補償100% · 日本国内正規品をお届け",
  "Dán Link Tính Giá Mua Hộ": "商品リンクで購入代行を見積もる",
  "4 Danh Mục Hot": "人気の4カテゴリ",
  "4 Danh Mục Chủ Lực": "人気の4カテゴリ",
  "Tra Cứu Đơn Hàng (7 Bước)": "注文を追跡（7段階）",
  "Cẩm Nang Hàng Nhật": "日本商品のガイド",
  "Đăng Nhập": "ログイン",
  "Đăng xuất": "ログアウト",
  "Đăng Nhập / Đăng Ký": "ログイン / 新規登録",
  "Giỏ hàng": "カート",
  "Tài khoản": "アカウント",
  "Đăng nhập": "ログイン",
  "Đăng nhập ▾": "ログイン ▾",
  "Đặt Mua Hộ Ngay": "購入代行を依頼",
  "1 JPY · Tỷ giá live": "1 JPY · 最新為替レート",
  "Bảo hiểm hàng hóa": "商品補償",
  "Mua Hàng Nhật Chuẩn – Thư Thái Cùng ChillBanana · JP": "日本から安心してお買い物 · ChillBanana",
  "Ủy Thác Mua Hộ Hàng Nhật ": "日本商品の購入代行 ",
  "Tự Động Bóc Tách Link": "リンクから自動見積もり",
  "Dán Link Tính Giá Tự Động": "商品リンクから自動見積もり",
  "Công Cụ Tự Động Bóc Tách Link & Báo Giá Trọn Gói": "リンク解析・料金見積もりツール",
  "Dán Link Nhật - ChillBanana Báo Giá Trong 3 Giây": "日本の商品リンクから3秒でお見積もり",
  "JP → VN · Mua Hàng Từ Nhật Về Việt Nam": "日本 → ベトナム · 日本から商品を購入",
  "VN → JP · Gửi Quà / Hàng Sang Nhật Bản": "ベトナム → 日本 · 日本へ荷物を発送",
  "1. Dán đường dẫn link sản phẩm Nhật Bản": "1. 日本の商品リンクを貼り付け",
  "Tự động lấy Tên, Ảnh & Giá Yên": "商品名・画像・円価格を自動取得",
  "Đang quét...": "解析中...",
  "Quét Link Tự Động": "リンクを解析",
  "2. Tên sản phẩm (hiển thị trên đơn)": "2. 商品名（注文に表示）",
  "3. Danh mục hàng hóa": "3. 商品カテゴリ",
  "Mỹ Phẩm & Chăm Sóc Da": "化粧品・スキンケア",
  "Thực Phẩm Chức Năng": "健康食品・サプリメント",
  "Gia Dụng & Điện Tử Mini": "生活用品・小型家電",
  "Anime, Figure & Sưu Tầm": "アニメ・フィギュア・コレクション",
  "4. Giá gốc tại Nhật (¥ Yên)": "4. 日本での価格（円）",
  "5. Trọng lượng kiện hàng": "5. 荷物の重量",
  "Cân đo thực tế tại kho": "倉庫で実測",
  "https://www.amazon.co.jp/... hoặc https://jp.mercari.com/...": "https://www.amazon.co.jp/... または https://jp.mercari.com/...",
  "VD: Kem chống nắng Anessa / Mô hình Gundam": "例：Anessaの日焼け止め / Gundamの模型",
  "Hệ thống không áp đặt số kg mặc định vào tiền cọc. Kiện hàng về kho Tokyo sẽ được cân đo chính xác theo gram để bảo đảm công bằng nhất.": "前金に一律の重量は加算しません。東京倉庫に到着後、荷物をグラム単位で実測して送料を計算します。",
  "Đơn hàng đã đạt hạn mức tối thiểu và đủ điều kiện vận chuyển chuyên biệt!": "注文は最低条件を満たし、特別配送の対象です。",
  "Bật Chế Độ Gộp Đơn (Tiết kiệm 25% cước vận chuyển cho kiện < 0.5kg)": "まとめ買いを有効にする（0.5 kg未満の荷物は送料25%割引）",
  "Bảng kê chi phí trọn gói": "お見積もり明細",
  "Tiền hàng gốc": "商品代金",
  "Phụ phí hải quan & đóng gói:": "通関・梱包手数料：",
  "Tiền Hàng & Phí Mua Hộ:": "商品代金・購入代行料：",
  "Thêm Vào Giỏ Hàng": "カートに追加",
  "Đặt Cọc & Mua Ngay": "前金を支払って注文",
  "Ưu đãi Mua Chung (-25%)": "まとめ買い割引（-25%）",
  "Cân đo thực tế khi về kho (0 đ)": "倉庫到着後に実測（0ドン）",
  "0 đ (Miễn phí)": "0ドン（無料）",
  "Chờ ChillBanana duyệt giá trước khi thanh toán": "お支払い前にChillBananaが価格を確認します",
  "Chuẩn quốc tế:": "国際基準：",
  "Bạn chỉ cần cọc tiền mua hàng. Cước bay quốc tế sẽ được cân đo chính xác khi kiện hàng về tới kho Tokyo/VN và thanh toán khi nhận hàng!": "商品代金の前金のみお支払いください。国際送料は東京またはベトナムの倉庫で実測後、お受け取り時にお支払いいただきます。",
  "Gom vào giỏ hàng để đặt nhiều món cùng lúc": "複数の商品をまとめて注文する",
  "Vui lòng dán link sản phẩm trước.": "先に商品リンクを貼り付けてください。",
  "Thông tin giao nhận & Đặt cọc": "配送先・前金情報",
  "✕ Đóng form": "✕ フォームを閉じる",
  "Họ và tên người nhận *": "受取人氏名 *",
  "Số điện thoại nhận hàng *": "電話番号 *",
  "Địa chỉ nhận hàng tại Việt Nam *": "ベトナム国内の配送先住所 *",
  "Số nhà, tên đường, Phường/Xã, Quận/Huyện, Tỉnh/TP": "番地、通り、区・市、都道府県など",
  "Về giao diện NeoDay": "NeoDayデザインに戻る",
  "Chuyển giao diện": "デザイン切り替え",
  "Theo Dõi Vận Tải Thời Gian Thực": "配送状況をリアルタイムで確認",
  "Tra Cứu & Quản Lý Đơn Hàng Mua Hộ": "購入代行注文の追跡・管理",
  "HỆ THỐNG THEO DÕI VẬN TẢI CHILLBANANA · TOKYO ⇄ VIỆT NAM": "ChillBanana配送追跡 · 東京 ⇄ ベトナム",
  "Theo dõi chi tiết 7 chặng vận chuyển từ Tokyo về tận tay bạn tại Việt Nam. Quản lý trạng thái đơn hàng, kiểm tra cước bay và hỗ trợ hủy đơn linh hoạt.": "東京からベトナムのお届け先まで、配送の7段階を確認できます。注文状況や送料を確認し、必要に応じて注文をキャンセルできます。",
  "Giao dịch đã được xác nhận. Tiến độ xử lý đơn được cập nhật bên dưới.": "決済が確認されました。注文の進捗は以下に表示されます。",
  "Đơn vẫn được lưu; bạn có thể thử thanh toán lại từ trang này.": "注文は保存されています。このページから再度お支払いいただけます。",
  "Giao dịch bị hủy hoặc chưa hoàn tất. Đơn vẫn được lưu; bạn có thể thử thanh toán lại từ trang này.": "決済がキャンセルされたか完了していません。注文は保存されています。このページから再度お支払いいただけます。",
  "Đơn Hàng Của Tôi": "注文一覧",
  "Đơn Mua Hộ": "購入代行注文",
  "Tra Cứu Mã Đơn Khác": "別の注文を検索",
  "Tra Cứu": "注文を検索",
  "Đang tìm...": "検索中...",
  "Quản Lý Đơn Hàng Của": "注文を管理",
  "Quản Lý Đơn Hàng Của ": "注文を管理：",
  "Thành viên VIP": "VIP会員",
  "Đã Hủy": "キャンセル済み",
  "Hoàn Tất": "完了",
  "Đã hoàn tiền": "返金済み",
  "Chờ cọc": "前金待ち",
  "Đã cọc 50%": "50%支払済み",
  "Đã TT 100%": "全額支払済み",
  "Đã thanh toán 100%": "全額支払済み",
  "Chờ đặt cọc": "前金待ち",
  "Tổng chi phí:": "合計金額：",
  "Tiến Độ Vận Tải Quốc Tế & Nội Địa (7 Chặng)": "国際・国内配送の進捗（7段階）",
  "Vận đơn nội địa Nhật Bản:": "日本国内の追跡番号：",
  "Vận đơn giao hàng tại Việt Nam:": "ベトナム国内の追跡番号：",
  "Chi Tiết Kiện Hàng & Chi Phí": "荷物と料金の詳細",
  "Số tiền cần thanh toán": "お支払い金額",
  "Mức thanh toán tạm tính:": "仮のお支払い金額：",
  "Làm mới danh sách": "一覧を更新",
  "Đang đồng bộ danh sách đơn hàng từ máy chủ...": "サーバーから注文一覧を取得しています...",
  "Bạn chưa có đơn hàng nào": "注文はまだありません",
  "Nhập mã đơn hàng (Ví dụ: CB-2026-XXXX)": "注文番号を入力（例：CB-2026-XXXX）",
  "Mã đơn hàng có cấu trúc": "注文番号の形式：",
  "Xem Hành Trình": "配送状況を見る",
  "Hủy Đơn": "注文をキャンセル",
  "Hủy Đơn Hàng": "注文をキャンセル",
  "Tên sản phẩm:": "商品名：",
  "Giá gốc tại Nhật:": "日本での商品価格：",
  "Tỷ giá áp dụng:": "適用為替レート：",
  "Tiền hàng quy đổi:": "換算後の商品代金：",
  "Phí mua hộ & bảo hiểm (4%):": "購入代行・補償料（4%）：",
  "Cước bay quốc tế:": "国際送料：",
  "Tổng tiền hàng:": "商品代金合計：",
  "Thanh toán chưa hoàn tất": "お支払いが完了していません",
  "Thanh toán qua VNPAY thành công! 🎉": "VNPAYでのお支払いが完了しました！🎉",
  "Tùy chỉnh website": "ウェブサイトの設定",
  "Tiếng Việt": "ベトナム語",
  "日本語": "日本語",
};

export function useWebsiteText() {
  const { preferences } = useWebsitePreferences();
  return useCallback((vietnamese: string) => {
    if (preferences.language !== "ja") return vietnamese;
    return JAPANESE_UI_COPY[vietnamese] ?? vietnamese;
  }, [preferences.language]);
}

const STORAGE_KEY = "chillbanana.website-preferences.v1";
export const DEFAULT_WEBSITE_PREFERENCES: WebsitePreferences = {
  language: "vi",
  theme: "system",
  brightness: 100,
  effectsEnabled: true,
  font: "rounded",
  textSize: "normal",
};

type PreferencesContextValue = {
  preferences: WebsitePreferences;
  updatePreferences: (patch: Partial<WebsitePreferences>) => void;
  resetPreferences: () => void;
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
};

const WebsitePreferencesContext = createContext<PreferencesContextValue | null>(null);

function normalizePreferences(value: unknown): WebsitePreferences {
  if (!value || typeof value !== "object") return DEFAULT_WEBSITE_PREFERENCES;
  const candidate = value as Partial<WebsitePreferences>;
  return {
    language: candidate.language === "ja" ? "ja" : "vi",
    theme: candidate.theme === "light" || candidate.theme === "dark" ? candidate.theme : "system",
    brightness: typeof candidate.brightness === "number" && Number.isFinite(candidate.brightness)
      ? Math.min(100, Math.max(70, Math.round(candidate.brightness)))
      : DEFAULT_WEBSITE_PREFERENCES.brightness,
    effectsEnabled: typeof candidate.effectsEnabled === "boolean" ? candidate.effectsEnabled : true,
    font: candidate.font === "system" || candidate.font === "serif" ? candidate.font : "rounded",
    textSize: candidate.textSize === "small" || candidate.textSize === "large" ? candidate.textSize : "normal",
  };
}

function applyPreferences(preferences: WebsitePreferences) {
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const resolvedTheme = preferences.theme === "system"
    ? (systemPrefersDark ? "dark" : "light")
    : preferences.theme;
  const scale = preferences.textSize === "small" ? 0.92 : preferences.textSize === "large" ? 1.12 : 1;

  root.dataset.siteTheme = resolvedTheme;
  root.dataset.siteEffects = preferences.effectsEnabled ? "on" : "off";
  root.dataset.siteFont = preferences.font;
  root.dataset.siteTextSize = preferences.textSize;
  root.dataset.sitePreferencesActive = "true";
  root.lang = preferences.language;
  root.style.colorScheme = resolvedTheme;
  root.style.setProperty("--site-dim-opacity", String((100 - preferences.brightness) / 100));
  root.style.fontSize = `${16 * scale}px`;
}

function clearAppliedPreferences() {
  const root = document.documentElement;
  delete root.dataset.siteTheme;
  delete root.dataset.siteEffects;
  delete root.dataset.siteFont;
  delete root.dataset.siteTextSize;
  delete root.dataset.sitePreferencesActive;
  root.lang = "vi";
  root.style.removeProperty("color-scheme");
  root.style.removeProperty("--site-dim-opacity");
  root.style.removeProperty("font-size");
}

export function WebsitePreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_WEBSITE_PREFERENCES);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setPreferences(normalizePreferences(JSON.parse(stored)));
    } catch {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage can be disabled by browser privacy settings.
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => clearAppliedPreferences, []);

  useEffect(() => {
    applyPreferences(preferences);
    if (hydrated) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch {
        // Preferences still apply for this visit if browser storage is unavailable.
      }
    }
  }, [preferences, hydrated]);

  useEffect(() => {
    if (preferences.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPreferences(preferences);
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [preferences]);

  const updatePreferences = useCallback((patch: Partial<WebsitePreferences>) => {
    setPreferences((current) => normalizePreferences({ ...current, ...patch }));
  }, []);
  const resetPreferences = useCallback(() => setPreferences(DEFAULT_WEBSITE_PREFERENCES), []);
  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const value = useMemo(() => ({
    preferences,
    updatePreferences,
    resetPreferences,
    isPanelOpen,
    openPanel,
    closePanel,
  }), [preferences, updatePreferences, resetPreferences, isPanelOpen, openPanel, closePanel]);

  return <WebsitePreferencesContext.Provider value={value}>{children}</WebsitePreferencesContext.Provider>;
}

export function useWebsitePreferences() {
  const value = useContext(WebsitePreferencesContext);
  if (!value) throw new Error("useWebsitePreferences must be used inside WebsitePreferencesProvider");
  return value;
}
