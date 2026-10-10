import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Package, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { QuoteItem } from "@/types";

export interface ItemRowProps {
  item: QuoteItem;
  products: Array<{ id: number; name: string; brand: string; unit: string; price: number; active: boolean }>;
  onChange: (updated: QuoteItem) => void;
  onRemove: () => void;
}

export function ItemRow({ item, products, onChange, onRemove }: ItemRowProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredProds = useMemo(() => {
    if (!prodSearch) return products.filter(p => p.active).slice(0, 8);
    const q = prodSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)).slice(0, 8);
  }, [products, prodSearch]);

  const inputCls = "px-2 py-1.5 text-xs border border-border rounded-lg outline-none focus:border-primary bg-white w-full";

  function selectProduct(p: typeof products[0]) {
    onChange({ ...item, productId: p.id, productName: p.name, productBrand: p.brand, productUnit: p.unit, unitPrice: p.price, subtotal: p.price * item.qty });
    setSearchOpen(false);
    setProdSearch("");
  }

  function updateQty(qty: number) {
    const q = Math.max(0.001, qty || 0);
    onChange({ ...item, qty: q, subtotal: +(item.unitPrice * q).toFixed(2) });
  }

  function updatePrice(price: number) {
    const p = Math.max(0, price || 0);
    onChange({ ...item, unitPrice: p, subtotal: +(p * item.qty).toFixed(2) });
  }

  return (
    <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/10">
      {/* Product select */}
      <div ref={ref} className="relative">
        <button onClick={() => setSearchOpen(p => !p)}
          className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-white text-xs hover:border-primary transition-colors text-left">
          <Package size={12} className="text-primary shrink-0" />
          <span className={item.productId ? "text-foreground font-semibold truncate" : "text-muted-foreground"}>
            {item.productId ? `${item.productName} — ${item.productUnit}` : "Selecionar produto..."}
          </span>
          <ChevronDown size={12} className="ml-auto text-muted-foreground shrink-0" />
        </button>
        {searchOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-border rounded-xl shadow-xl overflow-hidden">
            <div className="p-2 border-b border-border">
              <input autoFocus type="text" placeholder="Buscar produto..." value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-border rounded-lg outline-none focus:border-primary" />
            </div>
            <div className="max-h-44 overflow-y-auto">
              {filteredProds.map(p => (
                <button key={p.id} onClick={() => selectProduct(p)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary/5 text-left text-xs border-b border-border/30 last:border-0">
                  <span className="font-semibold text-foreground truncate flex-1">{p.name}</span>
                  <span className="text-muted-foreground shrink-0">{p.brand} · {p.unit}</span>
                  <span className="text-primary font-bold shrink-0 tabular-nums">{formatCurrency(p.price)}</span>
                </button>
              ))}
              {filteredProds.length === 0 && <p className="text-center text-xs text-muted-foreground py-3">Nenhum produto encontrado</p>}
            </div>
          </div>
        )}
      </div>

      {/* Qty + Price + Subtotal */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground font-bold block mb-0.5">Qtd.</label>
          <input type="number" min="0.001" step="any" value={item.qty || ""}
            onChange={e => updateQty(parseFloat(e.target.value))}
            placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-bold block mb-0.5">Preço unit. (R$)</label>
          <input type="number" min="0" step="0.01" value={item.unitPrice || ""}
            onChange={e => updatePrice(parseFloat(e.target.value))}
            placeholder="0,00" className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-bold block mb-0.5">Subtotal</label>
          <div className="px-2 py-1.5 text-xs border border-border rounded-lg bg-muted/30 text-primary font-black tabular-nums">
            {formatCurrency(item.subtotal)}
          </div>
        </div>
      </div>

      {/* Notes + remove */}
      <div className="flex items-center gap-2">
        <input type="text" placeholder="Observação (sabor, tamanho, personalização...)"
          value={item.notes} onChange={e => onChange({ ...item, notes: e.target.value })}
          className="flex-1 px-2 py-1.5 text-xs border border-border rounded-lg outline-none focus:border-primary bg-white" />
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 transition-colors p-1">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
