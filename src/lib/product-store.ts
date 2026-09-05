import { CuratedProduct } from "@/types";
import { CURATED_PRODUCTS, DEFAULT_EXCHANGE_RATE } from "./data";

const globalForProducts = global as unknown as { productsStore: CuratedProduct[] };
export const productsStore: CuratedProduct[] = globalForProducts.productsStore || [...CURATED_PRODUCTS];
if (process.env.NODE_ENV !== "production") globalForProducts.productsStore = productsStore;

export function getAllProducts(): CuratedProduct[] {
  return productsStore;
}

export function createProduct(data: Partial<CuratedProduct>): CuratedProduct {
  const priceJpy = Number(data.priceJpy) || 3000;
  const priceVnd = Math.round(priceJpy * DEFAULT_EXCHANGE_RATE);
  const slug = (data.name || "san-pham-moi")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") + "-" + Math.floor(100 + Math.random() * 900);

  const categoryNames: Record<string, string> = {
    cosmetics: "Mỹ Phẩm & Chăm Sóc Da",
    health: "Thực Phẩm Chức Năng",
    gadgets: "Gia Dụng & Điện Tử Mini",
    anime: "Anime, Manga & Sưu Tầm",
  };

  const newProduct: CuratedProduct = {
    id: "prod-" + Date.now(),
    name: data.name || "Sản phẩm nội địa Nhật",
    slug,
    category: (data.category as any) || "cosmetics",
    categoryName: categoryNames[data.category || ""] || "Hàng Nội Địa Nhật",
    priceJpy,
    priceVnd,
    weightKg: Number(data.weightKg) || 0.4,
    imageUrl: data.imageUrl || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
    description: data.description || "Sản phẩm chính hãng nội địa Nhật Bản.",
    originalStore: data.originalStore || "Amazon JP",
    stockSlots: Number(data.stockSlots) || 10,
    isHot: !!data.isHot,
    featuredNote: data.featuredNote || "",
    voltageNote: data.voltageNote || (data.category === "gadgets" ? "Điện áp 100V - Cần dùng biến áp đổi nguồn" : undefined),
  };

  productsStore.unshift(newProduct);
  return newProduct;
}

export function updateProduct(id: string, data: Partial<CuratedProduct>): CuratedProduct | null {
  const index = productsStore.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const existing = productsStore[index];
  const priceJpy = data.priceJpy !== undefined ? Number(data.priceJpy) : existing.priceJpy;
  const priceVnd = Math.round(priceJpy * DEFAULT_EXCHANGE_RATE);

  const categoryNames: Record<string, string> = {
    cosmetics: "Mỹ Phẩm & Chăm Sóc Da",
    health: "Thực Phẩm Chức Năng",
    gadgets: "Gia Dụng & Điện Tử Mini",
    anime: "Anime, Manga & Sưu Tầm",
  };

  const updated: CuratedProduct = {
    ...existing,
    ...data,
    priceJpy,
    priceVnd,
    categoryName: data.category ? (categoryNames[data.category] || existing.categoryName) : existing.categoryName,
  };

  productsStore[index] = updated;
  return updated;
}

export function deleteProduct(id: string): boolean {
  const index = productsStore.findIndex((p) => p.id === id);
  if (index === -1) return false;
  productsStore.splice(index, 1);
  return true;
}
