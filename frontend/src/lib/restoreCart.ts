import type { CartItem, Product } from "@/types";

export function restoreCart(source: { id: number; qty: number; selectedFlavor?: string }[], products: Product[]): CartItem[] {
    const totals = new Map<number, number>();
    const keys = new Set<string>();
    const restored: CartItem[] = [];
    for (const item of source) {
      if (!item || !Number.isSafeInteger(item.qty) || item.qty <= 0) continue;
      const product = products.find(p => p.id === item.id && p.active);
      if (!product) continue;
      if (product.flavors?.length ? !product.flavors.includes(item.selectedFlavor || "") : !!item.selectedFlavor) continue;
      const key = `${product.id}::${item.selectedFlavor ?? ""}`;
      if (keys.has(key)) continue;
      keys.add(key);
      const qty = Math.min(item.qty, Math.max(0, product.stock - (totals.get(product.id) || 0)), 9999);
      if (qty > 0) restored.push({ ...product, qty, selectedFlavor: item.selectedFlavor });
      totals.set(product.id, (totals.get(product.id) || 0) + qty);
    }
    return restored;
}
