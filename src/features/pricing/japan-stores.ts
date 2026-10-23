// Danh mục 8 sàn thương mại điện tử Nhật Bản được ChillBanana hỗ trợ bóc tách link & tính giá trọn gói
// Kèm link trang chủ chính thức và link sản phẩm mẫu thực tế để phục vụ test / demo một chạm.

export interface JapanStoreInfo {
  id: string;
  name: string;
  shortName: string;
  homeUrl: string;
  sampleUrl: string;
  sampleProductTitle: string;
  sampleProductTitleJp?: string;
  samplePriceJpy: number;
  category: "cosmetics" | "health" | "gadgets" | "anime" | "fashion" | "food" | "luxury" | "other";
  categoryBreadcrumb: string;
  sampleImageUrl: string;
  is100v?: boolean;
  description?: string;
}

export const JAPAN_SUPPORTED_STORES: JapanStoreInfo[] = [
  {
    id: "amazon",
    name: "Amazon JP",
    shortName: "Amazon",
    homeUrl: "https://www.amazon.co.jp",
    sampleUrl: "https://www.amazon.co.jp/dp/B09V3KXJPB",
    sampleProductTitle: "Kem chống nắng Anessa Perfect UV Skincare Milk 60ml SPF50+ PA++++",
    sampleProductTitleJp: "アネッサ パーフェクトUV スキンケアミルク N 60mL 日焼け止め",
    samplePriceJpy: 2680,
    category: "cosmetics",
    categoryBreadcrumb: "ビューティー > スキンケア・基礎化粧品 > 日焼け止め > ボディ・フェイス用",
    sampleImageUrl: "https://m.media-amazon.com/images/I/61KjZ67E-vL._AC_SL1200_.jpg",
  },
  {
    id: "mercari",
    name: "Mercari",
    shortName: "Mercari",
    homeUrl: "https://jp.mercari.com",
    sampleUrl: "https://jp.mercari.com/item/m789012345",
    sampleProductTitle: "Mô hình Bandai RG 1/144 RX-78-2 Gundam Ver.2.0 Gunpla Nhật Bản",
    sampleProductTitleJp: "RG 1/144 RX-78-2 ガンダム Ver.2.0 バンダイ ガンプラ",
    samplePriceJpy: 3850,
    category: "anime",
    categoryBreadcrumb: "おもちゃ・ホビー・グッズ > おもちゃ > プラモデル > ガンプラ",
    sampleImageUrl: "https://static.mercdn.net/item/detail/orig/photos/m789012345_1.jpg",
  },
  {
    id: "rakuten",
    name: "Rakuten",
    shortName: "Rakuten",
    homeUrl: "https://www.rakuten.co.jp",
    sampleUrl: "https://item.rakuten.co.jp/kanebo/allie-chrono-beauty/",
    sampleProductTitle: "Gel chống nắng Kanebo ALLIE Chrono Beauty Facial Gel UV EX 60g",
    sampleProductTitleJp: "カネボウ アリィー クロノビューティ フェイシャルジェル UV EX 60g",
    samplePriceJpy: 2310,
    category: "cosmetics",
    categoryBreadcrumb: "美容・コスメ・香水 > 日焼け止め・UVケア > フェイス用日焼け止め",
    sampleImageUrl: "https://image.rakuten.co.jp/kanebo/cabinet/allie/allie_chrono_01.jpg",
  },
  {
    id: "yahoo-auctions",
    name: "Yahoo! Auctions",
    shortName: "Yahoo!",
    homeUrl: "https://auctions.yahoo.co.jp",
    sampleUrl: "https://page.auctions.yahoo.co.jp/jp/auction/m1098765432",
    sampleProductTitle: "Đồng hồ cơ Seiko 5 Automatic Mặt Đen SNXS79J1 Made in Japan",
    sampleProductTitleJp: "セイコー SEIKO 5 自動巻き 腕時計 SNXS79J1 日本製 メンズ",
    samplePriceJpy: 18500,
    category: "luxury",
    categoryBreadcrumb: "アクセサリー、時計 > メンズ腕時計 > アナログ（自動巻き） > セイコー",
    sampleImageUrl: "https://auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc01/item1098765432_1.jpg",
  },
  {
    id: "uniqlo",
    name: "Uniqlo JP",
    shortName: "Uniqlo",
    homeUrl: "https://www.uniqlo.com/jp/ja/",
    sampleUrl: "https://www.uniqlo.com/jp/ja/products/E467144-000/00",
    sampleProductTitle: "Áo khoác Uniqlo AIRism Chống Nắng UV Cut Mesh Full-Zip Hoodie (Dài tay)",
    sampleProductTitleJp: "エアリズムUVカットメッシュパーカ（長袖）ユニクロ",
    samplePriceJpy: 2990,
    category: "fashion",
    categoryBreadcrumb: "WOMEN > トップス > パーカー・スウェット > UVカット",
    sampleImageUrl: "https://image.uniqlo.com/UQ/ST3/AsianCommon/imagesgoods/467144/item/goods_69_467144.jpg",
  },
  {
    id: "surugaya",
    name: "Surugaya (駿河屋)",
    shortName: "駿河屋",
    homeUrl: "https://www.suruga-ya.jp",
    sampleUrl: "https://www.suruga-ya.jp/product/detail/602123456",
    sampleProductTitle: "Figure Nendoroid Hatsune Miku 2.0 Good Smile Company Hàng Nội Địa",
    sampleProductTitleJp: "ねんどろいど 初音ミク 2.0 「キャラクター・ボーカル・シリーズ01 初音ミク」",
    samplePriceJpy: 5500,
    category: "anime",
    categoryBreadcrumb: "ホビー・おもちゃ > フィギュア > ねんどろいど > 初音ミク",
    sampleImageUrl: "https://www.suruga-ya.jp/database/pics/game/602123456.jpg",
  },
  {
    id: "biccamera",
    name: "Bic Camera",
    shortName: "Bic Camera",
    homeUrl: "https://www.biccamera.com",
    sampleUrl: "https://www.biccamera.com/bc/item/10892345/",
    sampleProductTitle: "Ấm đun nước siêu tốc T-fal Safe'Tea 1.0L Chống Bỏng Nước Nóng 100V",
    sampleProductTitleJp: "ティファール 電気ケトル セーフ・トゥ・タッチ ホワイト 1.0L KO2611JP 100V",
    samplePriceJpy: 4280,
    category: "gadgets",
    categoryBreadcrumb: "生活家電・キッチン家電 > 電気ケトル・ポット > 電気ケトル > T-fal",
    sampleImageUrl: "https://image.biccamera.com/img/000000010892345_A01.jpg",
    is100v: true,
  },
  {
    id: "yodobashi",
    name: "Yodobashi",
    shortName: "Yodobashi",
    homeUrl: "https://www.yodobashi.com",
    sampleUrl: "https://www.yodobashi.com/product/100000001006543210/",
    sampleProductTitle: "Nồi cơm điện cao tần Zojirushi IH 1.0L (5.5 Hợp) Stan Series NW-SA10-BA 100V",
    sampleProductTitleJp: "象印 ZOJIRUSHI NW-SA10-BA IH炊飯ジャー STAN. 5.5合炊き ブラック 100V",
    samplePriceJpy: 24800,
    category: "gadgets",
    categoryBreadcrumb: "調理家電 > 炊飯器 > IH炊飯ジャー > 象印 ZOJIRUSHI",
    sampleImageUrl: "https://image.yodobashi.com/product/100/000/001/006/543/210/100000001006543210_10204.jpg",
    is100v: true,
  },
];

export const JAPAN_STORE_SAMPLES: Record<string, string> = Object.fromEntries(
  JAPAN_SUPPORTED_STORES.map((s) => [s.name, s.sampleUrl])
);

export function findSampleProductByUrl(url: string): JapanStoreInfo | undefined {
  if (!url) return undefined;
  const norm = url.trim().toLowerCase();
  return JAPAN_SUPPORTED_STORES.find((store) => {
    const sNorm = store.sampleUrl.toLowerCase();
    return norm === sNorm || norm.startsWith(sNorm) || sNorm.startsWith(norm);
  });
}
