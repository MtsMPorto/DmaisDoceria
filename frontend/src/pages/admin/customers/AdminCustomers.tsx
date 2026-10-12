import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Users } from "lucide-react";
import { CustomerFormModal } from "@/components/admin/customers/CustomerFormModal";
import { CustomerFicha, customerDisplayName } from "@/components/admin/customers/CustomerFicha";
import { AsyncBoundary } from "@/components/ui/AsyncState";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, formatDocument, formatPhone } from "@/lib/format";
import { brl } from "@/lib/money";
import { adminApi } from "@/services/endpoints";
import type { CustomerRecord, PersonKind } from "@/types/api";

const PAGE_SIZE = 20;

// Clientes nunca são apagados: o cadastro é inativado em "Editar".
export default function AdminCustomers({ onNewSale, onOpenSale }: { onNewSale: (customerId: number) => void; onOpenSale: (saleId: number) => void }) {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PersonKind | "ALL">("ALL");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [ficha, setFicha] = useState<CustomerRecord | null>(null);
  const [form, setForm] = useState<{ customer: CustomerRecord | null } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(term.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  const list = useAsync(
    () => adminApi.customers({
      q: query || undefined,
      type: type === "ALL" ? undefined : type,
      active: showInactive ? undefined : true,
      page,
      limit: PAGE_SIZE,
    }),
    [query, type, showInactive, page],
  );

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex gap-2 flex-wrap flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Nome, código, documento ou telefone..." value={term} onChange={(e) => setTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border focus:border-primary outline-none text-sm bg-background" />
          </div>
          <select value={type} onChange={(e) => { setType(e.target.value as PersonKind | "ALL"); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-border text-sm bg-background text-primary font-semibold">
            <option value="ALL">PF / PJ</option>
            <option value="PF">Pessoa Física</option>
            <option value="PJ">Pessoa Jurídica</option>
          </select>
          <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <input type="checkbox" checked={showInactive} onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }} /> Mostrar inativos
          </label>
        </div>
        <button onClick={() => setForm({ customer: null })}
          className="flex items-center gap-2 bg-accent hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md shadow-accent/30">
          <Plus size={16} /> Cadastrar Cliente
        </button>
      </div>

      <AsyncBoundary loading={list.loading} error={list.error} onRetry={list.reload} hasData={list.data !== null}>
        {(list.data?.items.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-border">
            <Users size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{list.data?.total} cliente(s)</p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {list.data?.items.map((customer) => (
                <button key={customer.id} onClick={() => setFicha(customer)}
                  className={`text-left bg-white rounded-2xl border border-border hover:border-primary shadow-sm p-4 transition-colors ${customer.active ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-primary font-black truncate">{customerDisplayName(customer)}</p>
                      <p className="text-muted-foreground text-xs">
                        {customer.code} · {customer.type === "PF" ? "PF" : "PJ"}
                        {customer.type === "PJ" && customer.document ? ` · ${formatDocument(customer.document, "juridica")}` : ""}
                      </p>
                      <p className="text-muted-foreground text-xs">{formatPhone(customer.phone)}</p>
                    </div>
                    {!customer.active && <span className="text-[10px] font-black bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Inativo</span>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total comprado</span>
                      <span className="text-primary font-black">{customer.stats.deliveredCount > 0 ? brl(customer.stats.totalBoughtWithDelivery) : "—"}</span></div>
                    {Number(customer.stats.pendingAmount) > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Pendente</span>
                        <span className="text-amber-600 font-black">{brl(customer.stats.pendingAmount)}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-muted-foreground">Última compra</span>
                      <span className="font-bold">{customer.stats.lastPurchase ? formatDate(customer.stats.lastPurchase) : "—"}</span></div>
                  </div>
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-8 h-8 rounded-lg bg-white border border-border disabled:opacity-40 flex items-center justify-center"><ChevronLeft size={15} /></button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="w-8 h-8 rounded-lg bg-white border border-border disabled:opacity-40 flex items-center justify-center"><ChevronRight size={15} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </AsyncBoundary>

      {ficha && !form && (
        <CustomerFicha customer={ficha}
          onClose={() => setFicha(null)}
          onEdit={() => setForm({ customer: ficha })}
          onNewSale={() => { const id = ficha.id; setFicha(null); onNewSale(id); }}
          onOpenSale={(saleId) => { setFicha(null); onOpenSale(saleId); }} />
      )}

      {form && (
        <CustomerFormModal customer={form.customer}
          onClose={() => setForm(null)}
          onSaved={(saved) => { setForm(null); setFicha(form.customer ? saved : null); list.reload(); }} />
      )}
    </div>
  );
}
