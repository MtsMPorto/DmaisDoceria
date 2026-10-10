import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";

export function FeaturedSection({
  products,
  onOpenFlavorModal,
}: {
  products: Product[];
  onOpenFlavorModal: (product: Product) => void;
}) {
  if (products.length === 0) return null;

  return (
        <section className="py-12 px-4" style={{ background: "linear-gradient(135deg, #fff8f0 0%, #fff0dc 100%)" }}>
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-orange-500 text-xs font-black uppercase tracking-widest mb-1">✨ Curadoria D'mais</p>
                <h2 className="text-primary font-black text-2xl sm:text-3xl" style={{ fontFamily: "'Baloo 2', cursive" }}>
                  Destaques da Semana
                </h2>
                <p className="text-muted-foreground text-sm mt-1">Seleção especial escolhida pelo fornecedor</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <div key={product.id} className="relative">
                  {/* Promo ribbon */}
                  <ProductCard product={product} onOpenFlavorModal={() => onOpenFlavorModal(product)} />
                </div>
              ))}
            </div>
          </div>
        </section>
  );
}
