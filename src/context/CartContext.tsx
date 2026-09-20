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
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);

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

  // Tính toán các chỉ số đơn hàng dựa trên tỷ giá live thực tế theo thời điểm
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalPriceJpy = items.reduce((acc, item) => acc + item.priceJpy * item.quantity, 0);
  // Sử dụng tỷ giá live để tính tiền hàng VND
  const totalProductPriceVnd = Math.round(totalPriceJpy * exchangeRate);
  const totalWeightKg = Number(
    items.reduce((acc, item) => acc + item.weightKg * item.quantity, 0).toFixed(2)
  );

  // Cước bay: 0đ khi chưa có trọng lượng thực tế (sẽ tính khi kho Tokyo cân đo)
  const shippingFeeVnd = totalWeightKg > 0 ? Math.round(totalWeightKg * AIR_SHIPPING_PER_KG) : 0;

  // Phí dịch vụ mua hộ (4% giá trị hàng, tối thiểu 20.000đ)
  const serviceFeeVnd = totalItems > 0 ? Math.max(20000, Math.round(totalProductPriceVnd * 0.04)) : 0;

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
