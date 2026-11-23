/**
 * ChillBanana 1-Click Shopping Bookmarklet
 * Nhấn dấu trang này khi đang ở trang sản phẩm Rakuten, Yahoo, Amazon JP, Mercari...
 * Dữ liệu được mã hóa an toàn và chuyển về https://chillbanana.vn/dat-hang/nhap
 */
(function () {
  try {
    var title = document.querySelector('meta[property="og:title"]')?.content ||
      document.querySelector('meta[name="twitter:title"]')?.content ||
      document.title || "";
    title = title.replace(/\s+/g, " ").trim();

    var image = document.querySelector('meta[property="og:image"]')?.content ||
      document.querySelector('meta[name="twitter:image"]')?.content || "";

    var url = window.location.href;

    var price = 0;
    // 1. Thử đọc JSON-LD
    var jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < jsonLdScripts.length; i++) {
      try {
        var parsed = JSON.parse(jsonLdScripts[i].innerText);
        var offers = parsed.offers || (parsed["@graph"] && parsed["@graph"].find(function (g) { return g.offers; })?.offers);
        if (offers) {
          var p = Array.isArray(offers) ? offers[0].price : offers.price;
          if (p && !isNaN(Number(p))) {
            price = Math.round(Number(p));
            break;
          }
        }
      } catch (e) {}
    }

    // 2. Thử meta tags
    if (!price) {
      var priceMeta = document.querySelector('meta[property="product:price:amount"]') ||
        document.querySelector('meta[name="twitter:data1"]');
      if (priceMeta && priceMeta.content) {
        var cleanP = priceMeta.content.replace(/[^\d]/g, "");
        if (cleanP) price = parseInt(cleanP, 10);
      }
    }

    // 3. Quét các thẻ giá phổ biến (Rakuten/Amazon)
    if (!price) {
      var priceEl = document.querySelector('.price, .item-price, #priceblock_ourprice, .a-price-whole, [data-testid="price"]');
      if (priceEl) {
        var text = priceEl.textContent || "";
        var match = text.replace(/[^\d]/g, "");
        if (match) price = parseInt(match, 10);
      }
    }

    var payload = {
      name: title,
      priceJpy: price,
      imageUrl: image,
      url: url,
      capturedAt: Date.now()
    };

    var encoded = encodeURIComponent(JSON.stringify(payload));
    var targetUrl = "https://chillbanana.vn/dat-hang/nhap#data=" + encoded;

    window.open(targetUrl, "_blank");
  } catch (err) {
    alert("Không thể trích xuất dữ liệu sản phẩm tự động. Vui lòng copy link sản phẩm và dán vào ChillBanana thủ công!");
  }
})();

