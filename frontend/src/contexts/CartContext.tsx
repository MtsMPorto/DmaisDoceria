import { createContext, useContext, useState, type ReactNode } from "react";
import type { CartItem, Product } from "@/types";

interface CartContextValue {
  cart: CartItem[];
  addToCart: (product: Product, flavor?: string) => void;
  updateQty: (key: string, delta: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  totalItems: number;
  cartKey: (item: CartItem) => string;
  replaceFlavors: (product: Product, selections: { flavor: string; qty: number }[]) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  function itemKey(id: number, flavor?: string) {
    return `${id}::${flavor ?? ""}`;
  }

  function cartKey(item: CartItem) {
    return itemKey(item.id, item.selectedFlavor);
  }

  function addToCart(product: Product, flavor?: string) {
    const key = itemKey(product.id, flavor);
    setCart((prev) => {
      const existing = prev.find((i) => itemKey(i.id, i.selectedFlavor) === key);
      if (existing)
        return prev.map((i) => itemKey(i.id, i.selectedFlavor) === key ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1, selectedFlavor: flavor }];
    });
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => itemKey(i.id, i.selectedFlavor) === key ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
        .filter((i) => i.qty > 0)
    );
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((i) => itemKey(i.id, i.selectedFlavor) !== key));
  }

  function replaceFlavors(product: Product, selections: { flavor: string; qty: number }[]) {
    setCart((prev) => {
      const withoutProduct = prev.filter((i) => i.id !== product.id);
      const newItems = selections
        .filter((s) => s.qty > 0)
        .map((s) => ({ ...product, qty: s.qty, selectedFlavor: s.flavor }));
      return [...withoutProduct, ...newItems];
    });
  }

  function clearCart() { setCart([]); }

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQty, removeItem, clearCart, totalItems, cartKey, replaceFlavors }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
