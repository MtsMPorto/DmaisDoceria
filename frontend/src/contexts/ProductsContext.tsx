import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import logoImg from "@/assets/images/Logo_Doces-removebg-preview__1_.png";
import { errorMessage } from "@/services/api";
import { storeApi } from "@/services/endpoints";
import type { Product } from "@/types";
import type { ApiProduct, ApiTestimonial, PublicSettings } from "@/types/api";

// Catálogo público (loja), vindo da API. Não guarda nada no navegador.

function toStoreProduct(row: ApiProduct): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    price: Number(row.price), // somente para exibir; o preço oficial vem do banco no pedido
    unit: row.unit,
    minQty: row.minQty,
    image: row.imageUrl ?? logoImg,
    category: row.category,
    stars: row.stars,
    stock: row.stock,
    flavors: row.flavors.length > 0 ? row.flavors.map((flavor) => flavor.name) : undefined,
    active: true,
    description: row.description ?? undefined,
  };
}

interface ProductsContextValue {
  products: Product[];
  /** Nomes das categorias ativas, em ordem (sem "Todos"). */
  categories: string[];
  settings: PublicSettings | null;
  testimonials: ApiTestimonial[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [testimonials, setTestimonials] = useState<ApiTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([storeApi.products(), storeApi.categories(), storeApi.settings(), storeApi.testimonials()])
      .then(([productRows, categoryRows, settingsRow, testimonialRows]) => {
        if (cancelled) return;
        setProducts(productRows.map(toStoreProduct));
        setCategories(categoryRows.map((category) => category.name));
        setSettings(settingsRow);
        setTestimonials(testimonialRows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const value = useMemo<ProductsContextValue>(
    () => ({
      products,
      categories,
      settings,
      testimonials,
      loading,
      error,
      reload: () => setTick((current) => current + 1),
    }),
    [products, categories, settings, testimonials, loading, error],
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used inside ProductsProvider");
  return ctx;
}
