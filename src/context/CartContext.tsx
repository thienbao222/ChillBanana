"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/data";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { useToast } from "@/context/ToastContext";

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
  totalItems: number;
  totalPriceJpy: number;
  totalProductPriceVnd: number;
  totalWeightKg: number;
  shippingFeeVnd: number;
  serviceFeeVnd: number;
  baseOrderCostVnd: number;
  totalVnd: number;
  deposit50Vnd: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);
  const pricingConfig = usePricingConfig();

  // Lấy tỷ giá thực tế live từ API
  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.roundedRate) {
          setExchangeRate(data.data.roundedRate);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch live rate for cart:", err);
      });
  }, []);

  // Khôi phục giỏ hàng từ localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cb_shopping_cart");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const validItems = parsed.filter((item): item is CartItem =>
            item &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
            Number.isSafeInteger(item.priceJpy) && item.priceJpy >= 0 &&
            Number.isFinite(item.weightKg) && item.weightKg >= 0
          );
          setItems(validItems);
          if (validItems.length !== parsed.length) {
            toast.info("Giỏ hàng cũ có dữ liệu không hợp lệ và đã được làm sạch.");
          }
        } else {
          localStorage.removeItem("cb_shopping_cart");
          toast.info("Giỏ hàng cũ không hợp lệ và đã được làm mới.");
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
    const existingItem = items.find((item) => item.id === product.id || (product.originalUrl && item.originalUrl === product.originalUrl));
    const availableSlots = product.stockSlots ?? existingItem?.stockSlots ?? 99;
    if (existingItem && existingItem.quantity >= availableSlots) {
      if (existingItem.quantity > availableSlots) {
        setItems((prev) => prev.map((item) => item.id === existingItem.id
          ? { ...item, stockSlots: availableSlots, quantity: availableSlots }
          : item
        ));
      }
      toast.warning(`Chỉ còn tối đa ${availableSlots} sản phẩm trong kho.`);
      return false;
    }

    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id || (product.originalUrl && item.originalUrl === product.originalUrl));
      if (existing) {
        const maxQ = product.stockSlots ?? existing.stockSlots ?? 99;
        const newQ = Math.min(existing.quantity + quantity, maxQ);
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, ...product, stockSlots: maxQ, quantity: newQ }
            : item
        );
      }
      const maxQ = product.stockSlots ?? 99;
      const initialQ = Math.min(quantity, maxQ);
      return [...prev, { ...product, quantity: initialQ }];
    });
    setIsCartOpen(true);
    return true;
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
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
    const currentItem = items.find((item) => item.id === id);
    const maxQ = currentItem?.stockSlots ?? 99;
    if (currentItem && maxQ < 1) {
      removeFromCart(id);
      toast.warning("Sản phẩm đã hết hàng và được xóa khỏi giỏ hàng.");
      return;
    }
    if (currentItem && quantity > maxQ) {
      toast.warning(`Chỉ còn tối đa ${maxQ} sản phẩm trong kho.`);
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, quantity: Math.min(quantity, item.stockSlots ?? 99) };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
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
  const serviceFeeVnd = totalItems > 0 ? Math.max(pricingConfig.minServiceFeeVnd, Math.round(totalProductPriceVnd * pricingConfig.serviceFeeRate)) : 0;

  // Tổng tiền
  const totalVnd = totalProductPriceVnd + shippingFeeVnd + serviceFeeVnd;

  // Tiền cọc 50% chỉ tính trên (tiền hàng + phí dịch vụ), KHÔNG bao gồm cước bay
  const baseOrderCostVnd = totalProductPriceVnd + serviceFeeVnd;
  const deposit50Vnd = Math.round(baseOrderCostVnd * 0.5);

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
        totalItems,
        totalPriceJpy,
        totalProductPriceVnd,
        totalWeightKg,
        shippingFeeVnd,
        serviceFeeVnd,
        baseOrderCostVnd,
        totalVnd,
        deposit50Vnd,
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
