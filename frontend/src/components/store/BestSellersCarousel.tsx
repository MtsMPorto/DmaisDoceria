import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";

export function BestSellersCarousel({
  products,
  onOpenFlavorModal,
}: {
  products: Product[];
  onOpenFlavorModal: (product: Product) => void;
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function updateArrows() {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  function scrollCarousel(dir: "left" | "right") {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  }

  return (
      <section id="mais-vendidos" className="py-10 px-4 relative overflow-hidden" style={{ background: "#E42457", borderRadius: "1.5rem", margin: "2rem 1rem" }}>
        {/* Dot texture */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }} />

        <div className="max-w-7xl mx-auto relative">
          {/* Header row */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-0.5">{/* ⭐ */}Top produtos</p>
              <h2 className="text-white font-black text-2xl sm:text-3xl" style={{ fontFamily: "'Baloo 2', cursive" }}>
                Mais Vendidos
              </h2>
              <p className="text-white/70 text-sm mt-0.5">Os favoritos dos nossos revendedores</p>
            </div>

          </div>

          {/* Carousel */}
          <div
            ref={carouselRef}
            onScroll={updateArrows}
            className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {products.map((product) => (
              <div key={product.id} className="flex-shrink-0 w-44 sm:w-48">
                <ProductCard product={product} onOpenFlavorModal={() => onOpenFlavorModal(product)} compact />
              </div>
            ))}
          </div>

          {/* Desktop arrows — centered below cards */}
          <div className="hidden sm:flex items-center justify-center gap-3 mt-5">
            <button
              onClick={() => scrollCarousel("left")}
              disabled={!canScrollLeft}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: canScrollLeft ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.25)" }}>
              <ChevronLeft size={18} className="text-white" />
            </button>
            <button
              onClick={() => scrollCarousel("right")}
              disabled={!canScrollRight}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: canScrollRight ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.25)" }}>
              <ChevronRight size={18} className="text-white" />
            </button>
          </div>

          {/* Mobile swipe hint */}
          <p className="sm:hidden text-center text-white/40 text-[10px] font-semibold mt-3 tracking-wide">← deslize para ver mais →</p>
        </div>
      </section>
  );
}
