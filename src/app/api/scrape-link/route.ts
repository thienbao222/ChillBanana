import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đường dẫn URL hợp lệ." },
        { status: 400 }
      );
    }

    const urlLower = url.toLowerCase();
    let storeName = "Website Nhật Bản";
    if (urlLower.includes("amazon.co.jp")) storeName = "Amazon JP";
    else if (urlLower.includes("mercari.com")) storeName = "Mercari JP";
    else if (urlLower.includes("rakuten.co.jp")) storeName = "Rakuten JP";
    else if (urlLower.includes("yahoo.co.jp")) storeName = "Yahoo Auctions / Shopping";
    else if (urlLower.includes("uniqlo.com")) storeName = "Uniqlo JP";
    else if (urlLower.includes("suruga-ya.jp")) storeName = "Surugaya JP";
    else if (urlLower.includes("biccamera.com")) storeName = "Bic Camera JP";

    let title = "";
    let priceJpy = 0;
    let imageUrl = "";
    let description = "";

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8,vi;q=0.7",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        next: { revalidate: 3600 },
      });

      if (response.ok) {
        const html = await response.text();

        // 1. Extract OpenGraph Image
        const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i) ||
                             html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:image["']/i);
        if (ogImageMatch && ogImageMatch[1]) {
          imageUrl = ogImageMatch[1];
        }

        // 2. Extract OpenGraph Title or <title>
        const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) ||
                             html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:title["']/i);
        const titleTagMatch = html.match(/<title>(.*?)<\/title>/i);

        if (ogTitleMatch && ogTitleMatch[1]) {
          title = ogTitleMatch[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
        } else if (titleTagMatch && titleTagMatch[1]) {
          title = titleTagMatch[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
        }

        // 3. Extract OpenGraph Description
        const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i) ||
                            html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
        if (ogDescMatch && ogDescMatch[1]) {
          description = ogDescMatch[1].trim();
        }

        // 4. Tìm kiếm giá Yên (JPY) trong HTML
        // Patterns: class="a-price-whole">1,200</span>, or "price": 1200, or ¥1,200
        const amazonPriceMatch = html.match(/class=["']a-price-whole["']>([0-9,]+)/i);
        const jsonPriceMatch = html.match(/"price"\s*:\s*"?([0-9]+)"?/i);
        const yenSymbolMatch = html.match(/[¥￥]\s*([0-9,]{3,7})/i) || html.match(/([0-9,]{3,7})\s*円/i);

        if (amazonPriceMatch && amazonPriceMatch[1]) {
          priceJpy = parseInt(amazonPriceMatch[1].replace(/,/g, ""), 10);
        } else if (jsonPriceMatch && jsonPriceMatch[1]) {
          priceJpy = parseInt(jsonPriceMatch[1], 10);
        } else if (yenSymbolMatch && yenSymbolMatch[1]) {
          priceJpy = parseInt(yenSymbolMatch[1].replace(/,/g, ""), 10);
        }
      }
    } catch (fetchErr) {
      console.warn("Direct scraping encountered challenge, falling back to smart heuristic:", fetchErr);
    }

    // Default Fallbacks if page is heavily bot-protected
    if (!title) {
      const cleanUrl = url.split("?")[0];
      const segments = cleanUrl.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1] || "Sản phẩm";
      title = decodeURIComponent(lastSegment).replace(/[-_]/g, " ");
      if (title.length > 50) title = title.substring(0, 50) + "...";
      title = `[${storeName}] ${title}`;
    }

    if (!priceJpy || priceJpy < 100) {
      // Gợi ý mức giá hợp lý mặc định nếu không bóc tách được
      priceJpy = 3200;
    }

    if (!imageUrl) {
      imageUrl = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80";
    }

    return NextResponse.json({
      success: true,
      data: {
        storeName,
        title,
        priceJpy,
        imageUrl,
        description,
        url,
      },
    });
  } catch (error) {
    console.error("Scraper API Error:", error);
    return NextResponse.json(
      { error: "Không thể lấy thông tin từ đường dẫn này." },
      { status: 500 }
    );
  }
}
