export interface OrderItemSourceInput {
  itemType?: string | null;
  productName?: string | null;
  name?: string | null;
  priceJpy?: number | null;
  weightKg?: number | null;
  quantity?: number | null;
  product?: {
    name?: string | null;
    imageUrl?: string | null;
    originalStore?: string | null;
  } | null;
}

export interface OrderSourceInput {
  originalUrl?: string | null;
}

export interface ParsedOrderItemSource {
  cleanName: string;
  url: string | null;
  marketplace: string;
  imageUrl: string | null;
  originalStore: string | null;
  itemType: "CATALOG" | "EXTERNAL";
  hasUrl: boolean;
}

export function inferMarketplaceFromUrl(url: string | null | undefined): string {
  if (!url) return "Sàn khác";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("amazon.co.jp") || host.includes("amazon.jp") || host === "amazon.com" || host.endsWith(".amazon.com")) {
      return "Amazon JP";
    }
    if (host.includes("mercari.com") || host.includes("mercari.jp")) {
      return "Mercari";
    }
    if (host.includes("rakuten.co.jp") || host.includes("rakuten.ne.jp")) {
      return "Rakuten";
    }
    if (host.includes("yahoo.co.jp")) {
      return "Yahoo!";
    }
    if (host.includes("uniqlo.com")) {
      return "Uniqlo";
    }
    if (host.includes("suruga-ya.jp") || host.includes("surugaya.")) {
      return "Surugaya";
    }
    if (host.includes("biccamera.com")) {
      return "Bic Camera";
    }
    if (host.includes("yodobashi.com")) {
      return "Yodobashi";
    }
    return "Sàn khác";
  } catch {
    return "Sàn khác";
  }
}

export function parseOrderItemSource(
  item?: OrderItemSourceInput | null,
  order?: OrderSourceInput | null
): ParsedOrderItemSource {
  const isCatalog = item?.itemType === "CATALOG";

  if (isCatalog) {
    const cleanName = (item?.product?.name || item?.productName || item?.name || "Sản phẩm Catalog").trim();
    const originalStore = item?.product?.originalStore?.trim() || null;
    const imageUrl = item?.product?.imageUrl?.trim() || null;
    return {
      cleanName,
      url: null,
      marketplace: originalStore || "Catalog",
      imageUrl,
      originalStore,
      itemType: "CATALOG",
      hasUrl: false,
    };
  }

  // EXTERNAL item
  const rawName = (item?.productName || item?.name || "").trim();
  let cleanName = rawName;
  let rawUrl: string | null = null;

  // Pattern: "Tên [https://...]"
  const match = rawName.match(/^(.*?)(?:\s*\[(https?:\/\/[^\]\s]+)\])?$/);
  if (match && match[2]) {
    cleanName = match[1].trim() || rawName;
    rawUrl = match[2].trim();
  } else {
    // Dự phòng bằng Order.originalUrl
    if (order?.originalUrl && typeof order.originalUrl === "string") {
      const trimmed = order.originalUrl.trim();
      if (/^https?:\/\//i.test(trimmed)) {
        rawUrl = trimmed;
      }
    }
  }

  const hasUrl = Boolean(rawUrl && /^https?:\/\//i.test(rawUrl));
  const url = hasUrl ? rawUrl : null;
  const marketplace = url ? inferMarketplaceFromUrl(url) : "Sàn khác";
  const imageUrl = item?.product?.imageUrl?.trim() || null;

  return {
    cleanName: cleanName || "Sản phẩm mua hộ",
    url,
    marketplace,
    imageUrl,
    originalStore: null,
    itemType: "EXTERNAL",
    hasUrl,
  };
}
