"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AIR_SHIPPING_PER_KG, DEFAULT_EXCHANGE_RATE } from "@/lib/data";

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
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPriceJpy: number;
  totalProductPriceVnd: number;
  totalWeightKg: number;
  shippingFeeVnd: number;
  serviceFeeVnd: number;
  totalVnd: number;
  deposit50Vnd: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Khôi phục giỏ hàng từ localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cb_shopping_cart");
      if (saved) {
        setItems(JSON.parse(saved));
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
    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id || (product.originalUrl && item.originalUrl === product.originalUrl));
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  // Tính toán các chỉ số đơn hàng
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalPriceJpy = items.reduce((acc, item) => acc + item.priceJpy * item.quantity, 0);
  const totalProductPriceVnd = items.reduce((acc, item) => acc + item.priceVnd * item.quantity, 0);
  const totalWeightKg = Number(
    items.reduce((acc, item) => acc + item.weightKg * item.quantity, 0).toFixed(2)
  );

  // Cước bay quốc tế: làm tròn tối thiểu 0.5kg
  const chargeableWeight = Math.max(0.5, totalWeightKg);
  const shippingFeeVnd = totalItems > 0 ? Math.round(chargeableWeight * AIR_SHIPPING_PER_KG) : 0;

  // Phí dịch vụ mua hộ (4% giá trị hàng hóa)
  const serviceFeeVnd = totalItems > 0 ? Math.round(totalProductPriceVnd * 0.04) : 0;

  // Tổng tiền về tay trọn gói
  const totalVnd = totalProductPriceVnd + shippingFeeVnd + serviceFeeVnd;
  const deposit50Vnd = Math.round(totalVnd * 0.5);

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
        totalItems,
        totalPriceJpy,
        totalProductPriceVnd,
        totalWeightKg,
        shippingFeeVnd,
        serviceFeeVnd,
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
