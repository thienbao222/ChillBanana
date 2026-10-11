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

    // Domain allowlist — only allow known Japanese e-commerce sites
    const ALLOWED_DOMAINS = [
      'amazon.co.jp', 'amazon.com',
      'mercari.com', 'jp.mercari.com',
      'rakuten.co.jp',
      'yahoo.co.jp', 'auctions.yahoo.co.jp',
      'uniqlo.com',
      'suruga-ya.jp',
      'biccamera.com',
      'yodobashi.com',
      'r.jina.ai', // Jina AI reader proxy
    ];

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL không hợp lệ.' }, { status: 400 });
    }

    // Block internal addresses (SSRF protection)
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.internal') ||
      hostname === '0.0.0.0'
    ) {
      return NextResponse.json({ error: 'URL không hợp lệ.' }, { status: 400 });
    }

    const isAllowed = ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Chỉ hỗ trợ link từ các sàn Nhật Bản: Amazon JP, Mercari, Rakuten, Yahoo JP, Uniqlo, Surugaya, Bic Camera.' },
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

    // 1. Thử cào dữ liệu qua Jina AI Reader chuyên dụng cho E-commerce
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
          title = titleMatch[1].replace(/\s*by\s*メルカリ/i, "").replace(/\s*\|\s*Amazon/i, "").trim();
        }

        // Trích xuất ảnh
        const imageMatch = text.match(/!\[.*?\]\((https?:\/\/.*?\.(?:png|jpg|jpeg|webp).*?)\)/i) ||
                           text.match(/Image:\s*(https?:\/\/.*?\.(?:png|jpg|jpeg|webp).*?)/i);
        if (imageMatch && imageMatch[1]) {
          imageUrl = imageMatch[1];
        }

        // Trích xuất giá tiền JPY
        const jpyMatch = text.match(/[¥￥]\s*([0-9,]+)/) || 
                         text.match(/([0-9,]+)\s*(?:円|JPY|jpy)/i) ||
                         text.match(/Price:\s*[¥￥]?\s*([0-9,]+)/i);

        if (jpyMatch && jpyMatch[1]) {
          const raw = parseInt(jpyMatch[1].replace(/,/g, ""), 10);
          if (raw > 50 && raw < 10000000) {
            priceJpy = raw;
          }
        }
      }
    } catch (jinaErr) {
      console.warn("Jina AI scrape attempt fallback:", jinaErr);
    }

    // 2. Fetch trực tiếp HTML với Browser Header chuẩn Nhật để bóc tách triệt để
    try {
      const directRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8,vi;q=0.7",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
      });

      if (directRes.ok) {
        const html = await directRes.text();

        // Bóc tách Tiêu đề sản phẩm
        if (!title || title.includes("Sản phẩm nội địa")) {
          const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
          const twitterTitle = html.match(/<meta\s+name=["']twitter:title["']\s+content=["'](.*?)["']/i);
          const tagTitle = html.match(/<title>(.*?)<\/title>/i);
          const rawT = (ogTitle && ogTitle[1]) || (twitterTitle && twitterTitle[1]) || (tagTitle && tagTitle[1]) || "";
          if (rawT) {
            title = rawT.replace(/\s*by\s*メルカリ/i, "").replace(/\s*\|\s*Amazon/i, "").trim();
          }
        }

        // Bóc tách Hình ảnh sản phẩm chất lượng cao
        if (!imageUrl || imageUrl.includes("unsplash")) {
          const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
          const twitterImage = html.match(/<meta\s+name=["']twitter:image["']\s+content=["'](.*?)["']/i);
          const mercariImage = html.match(/https:\/\/static\.mercdn\.net\/item\/detail\/orig\/photos\/[a-zA-Z0-9_]+\.(?:jpg|jpeg|png|webp)/i);
          if (ogImage && ogImage[1]) imageUrl = ogImage[1].trim();
          else if (twitterImage && twitterImage[1]) imageUrl = twitterImage[1].trim();
          else if (mercariImage) imageUrl = mercariImage[0];
        }

        // Bóc tách Giá tiền thực tế theo sàn
        // 2.1. Chuẩn Meta tag E-commerce: product:price:amount
        const metaPrice = html.match(/<meta\s+name=["']product:price:amount["']\s+content=["']([0-9.]+)["']/i) ||
                          html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([0-9.]+)["']/i);
        if (metaPrice && metaPrice[1]) {
          const p = parseInt(metaPrice[1], 10);
          if (p > 50) priceJpy = p;
        }

        // 2.2. JSON-LD Schema (Amazon, Mercari, Rakuten)
        if (!priceJpy) {
          const ldRegex = /<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
          let ldMatch;
          while ((ldMatch = ldRegex.exec(html)) !== null) {
            try {
              const parsed = JSON.parse(ldMatch[1]);
              const offers = parsed.offers || (parsed["@graph"] && parsed["@graph"].find((g: any) => g.offers)?.offers);
              if (offers) {
                const targetPrice = Array.isArray(offers) ? offers[0]?.price : offers?.price;
                if (targetPrice) {
                  const p = parseInt(targetPrice, 10);
                  if (p > 50) {
                    priceJpy = p;
                    break;
                  }
                }
              }
            } catch {}
          }
        }

        // 2.3. Amazon specific selectors
        if (!priceJpy) {
          const amazonWhole = html.match(/class=["']a-price-whole["']>([0-9,]+)/i);
          const offscreen = html.match(/class=["']a-offscreen["']>[¥￥$]?([0-9,.]+)/i);
          const jsonPrice = html.match(/"price"\s*:\s*"?([0-9.]+)"?/i);

          if (amazonWhole && amazonWhole[1]) {
            priceJpy = parseInt(amazonWhole[1].replace(/,/g, ""), 10);
          } else if (offscreen && offscreen[1]) {
            const val = parseFloat(offscreen[1].replace(/,/g, ""));
            const isUsd = offscreen[0].includes("$") || urlLower.includes("amazon.com") && !urlLower.includes("amazon.co.jp");
            priceJpy = isUsd ? Math.round(val * 155) : Math.round(val);
          } else if (jsonPrice && jsonPrice[1]) {
            const val = parseFloat(jsonPrice[1]);
            const isUsd = urlLower.includes("amazon.com") && !urlLower.includes("amazon.co.jp");
            priceJpy = isUsd ? Math.round(val * 155) : Math.round(val);
          }
        }
      }
    } catch (directErr) {
      console.warn("Direct fetch error:", directErr);
    }

    // 3. Tự động nhận diện Danh Mục dựa trên Tiêu Đề sản phẩm (Hỗ trợ tiếng Nhật, Anh, Việt)
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
      titleLower.includes("ポケモン") ||
      titleLower.includes("カード") ||
      titleLower.includes("トレカ") ||
      titleLower.includes("フィギュア") ||
      titleLower.includes("グッズ") ||
      titleLower.includes("コミック") ||
      titleLower.includes("アニメ") ||
      titleLower.includes("マンガ") ||
      titleLower.includes("アクリル") ||
      titleLower.includes("キーホルダー") ||
      titleLower.includes("ぬいぐるみ") ||
      titleLower.includes("缶バッジ") ||
      titleLower.includes("ブルーアーカイブ") ||
      titleLower.includes("mô hình") ||
      titleLower.includes("ステッカー") ||
      titleLower.includes("sticker") ||
      titleLower.includes("ホログラム") ||
      titleLower.includes("チェンソーマン") ||
      titleLower.includes("chainsaw") ||
      titleLower.includes("レゼ") ||
      titleLower.includes("card") ||
      titleLower.includes("thẻ bài") ||
      titleLower.includes("goods")
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
      titleLower.includes("điện tử") ||
      titleLower.includes("家電") ||
      titleLower.includes("シェーバー") ||
      titleLower.includes("ドライヤー") ||
      titleLower.includes("炊飯器") ||
      titleLower.includes("イヤホン") ||
      titleLower.includes("ヘッドホン")
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
      titleLower.includes("mỹ phẩm") ||
      titleLower.includes("化粧品") ||
      titleLower.includes("スキンケア") ||
      titleLower.includes("コスメ") ||
      titleLower.includes("クレンジング") ||
      titleLower.includes("ローション") ||
      titleLower.includes("日焼け止め") ||
      titleLower.includes("美容液") ||
      titleLower.includes("パック")
    ) {
      category = "cosmetics";
    } else if (
      titleLower.includes("tảo") ||
      titleLower.includes("orihiro") ||
      titleLower.includes("ginkgo") ||
      titleLower.includes("spirulina") ||
      titleLower.includes("collagen") ||
      titleLower.includes("bổ não") ||
      titleLower.includes("vitamin") ||
      titleLower.includes("サプリメント") ||
      titleLower.includes("サプリ") ||
      titleLower.includes("健康食品") ||
      titleLower.includes("青汁")
    ) {
      category = "health";
    }

    // Fallbacks an toàn
    if (!title) {
      title = `[${storeName}] Sản phẩm nội địa Nhật Bản`;
    }
    const priceDetected = typeof priceJpy === "number" && priceJpy > 0;
    if (!priceDetected) {
      priceJpy = 0;
    }
    if (!imageUrl) {
      imageUrl = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80";
    }

    return NextResponse.json({
      success: true,
      priceDetected,
      data: {
        storeName,
        title,
        priceJpy,
        priceDetected,
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
