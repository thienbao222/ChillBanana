/**
 * Logistics API Adapter — Nhóm 2.1: Tracking & Logistic Agent
 *
 * Adapter lấy trạng thái vận đơn từ các hãng vận chuyển.
 * Thiết kế theo pattern Strategy: mỗi hãng là 1 hàm riêng,
 * `queryTrackingStatus()` tự chọn đúng hãng dựa trên mã tracking.
 *
 * TRẠNG THÁI TRIỂN KHAI:
 * - GHN, GHTK, ViettelPost: Cần API key trong .env (xem comment từng hàm)
 * - Sagawa, Yamato: Scrape qua Jina AI (không cần API key)
 * - Nếu chưa có API key → trả về null (cron bỏ qua, không crash)
 */

export interface TrackingResult {
  provider: string;          // "GHN" | "GHTK" | "ViettelPost" | "Sagawa" | "Yamato"
  trackingCode: string;
  status: string;            // Mã trạng thái nguyên gốc từ hãng
  statusLabel: string;       // Mô tả tiếng Việt
  location: string;          // Vị trí hiện tại
  updatedAt: string;         // ISO timestamp lần cập nhật gần nhất
  isDelivered: boolean;
  isStuck: boolean;          // true nếu không có cập nhật > 3 ngày
  rawEvent?: string;         // Sự kiện mới nhất từ hãng (để log vào TrackingLog)
}

/** Chỉ kết thúc đơn khi chặng giao cuối tại Việt Nam xác nhận đã giao. */
export function shouldCompleteOrder(
  leg: TrackingLegHint,
  orderStatus: string,
  isDelivered: boolean
): boolean {
  return leg === "VN" && orderStatus === "LOCAL_DELIVERY" && isDelivered;
}

/** So trạng thái gần nhất theo đúng mã vận đơn, không nhầm hai chặng của cùng đơn. */
export function hasTrackingStatusChanged(
  logs: Array<{ title: string; description: string }>,
  trackingCode: string,
  nextStatusLabel: string
): boolean {
  const marker = `Mã vận đơn: ${trackingCode}.`;
  const lastLogForCode = logs.find((log) => log.description.includes(marker));
  return !lastLogForCode || lastLogForCode.title !== nextStatusLabel;
}

// ─── Phát hiện hãng từ định dạng mã tracking ────────────────────────────────

export type TrackingLegHint = "JP" | "VN";

export function detectProvider(code: string, legHint?: TrackingLegHint): string {
  const c = code.trim().toUpperCase();

  // Mã 12 số bị trùng định dạng giữa GHN, Sagawa và Yamato. Dựa vào
  // trường vận đơn JP/VN của đơn hàng để phân loại đúng chặng trước.
  if (legHint === "JP") {
    if (/^0[0-9]{11}$/.test(c)) return "Sagawa";
    if (/^[0-9]{12}$/.test(c)) return "Yamato";
    if (/^[0-9]+$/.test(c)) return "UNKNOWN";
  }

  if (/^GHN/i.test(c)) return "GHN";
  if (/^GHTK/i.test(c) || /^S[0-9]{8,}/i.test(c)) return "GHTK";
  if (/^VTP/i.test(c) || /^VTL/i.test(c)) return "ViettelPost";
  if (/^[0-9]{10,12}$/.test(c)) return "GHN"; // Mặc định mã số ở chặng VN là GHN
  return "UNKNOWN";
}

// ─── GHN (Giao Hàng Nhanh) ───────────────────────────────────────────────────
// Cần: GHN_API_TOKEN và GHN_SHOP_ID trong .env

async function queryGHN(trackingCode: string): Promise<TrackingResult | null> {
  const token = process.env.GHN_API_TOKEN;
  const shopId = process.env.GHN_SHOP_ID;
  if (!token || !shopId) {
    console.warn("[Tracking] GHN_API_TOKEN hoặc GHN_SHOP_ID chưa cấu hình — bỏ qua GHN tracking.");
    return null;
  }

  try {
    const res = await fetch("https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/detail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Token": token,
        "ShopId": shopId,
      },
      body: JSON.stringify({ order_code: trackingCode }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const order = data?.data;
    if (!order) return null;

    const status: string = order.status || "unknown";
    const isDelivered = status === "delivered";
    const updatedAt: string = order.updated_date || new Date().toISOString();
    const isStuck = !isDelivered && isOlderThan3Days(updatedAt);

    return {
      provider: "GHN",
      trackingCode,
      status,
      statusLabel: translateGHNStatus(status),
      location: order.current_warehouse_address || order.to_district_name || "Đang cập nhật",
      updatedAt,
      isDelivered,
      isStuck,
      rawEvent: order.log?.[0]?.status,
    };
  } catch (err) {
    console.warn("[Tracking] GHN query error:", err);
    return null;
  }
}

function translateGHNStatus(status: string): string {
  const map: Record<string, string> = {
    "ready_to_pick": "Chờ lấy hàng",
    "picking": "Đang lấy hàng",
    "cancel": "Đã hủy",
    "money_collect_picking": "Đang thu tiền",
    "picked": "Đã lấy hàng",
    "storing": "Đang lưu kho",
    "transporting": "Đang vận chuyển",
    "sorting": "Đang phân loại",
    "delivering": "Đang giao hàng",
    "money_collect_delivering": "Đang thu tiền khi giao",
    "delivered": "✅ Giao thành công",
    "delivery_fail": "⚠️ Giao thất bại",
    "waiting_to_return": "Chờ hoàn hàng",
    "return": "Đang hoàn hàng",
    "returned": "Đã hoàn hàng",
    "exception": "⚠️ Ngoại lệ",
    "lost": "❌ Mất hàng",
    "damage": "⚠️ Hàng hỏng",
  };
  return map[status] || status;
}

// ─── GHTK (Giao Hàng Tiết Kiệm) ─────────────────────────────────────────────
// Cần: GHTK_API_TOKEN trong .env

async function queryGHTK(trackingCode: string): Promise<TrackingResult | null> {
  const token = process.env.GHTK_API_TOKEN;
  if (!token) {
    console.warn("[Tracking] GHTK_API_TOKEN chưa cấu hình — bỏ qua GHTK tracking.");
    return null;
  }

  try {
    const res = await fetch(`https://services.giaohangtietkiem.vn/services/shipment/v2/${encodeURIComponent(trackingCode)}`, {
      headers: { "Token": token },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const shipment = data?.shipment;
    if (!shipment) return null;

    const status = String(shipment.status_id || "");
    const isDelivered = status === "8"; // GHTK: 8 = Đã giao
    const updatedAt: string = shipment.modified || new Date().toISOString();
    const isStuck = !isDelivered && isOlderThan3Days(updatedAt);

    return {
      provider: "GHTK",
      trackingCode,
      status,
      statusLabel: translateGHTKStatus(status),
      location: shipment.current_transport_handle || "Đang cập nhật",
      updatedAt,
      isDelivered,
      isStuck,
      rawEvent: shipment.last_event,
    };
  } catch (err) {
    console.warn("[Tracking] GHTK query error:", err);
    return null;
  }
}

function translateGHTKStatus(statusId: string): string {
  const map: Record<string, string> = {
    "1": "Chưa tiếp nhận", "2": "Đã tiếp nhận", "3": "Đang lấy hàng",
    "4": "Đã lấy xong", "5": "Đang vận chuyển", "6": "Đang giao hàng",
    "7": "Giao thất bại", "8": "✅ Giao thành công", "9": "Đang hoàn hàng",
    "10": "Đã hoàn hàng", "11": "Hủy lấy", "12": "Mất hàng",
    "123": "Chờ đối soát",
  };
  return map[statusId] || `Trạng thái ${statusId}`;
}

// ─── ViettelPost ─────────────────────────────────────────────────────────────
// Cần: VIETTELPOST_TOKEN trong .env

/**
 * Chuyển đổi định dạng ngày "DD/MM/YYYY HH:mm:ss" hoặc "DD/MM/YYYY" của ViettelPost sang chuỗi ISO 8601 hợp lệ.
 */
function parseViettelPostDate(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== "string") return new Date().toISOString();
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (match) {
    const [, day, month, year, hour = "00", min = "00", sec = "00"] = match;
    const isoString = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${min.padStart(2, "0")}:${sec.padStart(2, "0")}+07:00`;
    const d = new Date(isoString);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  const parsed = new Date(trimmed);
  return !isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

async function queryViettelPost(trackingCode: string): Promise<TrackingResult | null> {
  const token = process.env.VIETTELPOST_TOKEN;
  if (!token) {
    console.warn("[Tracking] VIETTELPOST_TOKEN chưa cấu hình — bỏ qua ViettelPost tracking.");
    return null;
  }

  try {
    const res = await fetch(`https://partner.viettelpost.vn/v2/contract-insurance/getBillTrack`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Token": token,
      },
      body: JSON.stringify({ billCode: trackingCode }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const bill = data?.data?.[0];
    if (!bill) return null;

    const status = String(bill.STATUS || "");
    const isDelivered = bill.STATUS_NAME?.toLowerCase().includes("phát thành công");
    const updatedAt: string = parseViettelPostDate(bill.ACCEPT_DATE);
    const isStuck = !isDelivered && isOlderThan3Days(updatedAt);

    return {
      provider: "ViettelPost",
      trackingCode,
      status,
      statusLabel: bill.STATUS_NAME || status,
      location: bill.LOCATION_CURRENT || "Đang cập nhật",
      updatedAt,
      isDelivered: !!isDelivered,
      isStuck,
      rawEvent: bill.NOTE,
    };
  } catch (err) {
    console.warn("[Tracking] ViettelPost query error:", err);
    return null;
  }
}

// ─── Sagawa Express JP (via Jina AI scrape — không cần API key) ──────────────

async function querySagawa(trackingCode: string): Promise<TrackingResult | null> {
  try {
    const url = `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${encodeURIComponent(trackingCode)}`;
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "Accept": "text/plain" },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const text = await res.text();

    // Tìm trạng thái trong output Jina — Sagawa trả bằng tiếng Nhật
    const statusMatch = text.match(/配達完了|配送中|集荷完了|仕分中|到着/);
    if (!statusMatch) return null;

    const rawStatus = statusMatch[0];
    const isDelivered = rawStatus === "配達完了";
    const updatedAt = new Date().toISOString();

    return {
      provider: "Sagawa",
      trackingCode,
      status: rawStatus,
      statusLabel: translateSagawaStatus(rawStatus),
      location: "Nhật Bản",
      updatedAt,
      isDelivered,
      isStuck: false, // Sagawa không lấy timestamp được qua scrape
      rawEvent: rawStatus,
    };
  } catch (err) {
    console.warn("[Tracking] Sagawa scrape error:", err);
    return null;
  }
}

function translateSagawaStatus(jp: string): string {
  const map: Record<string, string> = {
    "配達完了": "✅ Giao thành công (Nhật)",
    "配送中": "Đang giao hàng (Nhật)",
    "集荷完了": "Đã lấy hàng (Nhật)",
    "仕分中": "Đang phân loại tại kho Nhật",
    "到着": "Đã đến điểm trung chuyển (Nhật)",
  };
  return map[jp] || jp;
}

// ─── Yamato Transport JP (via Jina AI scrape) ────────────────────────────────

async function queryYamato(trackingCode: string): Promise<TrackingResult | null> {
  try {
    const url = `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${encodeURIComponent(trackingCode)}`;
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "Accept": "text/plain" },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const text = await res.text();

    const statusMatch = text.match(/配達完了|配達中|持ち出し中|仕分け完了|受付完了/);
    if (!statusMatch) return null;

    const rawStatus = statusMatch[0];
    const isDelivered = rawStatus === "配達完了";

    return {
      provider: "Yamato",
      trackingCode,
      status: rawStatus,
      statusLabel: translateYamatoStatus(rawStatus),
      location: "Nhật Bản",
      updatedAt: new Date().toISOString(),
      isDelivered,
      isStuck: false,
      rawEvent: rawStatus,
    };
  } catch (err) {
    console.warn("[Tracking] Yamato scrape error:", err);
    return null;
  }
}

function translateYamatoStatus(jp: string): string {
  const map: Record<string, string> = {
    "配達完了": "✅ Giao thành công (Nhật)",
    "配達中": "Đang giao hàng (Nhật)",
    "持ち出し中": "Đang mang đi giao (Nhật)",
    "仕分け完了": "Phân loại xong (kho Nhật)",
    "受付完了": "Đã tiếp nhận (kho Nhật)",
  };
  return map[jp] || jp;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function isOlderThan3Days(dateStr: string): boolean {
  try {
    let d = new Date(dateStr).getTime();
    if (isNaN(d)) {
      d = new Date(parseViettelPostDate(dateStr)).getTime();
    }
    if (isNaN(d)) return false;
    return Date.now() - d > 3 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Query trạng thái vận đơn từ mã tracking.
 * Tự động phát hiện hãng và gọi đúng adapter.
 * Trả về null nếu không hỗ trợ hoặc không có API key.
 */
export async function queryTrackingStatus(
  trackingCode: string,
  legHint?: TrackingLegHint
): Promise<TrackingResult | null> {
  const provider = detectProvider(trackingCode, legHint);

  switch (provider) {
    case "GHN":        return queryGHN(trackingCode);
    case "GHTK":       return queryGHTK(trackingCode);
    case "ViettelPost": return queryViettelPost(trackingCode);
    case "Sagawa":     return querySagawa(trackingCode);
    case "Yamato":     return queryYamato(trackingCode);
    default:
      console.warn(`[Tracking] Không nhận dạng được hãng cho mã: ${trackingCode}`);
      return null;
  }
}
