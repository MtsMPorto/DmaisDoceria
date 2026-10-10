import { ShoppingCart } from "lucide-react";

export function FloatingCartButton({ totalItems, onOpen }: { totalItems: number; onOpen: () => void }) {
  return (
        <button onClick={() => onOpen()}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-full shadow-2xl font-bold text-sm hover:bg-primary/90 transition-all active:scale-95 sm:hidden">
          <ShoppingCart size={16} />
          {totalItems} {totalItems === 1 ? "item" : "itens"}
        </button>
  );
}
