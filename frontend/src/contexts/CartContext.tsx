import { restoreCart } from "@/lib/restoreCart";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { CartItem, Product } from "@/types";

import { useProducts } from "@/contexts/ProductsContext";

interface CartContextValue {
  cart: CartItem[];
  addToCart: (product: Product, flavor?: string, quantity?: number) => void;
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
  const { products, loading, error } = useProducts();
  const hydrated = useRef(false);
  const latestCart = useRef<CartItem[]>([]);
  const restoring = useRef<CartItem[] | null>(null);
  const storageKey = "dmais_cart_v1";
  useEffect(() => {
    if (loading || error) return;
    let source: { id: number; qty: number; selectedFlavor?: string }[] = latestCart.current;
    if (!hydrated.current) {
      try { const saved = JSON.parse(localStorage.getItem(storageKey) || "[]"); if (Array.isArray(saved)) source = saved; } catch {}
    }
    const restored = restoreCart(source, products);
    latestCart.current = restored;
    restoring.current = restored;
    hydrated.current = true;
    setCart(restored);
    try { localStorage.setItem(storageKey, JSON.stringify(restored.map(({id, qty, selectedFlavor}) => ({id, qty, selectedFlavor})))); } catch {}
  }, [products, loading, error]);
  useEffect(() => {
    if (!hydrated.current) return;
    if (restoring.current && restoring.current !== cart) return;
    restoring.current = null;
    latestCart.current = cart;
    try { localStorage.setItem(storageKey, JSON.stringify(cart.map(({id, qty, selectedFlavor}) => ({id, qty, selectedFlavor})))); } catch {}
  }, [cart]);

  function itemKey(id: number, flavor?: string) {
    return `${id}::${flavor ?? ""}`;
  }

  function cartKey(item: CartItem) {
    return itemKey(item.id, item.selectedFlavor);
  }

  function addToCart(product: Product, flavor?: string, quantity = 1) {
    if (!Number.isSafeInteger(quantity) || quantity < 1) return;
    const key = itemKey(product.id, flavor);
    setCart((prev) => {
      if (prev.filter(i => i.id === product.id).reduce((sum,i) => sum+i.qty,0) >= product.stock) return prev;
      if (product.flavors?.length && !product.flavors.includes(flavor || "")) return prev;
      const existing = prev.find((i) => itemKey(i.id, i.selectedFlavor) === key);
      const available = product.stock - prev.filter(i => i.id === product.id).reduce((sum, i) => sum + i.qty, 0);
      const amount = Math.min(quantity, available, 9999 - (existing?.qty ?? 0));
      if (amount <= 0) return prev;
      if (existing)
        return prev.map((i) => itemKey(i.id, i.selectedFlavor) === key ? { ...i, qty: i.qty + amount } : i);
      return [...prev, { ...product, qty: amount, selectedFlavor: flavor }];
    });
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => itemKey(i.id, i.selectedFlavor) === key ? { ...i, qty: Math.max(0, Math.min(9999, i.qty + delta, i.stock - prev.filter(other => other.id === i.id && itemKey(other.id, other.selectedFlavor) !== key).reduce((sum, other) => sum + other.qty, 0))) } : i)
        .filter((i) => i.qty > 0)
    );
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((i) => itemKey(i.id, i.selectedFlavor) !== key));
  }

  function replaceFlavors(product: Product, selections: { flavor: string; qty: number }[]) {
    setCart((prev) => {
      if (selections.some(s => !Number.isSafeInteger(s.qty) || s.qty < 0 || s.qty > 9999 || !product.flavors?.includes(s.flavor)) || selections.reduce((sum,s) => sum+s.qty,0) > product.stock) return prev;
      const withoutProduct = prev.filter((i) => i.id !== product.id);
      const newItems = selections
        .filter((s) => s.qty > 0)
        .map((s) => ({ ...product, qty: s.qty, selectedFlavor: s.flavor }));
      return [...withoutProduct, ...newItems];
    });
  }

  function clearCart() {
    try { localStorage.setItem(storageKey, "[]"); } catch {}
    latestCart.current = [];
    setCart([]);
  }

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
