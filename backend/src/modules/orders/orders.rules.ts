import type { CreateOrderInput } from "./orders.schema.js";

export type OrderStatusValue = "REQUESTED" | "CONFIRMED" | "CANCELED";

export type ProblemCode =
  | "UNAVAILABLE"
  | "BELOW_MIN"
  | "OUT_OF_STOCK"
  | "INVALID_FLAVOR"
  | "FLAVOR_REQUIRED";

export interface OrderProblem {
  productId: number;
  code: ProblemCode;
  message: string;
}

export interface CatalogFlavor {
  id: number;
  name: string;
}

export interface CatalogProduct {
  id: number;
  name: string;
  brand: string;
  unit: string;
  minQty: number;
  stock: number;
  active: boolean;
  price: { toString(): string };
  flavors: CatalogFlavor[];
}

export interface MergedItem {
  productId: number;
  // chave nula = produto sem sabor
  flavors: Map<string | null, number>;
}

export interface OrderLine {
  product: CatalogProduct;
  flavors: { flavor: CatalogFlavor | null; quantity: number }[];
  totalQuantity: number;
}

// Junta o mesmo productId repetido e soma o mesmo sabor repetido.
export function mergeItems(items: CreateOrderInput["items"]): MergedItem[] {
  const byProduct = new Map<number, MergedItem>();

  for (const item of items) {
    let merged = byProduct.get(item.productId);
    if (!merged) {
      merged = { productId: item.productId, flavors: new Map() };
      byProduct.set(item.productId, merged);
    }
    for (const entry of item.flavors) {
      merged.flavors.set(entry.flavor, (merged.flavors.get(entry.flavor) ?? 0) + entry.quantity);
    }
  }

  return [...byProduct.values()];
}

export function checkItems(
  merged: MergedItem[],
  catalog: ReadonlyMap<number, CatalogProduct>,
): { problems: OrderProblem[]; lines: OrderLine[] } {
  const problems: OrderProblem[] = [];
  const lines: OrderLine[] = [];

  for (const item of merged) {
    const product = catalog.get(item.productId);
    const problem = (code: ProblemCode, message: string) =>
      problems.push({ productId: item.productId, code, message });

    if (!product || !product.active) {
      problem("UNAVAILABLE", "Produto indisponível.");
      continue;
    }

    if (product.stock <= 0) {
      problem("OUT_OF_STOCK", `${product.name} está sem estoque.`);
      continue;
    }

    const registered = new Map(product.flavors.map((flavor) => [flavor.name, flavor]));
    const hasFlavors = registered.size > 0;
    const entries = [...item.flavors.entries()];
    const flavorProblemsBefore = problems.length;

    const resolved: OrderLine["flavors"] = [];
    for (const [name, quantity] of entries) {
      if (hasFlavors) {
        if (name === null) {
          problem("FLAVOR_REQUIRED", `Escolha o sabor de ${product.name}.`);
          continue;
        }
        const flavor = registered.get(name);
        if (!flavor) {
          problem("INVALID_FLAVOR", `Sabor "${name}" não existe em ${product.name}.`);
          continue;
        }
        resolved.push({ flavor, quantity });
      } else {
        if (name !== null) {
          problem("INVALID_FLAVOR", `${product.name} não possui sabores.`);
          continue;
        }
        resolved.push({ flavor: null, quantity });
      }
    }

    if (problems.length > flavorProblemsBefore) continue;

    const totalQuantity = resolved.reduce((sum, entry) => sum + entry.quantity, 0);

    if (totalQuantity < product.minQty) {
      problem("BELOW_MIN", `${product.name}: quantidade mínima é ${product.minQty}.`);
      continue;
    }

    // O banco (trigger order_items_prepare) recusa quantidade acima do saldo. Checar aqui
    // devolve um 422 claro em vez de um erro genérico. O pedido NÃO baixa nem reserva estoque.
    if (totalQuantity > product.stock) {
      problem("OUT_OF_STOCK", `${product.name}: só há ${product.stock} em estoque.`);
      continue;
    }

    lines.push({ product, flavors: resolved, totalQuantity });
  }

  return { problems, lines };
}

// O admin só cancela solicitações em aberto. REQUESTED -> CONFIRMED é feito pelo banco quando
// a venda vinculada é confirmada (confirm_sale); CONFIRMED -> CANCELED exige cancelar a venda.
const ALLOWED_TRANSITIONS: Record<OrderStatusValue, readonly OrderStatusValue[]> = {
  REQUESTED: ["CANCELED"],
  CONFIRMED: [],
  CANCELED: [],
};

export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
