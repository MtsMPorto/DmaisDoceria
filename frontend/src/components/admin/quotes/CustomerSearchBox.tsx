import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, User, X } from "lucide-react";
import { getDisplayName } from "@/lib/customers";
import { normalizePhone } from "@/lib/format";
import type { Customer } from "@/types";

export interface CustomerSearchProps {
  customers: Customer[];
  selectedId: string;
  selectedName: string;
  selectedPhone: string;
  onSelect: (id: string, name: string, phone: string) => void;
  onClearCustomer: () => void;
  isNewMode: boolean;
  newName: string;
  newPhone: string;
  onNewNameChange: (v: string) => void;
  onNewPhoneChange: (v: string) => void;
  onSwitchToNew: () => void;
}

export function CustomerSearchBox({
  customers, selectedId, selectedName, selectedPhone,
  onSelect, onClearCustomer,
  isNewMode, newName, newPhone,
  onNewNameChange, onNewPhoneChange, onSwitchToNew,
}: CustomerSearchProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const results = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return customers.filter(c =>
      getDisplayName(c).toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      normalizePhone(c.phone).includes(normalizePhone(q))
    ).slice(0, 6);
  }, [customers, search]);

  const inputCls = "w-full px-3 py-2 text-xs border border-border rounded-xl outline-none focus:border-primary bg-white";

  if (selectedId) {
    return (
      <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
        <User size={14} className="text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-primary truncate">{selectedName}</p>
          <p className="text-[10px] text-muted-foreground">{selectedPhone}</p>
        </div>
        <button onClick={onClearCustomer} className="text-muted-foreground hover:text-red-500 transition-colors">
          <X size={14} />
        </button>
      </div>
    );
  }

  if (isNewMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">Novo cliente</span>
          <button onClick={onClearCustomer} className="text-xs text-muted-foreground hover:text-primary underline">Buscar existente</button>
        </div>
        <input type="text" placeholder="Nome completo *" value={newName} onChange={e => onNewNameChange(e.target.value)} className={inputCls} />
        <input type="tel" placeholder="WhatsApp com DDD (ex: 11 98765-4321) *" value={newPhone} onChange={e => onNewPhoneChange(e.target.value)} className={inputCls} />
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome, código ou telefone..."
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-xl outline-none focus:border-primary bg-white"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-border rounded-2xl shadow-xl overflow-hidden">
          {results.map(c => (
            <button key={c.id} onClick={() => { onSelect(c.id, getDisplayName(c), c.phone); setOpen(false); setSearch(""); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 transition-colors text-left border-b border-border/40 last:border-0">
              <User size={14} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{getDisplayName(c)}</p>
                <p className="text-[10px] text-muted-foreground">{c.code} · {c.phone}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && search.length > 1 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-border rounded-2xl shadow-xl p-3">
          <p className="text-xs text-muted-foreground mb-2">Nenhum cliente encontrado.</p>
          <button onClick={onSwitchToNew} className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
            <Plus size={12} /> Cadastrar novo cliente
          </button>
        </div>
      )}
      {!search && (
        <button onClick={onSwitchToNew} className="mt-1 text-xs text-muted-foreground hover:text-primary font-semibold transition-colors flex items-center gap-1">
          <Plus size={12} /> Cliente sem cadastro
        </button>
      )}
    </div>
  );
}
