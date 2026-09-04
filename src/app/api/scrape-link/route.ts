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
    if (urlLower.includes("amazon.co.jp") || urlLower.includes("amazon.com")) storeName = "Amazon";
    else if (urlLower.includes("mercari.com") || urlLower.includes("jp.mercari.com")) storeName = "Mercari JP";
    else if (urlLower.includes("rakuten.co.jp")) storeName = "Rakuten JP";
    else if (urlLower.includes("yahoo.co.jp")) storeName = "Yahoo JP";
    else if (urlLower.includes("uniqlo.com")) storeName = "Uniqlo JP";
    else if (urlLower.includes("suruga-ya.jp")) storeName = "Surugaya JP";
    else if (urlLower.includes("biccamera.com")) storeName = "Bic Camera JP";

    let title = "";
    let priceJpy = 0;
    let imageUrl = "";
    let category = "other";

    // 1. Thử cào dữ liệu qua Jina AI Reader chuyên dụng cho E-commerce (Không bị chặn bởi Bot Protection)
    try {
      const jinaResponse = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          "Accept": "text/plain",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        next: { revalidate: 1800 },
      });

      if (jinaResponse.ok) {
        const text = await jinaResponse.text();

        // Trích xuất Title từ dòng đầu của Jina
        const titleMatch = text.match(/Title:\s*(.+)/i) || text.match(/^#\s*(.+)/m);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
        }

        // Trích xuất ảnh
        const imageMatch = text.match(/!\[.*?\]\((https?:\/\/.*?\.(?:png|jpg|jpeg|webp).*?)\)/i) ||
                           text.match(/Image:\s*(https?:\/\/.*?\.(?:png|jpg|jpeg|webp).*?)/i);
        if (imageMatch && imageMatch[1]) {
          imageUrl = imageMatch[1];
        }

        // Trích xuất giá tiền JPY hoặc USD
        const jpyMatch = text.match(/[¥￥]\s*([0-9,]+)/) || 
                         text.match(/([0-9,]+)\s*(?:円|JPY|jpy)/i) ||
                         text.match(/Price:\s*[¥￥]?\s*([0-9,]+)/i);

        if (jpyMatch && jpyMatch[1]) {
          const raw = parseInt(jpyMatch[1].replace(/,/g, ""), 10);
          if (raw > 50 && raw < 10000000) {
            priceJpy = raw;
          }
        }

        // Nếu là USD ($) từ Amazon quốc tế -> quy đổi sang Yên (1 USD ≈ 155 JPY)
        if (!priceJpy) {
          const usdMatch = text.match(/\$\s*([0-9.]+)/) || text.match(/Price:\s*\$\s*([0-9.]+)/i);
          if (usdMatch && usdMatch[1]) {
            const usd = parseFloat(usdMatch[1]);
            if (usd > 0) {
              priceJpy = Math.round(usd * 155);
            }
          }
        }
      }
    } catch (jinaErr) {
      console.warn("Jina AI scrape attempt fallback:", jinaErr);
    }

    // 2. Nếu Jina chưa lấy đủ, fetch trực tiếp HTML với Browser Header
    if (!title || !priceJpy || !imageUrl) {
      try {
        const directRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8,vi;q=0.7",
          },
        });

        if (directRes.ok) {
          const html = await directRes.text();

          if (!title) {
            const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
            const tagTitle = html.match(/<title>(.*?)<\/title>/i);
            if (ogTitle && ogTitle[1]) title = ogTitle[1].trim();
            else if (tagTitle && tagTitle[1]) title = tagTitle[1].trim();
          }

          if (!imageUrl) {
            const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
            if (ogImage && ogImage[1]) imageUrl = ogImage[1].trim();
          }

          if (!priceJpy) {
            const amazonWhole = html.match(/class=["']a-price-whole["']>([0-9,]+)/i);
            const offscreen = html.match(/class=["']a-offscreen["']>[¥￥$]?([0-9,.]+)/i);
            const jsonPrice = html.match(/"price"\s*:\s*"?([0-9.]+)"?/i);

            if (amazonWhole && amazonWhole[1]) {
              priceJpy = parseInt(amazonWhole[1].replace(/,/g, ""), 10);
            } else if (offscreen && offscreen[1]) {
              const val = parseFloat(offscreen[1].replace(/,/g, ""));
              priceJpy = val < 500 ? Math.round(val * 155) : Math.round(val);
            } else if (jsonPrice && jsonPrice[1]) {
              const val = parseFloat(jsonPrice[1]);
              priceJpy = val < 500 ? Math.round(val * 155) : Math.round(val);
            }
          }
        }
      } catch (directErr) {
        console.warn("Direct fetch error:", directErr);
      }
    }

    // 3. Tự động nhận diện Danh Mục dựa trên Tiêu Đề sản phẩm
    const titleLower = (title || "").toLowerCase();
    if (
      titleLower.includes("gundam") ||
      titleLower.includes("figure") ||
      titleLower.includes("anime") ||
      titleLower.includes("manga") ||
      titleLower.includes("bandai") ||
      titleLower.includes("luffy") ||
      titleLower.includes("nendoroid") ||
      titleLower.includes("gunpla") ||
      titleLower.includes("pokemon") ||
      titleLower.includes("mô hình")
    ) {
      category = "anime";
    } else if (
      titleLower.includes("mouse") ||
      titleLower.includes("chuột") ||
      titleLower.includes("keyboard") ||
      titleLower.includes("bàn phím") ||
      titleLower.includes("gaming") ||
      titleLower.includes("panasonic") ||
      titleLower.includes("zojirushi") ||
      titleLower.includes("tiger") ||
      titleLower.includes("nồi cơm") ||
      titleLower.includes("máy cạo râu") ||
      titleLower.includes("tai nghe") ||
      titleLower.includes("sony") ||
      titleLower.includes("điện tử")
    ) {
      category = "gadgets";
    } else if (
      titleLower.includes("dhc") ||
      titleLower.includes("anessa") ||
      titleLower.includes("hada labo") ||
      titleLower.includes("shiseido") ||
      titleLower.includes("kem") ||
      titleLower.includes("son") ||
      titleLower.includes("tẩy trang") ||
      titleLower.includes("skincare") ||
      titleLower.includes("mỹ phẩm")
    ) {
      category = "cosmetics";
    } else if (
      titleLower.includes("tảo") ||
      titleLower.includes("orihiro") ||
      titleLower.includes("ginkgo") ||
      titleLower.includes("spirulina") ||
      titleLower.includes("collagen") ||
      titleLower.includes("bổ não") ||
      titleLower.includes("vitamin")
    ) {
      category = "health";
    }

    // Fallbacks an toàn
    if (!title) {
      title = `[${storeName}] Sản phẩm nội địa Nhật Bản`;
    }
    if (!priceJpy || priceJpy < 100) {
      priceJpy = 4500;
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
        category,
        url,
      },
    });
  } catch (error) {
    console.error("Scraper API Error:", error);
    return NextResponse.json(
      { error: "Lỗi xử lý đường dẫn." },
      { status: 500 }
    );
  }
}
