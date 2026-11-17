export interface ExternalProductSearchResult {
  id: string;
  name: string;
  priceJpy: number;
  imageUrl: string;
  url: string;
  shopName: string;
  marketplace: "RAKUTEN" | "YAHOO";
  quoteSource: "API_RAKUTEN" | "API_YAHOO";
}

export interface ExternalSearchResponse {
  success: boolean;
  items: ExternalProductSearchResult[];
  totalResults?: number;
  error?: string;
  isRateLimited?: boolean;
  creditHtml?: string;
}

