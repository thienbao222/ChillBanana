const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "../..");

function loadTypeScript(relativePath, overrides = {}) {
  const filename = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (specifier) => Object.hasOwn(overrides, specifier)
    ? overrides[specifier]
    : originalRequire(specifier);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const policy = loadTypeScript("src/features/ai/customer/support-policy.ts");
const imageCatalogMatcher = loadTypeScript("src/features/ai/customer/image-catalog-matcher.ts");
const orderPolicy = loadTypeScript("src/features/orders/policy.ts");
const pricing = loadTypeScript("src/features/pricing/calculator.ts", {
  "@/features/orders/policy": orderPolicy,
});

const search = "Bạn gợi ý kem chống nắng Anessa giúp mình";
const intents = policy.detectSupportIntents(search);
assert.equal(intents.catalog, true, "product advice should call catalog search");
assert.equal(intents.category, "cosmetics", "skincare query should map to the cosmetics category");
assert.ok(policy.extractCatalogSearchTerms(search).some((term) => term.toLowerCase() === "anessa"));

const orderQuery = "Tình trạng đơn CB-2026-AB12-78136 của tôi?";
assert.equal(policy.detectSupportIntents(orderQuery).orderStatus, true);
assert.equal(policy.detectSupportIntents(orderQuery).orderCode, "CB-2026-AB12-78136");
assert.equal(policy.isValidOrderCode("CB-2026-AB12-78136"), true);
assert.equal(policy.isValidOrderCode("CB-2026-AB12-78"), false);
assert.equal(policy.canReadOrder("customer-a", "customer-b", false), false, "another customer's order must be restricted");
assert.equal(policy.canReadOrder("customer-a", "customer-a", false), true, "the matching account can read its order");
assert.equal(policy.canReadOrder(null, null, true), true, "a verified guest link can read its order");

assert.equal(policy.isSupportedMarketplaceUrl("https://www.amazon.co.jp/dp/example"), true);
assert.equal(policy.isSupportedMarketplaceUrl("http://amazon.co.jp/item"), false);
assert.equal(policy.isSupportedMarketplaceUrl("https://amazon.co.jp.evil.example/item"), false);
assert.equal(policy.isSupportedMarketplaceUrl("https://user:pass@amazon.co.jp/item"), false);
assert.equal(policy.isValidQuotePrice(2680), true);
assert.equal(policy.isValidQuotePrice("2680"), false, "client-supplied string prices are not accepted as typed quote values");
assert.equal(policy.isValidQuotePrice(0), false);
assert.equal(policy.isValidQuotePrice(1_000_000_001), false);

const quote = pricing.calculateOrderPrice(2680, 0, 172, false);
assert.equal(quote.productPriceVnd, 460_960);
assert.equal(quote.serviceFeeVnd, 20_000);
assert.equal(quote.baseOrderCostVnd, 480_960);
assert.equal(quote.deposit50Vnd, 240_480);
assert.equal(quote.shippingFeeVnd, 0, "the canonical calculator does not invent shipping without weight");
const groupBuyAtLimit = pricing.calculateOrderPrice(10_000, 0.5, 172, true);
const groupBuyOverLimit = pricing.calculateOrderPrice(10_000, 0.5001, 172, true);
assert.equal(groupBuyAtLimit.shippingFeeVnd, Math.round(0.5 * 185_000 * (1 - pricing.GROUP_BUY_SHIPPING_DISCOUNT_RATE)));
assert.equal(groupBuyOverLimit.shippingFeeVnd, Math.round(0.5001 * 185_000));

const slotLabel = policy.getRequestSlotLabel(3);
assert.match(slotLabel, /suất tiếp nhận yêu cầu mua hộ/i);
assert.doesNotMatch(slotLabel, /tồn kho|còn hàng/i, "request slots must not be described as physical inventory");
assert.match(policy.getRequestSlotLabel(0), /chưa có suất/i);

assert.ok(policy.CUSTOMER_SUPPORT_TOOL_REGISTRY.every((tool) => tool.access === "read-only"));
const assistantSource = fs.readFileSync(path.join(projectRoot, "src/features/ai/customer/assistant.ts"), "utf8");
assert.match(assistantSource, /không tuyên bố đã reverse-image-search/i);
assert.match(assistantSource, /không khẳng định đúng model/i);

const imageCandidates = [
  {
    name: "Anessa Perfect UV Skincare Milk",
    categoryName: "Mỹ phẩm & Chăm sóc da",
    priceJpy: 2680,
    description: "Kem chống nắng Anessa dùng hằng ngày",
  },
  {
    name: "Anessa Perfect UV Compact",
    categoryName: "Mỹ phẩm & Chăm sóc da",
    priceJpy: 2200,
    description: "Phấn nền chống nắng Anessa",
  },
  {
    name: "Gundam RX-78 Figure",
    categoryName: "Anime, Manga & Sưu tầm",
    priceJpy: 3200,
    description: "Mô hình lắp ráp",
  },
];
const imageAnalysis = { nameVi: "Kem chống nắng Anessa Perfect UV", searchKeywords: ["アネッサ パーフェクトUV"] };
const rankedImageCandidates = imageCatalogMatcher.rankImageCatalogCandidates(imageCandidates, imageAnalysis);
assert.equal(rankedImageCandidates[0].name, "Anessa Perfect UV Skincare Milk", "the closest internal catalog title should rank first");
assert.ok(rankedImageCandidates.length <= 3);
assert.deepEqual(imageCatalogMatcher.rankImageCatalogCandidates(imageCandidates, { nameVi: "Sản phẩm Nhật" }), [], "generic category language must not return arbitrary catalog rows");
assert.ok(imageCatalogMatcher.getImageCatalogSearchTerms(imageAnalysis).length <= 12, "image lookup terms must stay bounded");

const imageChatSource = fs.readFileSync(path.join(projectRoot, "src/features/ai/customer/AIChatBot.tsx"), "utf8");
assert.match(imageChatSource, /Gợi ý gần trong danh mục ChillBanana/);
assert.match(imageChatSource, /chưa xác nhận đúng sản phẩm/);
assert.doesNotMatch(imageChatSource, /SMART SEARCH TỪ ẢNH/);

async function evaluateReadOnlyTools() {
  const orderCode = "CB-2026-AB12-78136";
  const product = {
    id: "eval-product",
    name: "Anessa Perfect UV Skincare Milk",
    category: "cosmetics",
    categoryName: "Mỹ phẩm",
    priceJpy: 2680,
    weightKg: 0.4,
    stockSlots: 3,
    description: "Kem chống nắng Anessa dùng hằng ngày",
    voltageNote: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const order = {
    orderCode,
    productName: "Anessa Perfect UV Skincare Milk",
    status: "IN_TRANSIT_AIR",
    customerId: "customer-owner",
    customerEmail: "owner@example.com",
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    trackingLogs: [{ title: "Đang vận chuyển quốc tế", createdAt: new Date("2026-01-02T00:00:00.000Z") }],
  };
  const mockPrisma = {
    product: { findMany: async () => [product] },
    order: { findUnique: async ({ where }) => where.orderCode === orderCode ? order : null },
  };
  const currentRate = {
    rate: 172,
    roundedRate: 172,
    previousRate: 172,
    changePercent: 0,
    updatedAt: "2026-01-02T00:00:00.000Z",
    source: "evaluation fixture",
    isFallback: false,
    isStale: false,
  };
  const tools = loadTypeScript("src/features/ai/customer/support-tools.ts", {
    "./support-policy": policy,
    "@/lib/prisma": { prisma: mockPrisma },
    "@/features/pricing/calculator": pricing,
    "@/features/pricing/config": {
      getCurrentPricingConfig: async () => ({
        version: 0,
        values: pricing.DEFAULT_PRICING_CONFIG,
        changedBy: "eval",
        changeReason: null,
        createdAt: new Date(0),
      }),
    },
    "@/features/orders/policy": orderPolicy,
    "@/features/pricing/exchange-rate": { fetchLiveExchangeRate: async () => currentRate },
    "@/lib/auth-session": {
      verifyGuestOrderAccessToken: (token) => token === "valid-guest"
        ? { orderCode, emailDigest: "a".repeat(64), exp: Date.now() + 60_000 }
        : null,
      hasGuestOrderAccessForEmail: (token, code, email) =>
        token === "valid-guest" && code === orderCode && email === "owner@example.com",
    },
  });

  const catalogRun = await tools.runCustomerSupportTools({
    message: "Gợi ý kem chống nắng Anessa",
    customerId: null,
    guestOrderAccessToken: null,
    scrapedProduct: null,
  });
  const catalog = catalogRun.evidence.find((item) => item.toolId === "catalog_search");
  assert.equal(catalog.status, "ok");
  assert.equal(catalog.known.products[0].requestSlots, 3);
  assert.match(catalog.known.products[0].requestSlotLabel, /suất tiếp nhận yêu cầu mua hộ/i);
  assert.equal(catalog.known.products[0].estimatedQuote.usesEstimatedCatalogWeight, true);
  assert.equal(catalog.known.products[0].estimatedQuote.finalQuote, false);

  const quoteRun = await tools.runCustomerSupportTools({
    message: "Tính giá sản phẩm này giúp mình",
    customerId: null,
    guestOrderAccessToken: null,
    scrapedProduct: { title: "Test Product", priceJpy: 2680, url: "https://www.amazon.co.jp/dp/example" },
  });
  assert.equal(quoteRun.evidence.find((item) => item.toolId === "quote_estimate").status, "ok");
  assert.match(quoteRun.guardedReply, /ước tính/i);
  assert.match(quoteRun.quoteFooter, /480\.960/);
  assert.match(quoteRun.quoteFooter, /chưa có cân nặng thực tế/i);
  assert.equal(quoteRun.sources.some((source) => source.href.startsWith("/?url=")), true);

  const missingPriceRun = await tools.runCustomerSupportTools({
    message: "Báo giá sản phẩm giúp mình",
    customerId: null,
    guestOrderAccessToken: null,
    scrapedProduct: null,
  });
  assert.equal(missingPriceRun.evidence.find((item) => item.toolId === "quote_estimate").status, "needs_input");
  assert.match(missingPriceRun.guardedReply, /gửi liên kết/i);

  const unauthorized = await tools.runCustomerSupportTools({
    message: `Tình trạng đơn ${orderCode}`,
    customerId: "customer-other",
    guestOrderAccessToken: null,
    scrapedProduct: null,
  });
  assert.equal(unauthorized.evidence.find((item) => item.toolId === "order_status").status, "restricted");
  assert.doesNotMatch(unauthorized.guardedReply, /Anessa|vận chuyển quốc tế/i);
  assert.equal(unauthorized.guardedReply.includes(orderCode), false);

  const owner = await tools.runCustomerSupportTools({
    message: `Tình trạng đơn ${orderCode}`,
    customerId: "customer-owner",
    guestOrderAccessToken: null,
    scrapedProduct: null,
  });
  assert.equal(owner.evidence.find((item) => item.toolId === "order_status").status, "ok");
  assert.match(owner.guardedReply, /vận chuyển quốc tế/i);
  assert.match(owner.guardedReply, new RegExp(orderCode));

  const guest = await tools.runCustomerSupportTools({
    message: `Tình trạng đơn ${orderCode}`,
    customerId: null,
    guestOrderAccessToken: "valid-guest",
    scrapedProduct: null,
  });
  assert.equal(guest.evidence.find((item) => item.toolId === "order_status").status, "ok");

  assert.deepEqual(Object.keys(mockPrisma.product), ["findMany"], "customer tools expose no catalog write method");
  assert.deepEqual(Object.keys(mockPrisma.order), ["findUnique"], "customer tools expose no order write method");
}

async function evaluateImageAnalysisRoute() {
  const catalogProduct = {
    name: "Anessa Perfect UV Skincare Milk",
    categoryName: "Mỹ phẩm & Chăm sóc da",
    priceJpy: 2680,
    description: "Kem chống nắng Anessa dùng hằng ngày",
  };
  let catalogBehavior = "matched";
  let catalogQueries = 0;
  let lastQuery;
  const route = loadTypeScript("src/app/api/ai/image-analyze/route.ts", {
    "next/server": {
      NextResponse: {
        json: (payload, init = {}) => ({ status: init.status || 200, json: async () => payload }),
      },
    },
    "@/lib/api-key-manager": { visionKeyPool: { getNextKey: () => "eval-key", markError: () => {} } },
    "@/lib/rate-limit": {
      checkAndRecordHit: async () => 0,
      getClientIp: () => "127.0.0.1",
    },
    "@/lib/gemini-models": {
      GEMINI_MODELS: {
        neo: "gemini-3.5-flash",
        neoFallback: "gemini-3.1-flash-lite",
        lightweight: "gemini-3.5-flash-lite",
        vision: "gemini-3.5-flash",
        admin: "gemini-3.5-flash",
      },
    },
    "@/lib/prisma": {
      prisma: {
        product: {
          findMany: async (query) => {
            catalogQueries += 1;
            lastQuery = query;
            if (catalogBehavior === "unavailable") throw new Error("mock unavailable");
            return catalogBehavior === "matched" ? [catalogProduct] : [];
          },
        },
      },
    },
    "@/features/ai/customer/image-catalog-matcher": imageCatalogMatcher,
  });

  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        nameVi: "Kem chống nắng Anessa Perfect UV",
        nameJp: "アネッサ パーフェクトUV",
        visiblePriceJpy: null,
        category: "cosmetics",
        voltageWarning: false,
        riskNotes: "Không thể xác thực sản phẩm chỉ từ ảnh.",
        searchKeywords: ["アネッサ パーフェクトUV"],
        description: "Nhận diện sơ bộ từ ảnh.",
      }) }] } }] }),
    });

    const request = (ip) => ({
      headers: { get: (name) => name === "x-forwarded-for" ? ip : null },
      json: async () => ({ imageData: "data:image/png;base64,YWJj", question: "Tìm giúp" }),
    });
    const matchedResponse = await route.POST(request("eval-matched"));
    const matched = await matchedResponse.json();
    assert.equal(matchedResponse.status, 200);
    assert.equal(matched.analysis.catalogMatches.status, "matched");
    assert.equal(matched.analysis.catalogMatches.products[0].name, catalogProduct.name);
    assert.equal(lastQuery.take, 60, "the catalog scan should be bounded");
    assert.deepEqual(Object.keys(lastQuery.select), ["name", "categoryName", "priceJpy", "description"]);

    catalogBehavior = "no-match";
    const noMatch = await (await route.POST(request("eval-no-match"))).json();
    assert.equal(noMatch.analysis.catalogMatches.status, "no_match");
    assert.deepEqual(noMatch.analysis.catalogMatches.products, []);

    catalogBehavior = "unavailable";
    const unavailable = await (await route.POST(request("eval-unavailable"))).json();
    assert.equal(unavailable.analysis.catalogMatches.status, "unavailable");
    assert.deepEqual(unavailable.analysis.catalogMatches.products, []);
    assert.equal(catalogQueries, 3);
  } finally {
    global.fetch = originalFetch;
  }
}

evaluateReadOnlyTools().then(evaluateImageAnalysisRoute).then(() => {
  console.log("Customer support evaluations passed: intents, ownership, catalog and quote tools, pricing, image-to-catalog ranking, bounded/read-only database lookup, and match/no-match/unavailable states.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
