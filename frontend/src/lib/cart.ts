import type { CartItem } from "@/types";

export interface CartProductTotal {
  productId: number;
  name: string;
  minQty: number;
  stock: number;
  qty: number;
}

// Soma por produto (todos os sabores juntos), que é como o banco confere mínimo e estoque.
export function cartTotalsByProduct(cart: CartItem[]): CartProductTotal[] {
  const byProduct = new Map<number, CartProductTotal>();
  for (const item of cart) {
    const current = byProduct.get(item.id);
    if (current) current.qty += item.qty;
    else byProduct.set(item.id, { productId: item.id, name: item.name, minQty: item.minQty, stock: item.stock, qty: item.qty });
  }
  return [...byProduct.values()];
}

// Abaixo do mínimo BLOQUEIA o envio.
export function belowMinimum(cart: CartItem[]): CartProductTotal[] {
  return cartTotalsByProduct(cart).filter((total) => total.qty < total.minQty);
}

// Acima do estoque é só AVISO: quem decide é o banco (erro OUT_OF_STOCK, 422).
export function aboveStock(cart: CartItem[]): CartProductTotal[] {
  return cartTotalsByProduct(cart).filter((total) => total.qty > total.stock);
}

// Formato esperado por POST /api/orders (itens por produto, sabores por nome).
export function toOrderItems(cart: CartItem[]) {
  const byProduct = new Map<number, { productId: number; flavors: { flavor: string | null; quantity: number }[] }>();
  for (const item of cart) {
    const entry = byProduct.get(item.id) ?? { productId: item.id, flavors: [] };
    entry.flavors.push({ flavor: item.selectedFlavor ?? null, quantity: item.qty });
    byProduct.set(item.id, entry);
  }
  return [...byProduct.values()];
}
