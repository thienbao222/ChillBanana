"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/data";
import { DEFAULT_PRICING_CONFIG, type PricingConfigValues } from "@/features/pricing/calculator";
import { useToast } from "@/context/ToastContext";

export type DepositOption = 50 | 100;

export function isSingleItemStore(storeName?: string): boolean {
  if (!storeName) return false;
  const s = storeName.toLowerCase();
  return s.includes("mercari") || s.includes("yahoo auction") || s.includes("dau gia") || s.includes("đấu giá");
}

export interface CartItem {
  id: string;
  name: string;
  priceJpy: number;
  priceVnd: number;
  weightKg: number;
  imageUrl: string;
  originalStore: string;
  originalUrl?: string;
  category?: string;
  stockSlots?: number;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: Omit<CartItem, "quantity">, quantity?: number) => boolean;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  exchangeRate: number;
  isRateStale: boolean;
  pricingConfig: PricingConfigValues;
  pricingConfigVersion: number;
  totalItems: number;
  totalPriceJpy: number;
  totalProductPriceVnd: number;
  totalWeightKg: number;
  shippingFeeVnd: number;
  serviceFeeVnd: number;
  isMinServiceFeeApplied: boolean;
  baseOrderCostVnd: number;
  totalVnd: number;
  depositOption: DepositOption;
  setDepositOption: (option: DepositOption) => void;
  depositPercent: DepositOption;
  setDepositPercent: (percent: DepositOption) => void;
  isShippingWeightPending: boolean;
  deposit50Vnd: number;
  depositAmountVnd: number;
  remainingAmountVnd: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);
  const [isRateStale, setIsRateStale] = useState<boolean>(false);
  const [pricingConfig, setPricingConfig] = useState<PricingConfigValues>(DEFAULT_PRICING_CONFIG);
  const [pricingConfigVersion, setPricingConfigVersion] = useState(0);
  const [depositOption, setDepositOption] = useState<DepositOption>(50);

  // Lấy tỷ giá thực tế live từ API
  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.roundedRate) {
          setExchangeRate(data.data.roundedRate);
          setIsRateStale(Boolean(data.data.isStale));
        }
      })
      .catch((err) => {
        console.warn("Could not fetch live rate for cart:", err);
      });
  }, []);

  useEffect(() => {
    fetch("/api/pricing-config")
      .then(async (res) => {
        if (!res.ok) throw new Error("Pricing configuration unavailable");
        return res.json();
      })
      .then((data) => {
        if (data?.values && Number.isSafeInteger(data.version)) {
          setPricingConfig(data.values as PricingConfigValues);
          setPricingConfigVersion(data.version);
        }
      })
      .catch((err) => console.warn("Could not load pricing config:", err));
  }, []);

  // Khôi phục giỏ hàng từ localStorage (chỉ chạy duy nhất 1 lần khi mount)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cb_shopping_cart");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const validItems = parsed
            .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
            .map((item) => {
              const id = typeof item.id === "string" && item.id.trim() ? item.id : `item-${Date.now()}`;
              const name = typeof item.name === "string" && item.name.trim() ? item.name : "Sản phẩm mua hộ";
              const quantity = Number.isSafeInteger(item.quantity) && (item.quantity as number) > 0 ? (item.quantity as number) : 1;
              const priceJpy = Math.max(0, Math.round(Number(item.priceJpy) || 0));
              const priceVnd = Math.max(0, Math.round(Number(item.priceVnd) || 0));
              const weightKg = Number.isFinite(Number(item.weightKg)) && Number(item.weightKg) >= 0 ? Number(item.weightKg) : 0.5;
              const imageUrl = typeof item.imageUrl === "string" && item.imageUrl ? item.imageUrl : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80";
              const originalStore = typeof item.originalStore === "string" ? item.originalStore : "Catalog ChillBanana";
              const originalUrl = typeof item.originalUrl === "string" ? item.originalUrl : undefined;
              const category = typeof item.category === "string" ? item.category : undefined;
              const stockSlots = typeof item.stockSlots === "number" ? item.stockSlots : undefined;

              return {
                id,
                name,
                quantity,
                priceJpy,
                priceVnd,
                weightKg,
                imageUrl,
                originalStore,
                originalUrl,
                category,
                stockSlots,
              } as CartItem;
            })
            .filter((item) => item.quantity > 0 && item.priceJpy >= 0);

          setItems(validItems);
          if (validItems.length !== parsed.length) {
            toastRef.current.info("Giỏ hàng cũ có dữ liệu không hợp lệ và đã được làm sạch.");
          }
        } else {
          localStorage.removeItem("cb_shopping_cart");
          toastRef.current.info("Giỏ hàng cũ không hợp lệ và đã được làm mới.");
        }
      }
    } catch (err) {
      console.warn("Could not load cart from localStorage:", err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Lưu giỏ hàng mỗi khi thay đổi
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem("cb_shopping_cart", JSON.stringify(items));
      } catch (err) {
        console.warn("Could not save cart to localStorage:", err);
      }
    }
  }, [items, isLoaded]);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const addToCart = (product: Omit<CartItem, "quantity">, quantity = 1) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      toast.warning("Số lượng sản phẩm không hợp lệ.");
      return false;
    }
    if (product.stockSlots !== undefined && product.stockSlots < 1) {
      toast.warning("Sản phẩm này hiện đã hết hàng.");
      return false;
    }
    const isSingle = isSingleItemStore(product.originalStore);
    if (isSingle && quantity > 1) {
      toast.info("Sản phẩm Mercari/Đấu giá Nhật Bản là hàng độc bản 1 món duy nhất.");
      quantity = 1;
    }

    const safePriceJpy = Math.max(0, Math.round(Number(product.priceJpy) || 0));
    const safePriceVnd = Math.max(0, Math.round(Number(product.priceVnd) || 0));
    const safeWeightKg = Number.isFinite(Number(product.weightKg)) && Number(product.weightKg) >= 0
      ? Number(product.weightKg)
      : 0.5;

    const safeProduct: Omit<CartItem, "quantity"> = {
      ...product,
      id: String(product.id || `item-${Date.now()}`),
      name: String(product.name || "Sản phẩm mua hộ Nhật"),
      priceJpy: safePriceJpy,
      priceVnd: safePriceVnd,
      weightKg: safeWeightKg,
      imageUrl: product.imageUrl || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
      originalStore: product.originalStore || "Catalog ChillBanana",
    };

    let wasAdded = false;

    setItems((prev) => {
      const existing = prev.find((item) => item.id === safeProduct.id || (safeProduct.originalUrl && item.originalUrl === safeProduct.originalUrl));
      const availableSlots = isSingle ? 1 : (safeProduct.stockSlots ?? existing?.stockSlots ?? 99);
      if (existing && existing.quantity >= availableSlots) {
        if (existing.quantity > availableSlots) {
          const next = prev.map((item) => item.id === existing.id
            ? { ...item, stockSlots: availableSlots, quantity: availableSlots }
            : item
          );
          try { localStorage.setItem("cb_shopping_cart", JSON.stringify(next)); } catch {}
          return next;
        }
        toast.warning(isSingle ? "Sản phẩm Mercari/Đấu giá là hàng độc bản 1 món duy nhất." : `Chỉ còn tối đa ${availableSlots} sản phẩm trong kho.`);
        return prev;
      }

      wasAdded = true;
      let nextItems: CartItem[];
      if (existing) {
        const maxQ = isSingle ? 1 : (safeProduct.stockSlots ?? existing.stockSlots ?? 99);
        const newQ = Math.min(existing.quantity + quantity, maxQ);
        nextItems = prev.map((item) =>
          item.id === existing.id
            ? { ...item, ...safeProduct, stockSlots: maxQ, quantity: newQ }
            : item
        );
      } else {
        const maxQ = isSingle ? 1 : (safeProduct.stockSlots ?? 99);
        const initialQ = Math.min(quantity, maxQ);
        nextItems = [...prev, { ...safeProduct, quantity: initialQ }];
      }

      try {
        localStorage.setItem("cb_shopping_cart", JSON.stringify(nextItems));
      } catch (err) {
        console.warn("Could not save cart to localStorage:", err);
      }
      return nextItems;
    });

    if (wasAdded) {
      setIsCartOpen(true);
      return true;
    }
    return false;
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem("cb_shopping_cart", JSON.stringify(next));
      } catch (err) {
        console.warn("Could not save cart to localStorage:", err);
      }
      return next;
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    if (!Number.isSafeInteger(quantity)) {
      toast.warning("Số lượng cần là số nguyên dương.");
      return;
    }
    setItems((prev) => {
      const currentItem = prev.find((item) => item.id === id);
      const isSingle = isSingleItemStore(currentItem?.originalStore);
      if (isSingle && quantity > 1) {
        toast.info("Hàng Mercari Nhật là sản phẩm độc bản 1 món duy nhất.");
        quantity = 1;
      }
      const maxQ = isSingle ? 1 : (currentItem?.stockSlots ?? 99);
      if (currentItem && maxQ < 1) {
        toast.warning("Sản phẩm đã hết hàng và được xóa khỏi giỏ hàng.");
        const next = prev.filter((item) => item.id !== id);
        try { localStorage.setItem("cb_shopping_cart", JSON.stringify(next)); } catch {}
        return next;
      }
      if (currentItem && quantity > maxQ) {
        toast.warning(isSingle ? "Sản phẩm Mercari là hàng độc bản 1 món duy nhất." : `Chỉ còn tối đa ${maxQ} sản phẩm trong kho.`);
      }
      const next = prev.map((item) => {
        if (item.id === id) {
          return { ...item, quantity: Math.min(quantity, maxQ) };
        }
        return item;
      });
      try { localStorage.setItem("cb_shopping_cart", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem("cb_shopping_cart");
    } catch (err) {
      console.warn("Could not clear cart in localStorage:", err);
    }
  };

  // Tính toán các chỉ số đơn hàng dựa trên tỷ giá live thực tế theo thời điểm
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalPriceJpy = items.reduce((acc, item) => acc + item.priceJpy * item.quantity, 0);
  // Sử dụng tỷ giá live để tính tiền hàng VND
  const totalProductPriceVnd = Math.round(totalPriceJpy * exchangeRate);
  const totalWeightKg = Number(
    items.reduce((acc, item) => acc + item.weightKg * item.quantity, 0).toFixed(2)
  );

  // Cước bay: 0đ khi chưa có trọng lượng thực tế (sẽ tính khi kho Tokyo cân đo)
  const shippingFeeVnd = totalWeightKg > 0 ? Math.round(totalWeightKg * pricingConfig.airShippingPerKgVnd) : 0;

  // Phí dịch vụ mua hộ (4% giá trị hàng, tối thiểu 20.000đ)
  const rawServiceFeeVnd = Math.round(totalProductPriceVnd * pricingConfig.serviceFeePercent / 100);
  const isMinServiceFeeApplied = totalItems > 0 && rawServiceFeeVnd < pricingConfig.serviceFeeMinimumVnd;
  const serviceFeeVnd = totalItems > 0
    ? Math.max(pricingConfig.serviceFeeMinimumVnd, rawServiceFeeVnd)
    : 0;

  // Tổng tiền hàng + phí mua hộ (cơ sở cọc)
  const baseOrderCostVnd = totalProductPriceVnd + serviceFeeVnd;

  // Tổng tiền bao gồm cước bay (nếu đã có cân nặng)
  const totalVnd = totalProductPriceVnd + shippingFeeVnd + serviceFeeVnd;

  // Đặt cọc 50% hoặc Thanh toán 100%
  const deposit50Vnd = Math.round(baseOrderCostVnd * 0.5);
  const depositAmountVnd = depositOption === 100 ? baseOrderCostVnd : deposit50Vnd;
  const remainingAmountVnd = depositOption === 100 ? 0 : (baseOrderCostVnd - depositAmountVnd);
  const isShippingWeightPending = totalWeightKg <= 0;

  return (
    <CartContext.Provider
      value={{
        items,
        isCartOpen,
        openCart,
        closeCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        exchangeRate,
        isRateStale,
        pricingConfig,
        pricingConfigVersion,
        totalItems,
        totalPriceJpy,
        totalProductPriceVnd,
        totalWeightKg,
        shippingFeeVnd,
        serviceFeeVnd,
        isMinServiceFeeApplied,
        baseOrderCostVnd,
        totalVnd,
        depositOption,
        setDepositOption,
        depositPercent: depositOption,
        setDepositPercent: setDepositOption,
        isShippingWeightPending,
        deposit50Vnd,
        depositAmountVnd,
        remainingAmountVnd,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
