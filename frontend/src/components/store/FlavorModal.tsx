import { useState } from "react";
import { ShoppingCart, X, Plus, Minus } from "lucide-react";
import type { CartItem, Product } from "@/types";

export function FlavorModal({
  product,
  cartItems,
  cartKey,
  onConfirm,
  onClose,
}: {
  product: Product;
  cartItems: CartItem[];
  cartKey: (item: CartItem) => string;
  onConfirm: (selections: { flavor: string; qty: number }[]) => void;
  onClose: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    product.flavors!.forEach((f) => {
      const existing = cartItems.find((i) => i.id === product.id && i.selectedFlavor === f);
      init[f] = existing?.qty ?? 0;
    });
    return init;
  });

  const total = Object.values(quantities).reduce((s, v) => s + v, 0);

  function adjust(flavor: string, delta: number) {
    setQuantities((q) => ({ ...q, [flavor]: Math.max(0, (q[flavor] ?? 0) + delta) }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0" style={{ background: "#27408A" }}>
          <img src={product.image} alt={product.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-wide">{product.brand}</p>
            <p className="text-white font-black text-sm leading-tight">{product.name}</p>
            <p className="text-white/50 text-[10px] mt-0.5">{product.flavors!.length} sabores disponíveis</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Flavor list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          <p className="text-primary font-black text-sm mb-3">Escolha o sabor e a quantidade:</p>
          {product.flavors!.map((flavor) => {
            const qty = quantities[flavor] ?? 0;
            return (
              <div key={flavor}
                className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors"
                style={{ background: qty > 0 ? "rgba(39,64,138,0.06)" : "var(--card)", border: qty > 0 ? "1.5px solid rgba(39,64,138,0.2)" : "1.5px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  {qty > 0 && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
                  <span className="text-primary font-semibold text-sm">{flavor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => adjust(flavor, -1)} disabled={qty === 0}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors disabled:opacity-30"
                    style={{ background: "rgba(39,64,138,0.1)" }}>
                    <Minus size={11} className="text-primary" />
                  </button>
                  <span className="text-primary font-black text-sm w-5 text-center">{qty}</span>
                  <button onClick={() => adjust(flavor, 1)}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: "#F97316" }}>
                    <Plus size={11} className="text-white" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border bg-card flex-shrink-0">
          <button
            onClick={() => onConfirm(Object.entries(quantities).map(([flavor, qty]) => ({ flavor, qty })))}
            disabled={total === 0}
            className="w-full text-white font-black py-3.5 rounded-full text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-40"
            style={{ background: total > 0 ? "#F97316" : "#ccc" }}>
            <ShoppingCart size={16} />
            {total > 0 ? `Adicionar ${total} ${total === 1 ? "item" : "itens"} ao carrinho` : "Selecione ao menos 1 sabor"}
          </button>
        </div>
      </div>
    </div>
  );
}
