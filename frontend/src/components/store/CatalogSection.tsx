import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";

export function CatalogSection({
  activeCategory,
  products,
  onOpenFlavorModal,
}: {
  activeCategory: string;
  products: Product[];
  onOpenFlavorModal: (product: Product) => void;
}) {
  return (
      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-accent text-xs font-black uppercase tracking-widest mb-1">🍬 Catálogo</p>
            <h2 className="text-primary font-black text-2xl sm:text-3xl" style={{ fontFamily: "'Baloo 2', cursive" }}>
              {activeCategory === "Todos" ? "Todos os Produtos" : activeCategory}
            </h2>
          </div>
          <span className="text-muted-foreground text-sm bg-muted px-3 py-1 rounded-full font-semibold">{products.length} produtos</span>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-bold text-lg">Nenhum produto encontrado</p>
            <p className="text-sm">Tente outro termo de busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onOpenFlavorModal={() => onOpenFlavorModal(product)} />
            ))}
          </div>
        )}
      </main>
  );
}
