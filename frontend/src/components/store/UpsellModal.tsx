import { useState } from "react";
import { Link } from "react-router";
import { Check, Plus, ShoppingCart, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import type { Product } from "@/types";

export interface UpsellModalProps {
  product: Product;
  suggestions: Product[];
  onClose: () => void;
  onGoToCart: () => void;
}

export function UpsellModal({ product, suggestions, onClose, onGoToCart }: UpsellModalProps) {
  const { addToCart, cart, cartKey } = useCart();
  const [added, setAdded] = useState<number[]>([]);

  function handleAdd(p: Product) {
    addToCart(p);
    setAdded((prev) => [...prev, p.id]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Green success bar */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ background: "#27408A" }}>
          <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
            <Check size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{product.name} adicionado!</p>
            <p className="text-white/60 text-xs">Ótima escolha para revenda 👍</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white flex-shrink-0"><X size={18} /></button>
        </div>

        {/* Upsell suggestions */}
        {suggestions.length > 0 && (
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-black uppercase tracking-wide mb-3" style={{ color: "#27408A" }}>
              🔥 Clientes também levam junto:
            </p>
            <div className="space-y-3">
              {suggestions.map((s) => {
                const isAdded = added.includes(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3 bg-[#F4F6FA] rounded-2xl p-3">
                    <Link to={`/product/${s.id}`} onClick={onClose} className="flex-shrink-0">
                      <img src={s.image} alt={s.name} className="w-14 h-14 rounded-xl object-cover" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${s.id}`} onClick={onClose}>
                        <p className="text-sm font-bold text-gray-800 leading-tight line-clamp-1">{s.name}</p>
                      </Link>
                      <p className="text-xs text-gray-400">{s.brand} · {s.unit}</p>
                    </div>
                    <button
                      onClick={() => handleAdd(s)}
                      disabled={isAdded}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black transition-all"
                      style={isAdded
                        ? { background: "#dcfce7", color: "#16a34a" }
                        : { background: "#27408A", color: "#fff" }}>
                      {isAdded ? <><Check size={11} /> Adicionado</> : <><Plus size={11} /> Adicionar</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-5 pt-3 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-full text-sm font-bold border-2 transition-all"
            style={{ borderColor: "#27408A", color: "#27408A" }}>
            Continuar comprando
          </button>
          <button onClick={onGoToCart}
            className="flex-1 py-2.5 rounded-full text-sm font-black text-white flex items-center justify-center gap-2 transition-all"
            style={{ background: "#F97316" }}>
            <ShoppingCart size={15} /> Ver carrinho
          </button>
        </div>
      </div>
    </div>
  );
}
