import { ExternalSearchResponse, ExternalProductSearchResult } from "./types";

const RAKUTEN_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";

export async function searchRakuten(
  keyword: string,
  limit = 20,
  fetchFn: typeof fetch = fetch
): Promise<ExternalSearchResponse> {
  const trimmed = (keyword || "").trim();
  if (!trimmed) {
    return { success: true, items: [], totalResults: 0 };
  }

  const appId = process.env.RAKUTEN_APP_ID;
  if (!appId) {
    return {
      success: false,
      items: [],
      error: "Rakuten API Key chưa được thiết lập. Quý khách vui lòng dán link trực tiếp.",
    };
  }

  try {
    const hits = Math.min(Math.max(limit, 1), 30);
    const url = new URL(RAKUTEN_ENDPOINT);
    url.searchParams.set("format", "json");
    url.searchParams.set("applicationId", appId);
    url.searchParams.set("keyword", trimmed);
    url.searchParams.set("hits", hits.toString());

    const res = await fetchFn(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 429) {
      return {
        success: false,
        items: [],
        isRateLimited: true,
        error: "Rakuten API tạm thời đạt giới hạn tần suất gọi. Vui lòng thử lại sau.",
      };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        success: false,
        items: [],
        error: `Rakuten API trả về mã lỗi HTTP ${res.status}: ${errText.slice(0, 100)}`,
      };
    }

    const data = await res.json();
    const rawItems: any[] = Array.isArray(data?.Items) ? data.Items : [];

    const items: ExternalProductSearchResult[] = [];
    for (const entry of rawItems) {
      const it = entry?.Item || entry;
      if (!it || !it.itemName || typeof it.itemPrice !== "number") continue;

      const imageUrl =
        Array.isArray(it.mediumImageUrls) && it.mediumImageUrls.length > 0
          ? it.mediumImageUrls[0]?.imageUrl || it.mediumImageUrls[0] || ""
          : "";

      items.push({
        id: String(it.itemCode || ""),
        name: String(it.itemName).trim(),
        priceJpy: Math.max(0, Math.round(it.itemPrice)),
        imageUrl: typeof imageUrl === "string" ? imageUrl : "",
        url: String(it.itemUrl || ""),
        shopName: String(it.shopName || "Rakuten Ichiba Store").trim(),
        marketplace: "RAKUTEN",
        quoteSource: "API_RAKUTEN",
      });
    }

    return {
      success: true,
      items,
      totalResults: Number(data?.count) || items.length,
    };
  } catch (err: any) {
    return {
      success: false,
      items: [],
      error: `Lỗi kết nối tới Rakuten: ${err?.message || "Timeout"}`,
    };
  }
}
