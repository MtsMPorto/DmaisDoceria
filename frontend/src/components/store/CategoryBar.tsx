import { useEffect, useRef, useState } from "react";
import { useProducts } from "@/contexts/ProductsContext";

export function CategoryBar({
  activeCategory,
  onSelect,
}: {
  activeCategory: string;
  onSelect: (category: string) => void;
}) {
  const { categories } = useProducts();
  const names = ["Todos", ...categories];

  // A barra some ao rolar para baixo e volta ao rolar para cima.
  const [catBarVisible, setCatBarVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const current = window.scrollY;
      const delta = current - lastScrollY.current;
      if (Math.abs(delta) < 10) return;
      if (current < 600) {
        setCatBarVisible(true);
        lastScrollY.current = current;
        return;
      }
      setCatBarVisible(delta < 0);
      lastScrollY.current = current;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
      <div id="catalogo" className="sticky top-0 z-30 border-b border-border shadow-sm transition-transform duration-300"
        style={{ background: "#27408A", transform: catBarVisible ? "translateY(0)" : "translateY(-110%)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide justify-center">
            {names.map((cat) => (
              <button key={cat} onClick={() => onSelect(cat)}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-all"
                style={activeCategory === cat
                  ? { background: "#F97316", color: "#fff", boxShadow: "0 2px 12px rgba(249,115,22,0.4)" }
                  : { background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.15)" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>
  );
}
