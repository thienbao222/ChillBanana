import { ExternalSearchResponse, ExternalProductSearchResult } from "./types";

const YAHOO_ENDPOINT = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch";

export async function searchYahooShopping(
  keyword: string,
  limit = 20,
  fetchFn: typeof fetch = fetch
): Promise<ExternalSearchResponse> {
  const trimmed = (keyword || "").trim();
  if (!trimmed) {
    return {
      success: true,
      items: [],
      totalResults: 0,
      creditHtml: '<a href="https://developer.yahoo.co.jp/sitemap/">Web Services by Yahoo! JAPAN</a>',
    };
  }

  const clientId = process.env.YAHOO_CLIENT_ID;
  if (!clientId) {
    return {
      success: false,
      items: [],
      error: "Yahoo! Shopping Client ID chưa được thiết lập. Quý khách vui lòng dán link trực tiếp.",
      creditHtml: '<a href="https://developer.yahoo.co.jp/sitemap/">Web Services by Yahoo! JAPAN</a>',
    };
  }

  try {
    const results = Math.min(Math.max(limit, 1), 30);
    const url = new URL(YAHOO_ENDPOINT);
    url.searchParams.set("appid", clientId);
    url.searchParams.set("query", trimmed);
    url.searchParams.set("results", results.toString());

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
        error: "Yahoo! Shopping API tạm thời đạt giới hạn tần suất gọi. Vui lòng thử lại sau.",
        creditHtml: '<a href="https://developer.yahoo.co.jp/sitemap/">Web Services by Yahoo! JAPAN</a>',
      };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        success: false,
        items: [],
        error: `Yahoo! Shopping API trả về mã lỗi HTTP ${res.status}: ${errText.slice(0, 100)}`,
        creditHtml: '<a href="https://developer.yahoo.co.jp/sitemap/">Web Services by Yahoo! JAPAN</a>',
      };
    }

    const data = await res.json();
    const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];

    const items: ExternalProductSearchResult[] = [];
    for (const hit of hits) {
      if (!hit || !hit.name || typeof hit.price !== "number") continue;

      const imageUrl = hit.image?.medium || hit.image?.small || "";

      items.push({
        id: String(hit.code || ""),
        name: String(hit.name).trim(),
        priceJpy: Math.max(0, Math.round(hit.price)),
        imageUrl: typeof imageUrl === "string" ? imageUrl : "",
        url: String(hit.url || ""),
        shopName: String(hit.seller?.name || "Yahoo! Shopping Store").trim(),
        marketplace: "YAHOO",
        quoteSource: "API_YAHOO",
      });
    }

    return {
      success: true,
      items,
      totalResults: Number(data?.totalResultsAvailable) || items.length,
      creditHtml: '<a href="https://developer.yahoo.co.jp/sitemap/">Web Services by Yahoo! JAPAN</a>',
    };
  } catch (err: any) {
    return {
      success: false,
      items: [],
      error: `Lỗi kết nối tới Yahoo! Shopping: ${err?.message || "Timeout"}`,
      creditHtml: '<a href="https://developer.yahoo.co.jp/sitemap/">Web Services by Yahoo! JAPAN</a>',
    };
  }
}
