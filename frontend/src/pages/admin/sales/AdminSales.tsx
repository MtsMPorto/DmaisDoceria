import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Plus, Receipt, Search } from "lucide-react";
import { SaleModal } from "@/components/admin/sales/SaleModal";
import { AsyncBoundary } from "@/components/ui/AsyncState";
import { FormError, Modal } from "@/components/ui/Modal";
import { inputCls } from "@/components/admin/customers/inputCls";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_STYLES, SALE_STATUS_LABELS, SALE_STATUS_STYLES } from "@/config/labels";
import { useAsync } from "@/hooks/useAsync";
import { formatDate } from "@/lib/format";
import { brl } from "@/lib/money";
import { errorMessage } from "@/services/api";
import { adminApi } from "@/services/endpoints";
import type { SaleStatus } from "@/types/api";

const PAGE_SIZE = 20;

export default function AdminSales({
  openSaleId,
  onOpenedSale,
  newSaleForCustomerId,
  onNewSaleHandled,
}: {
  openSaleId: number | null;
  onOpenedSale: () => void;
  newSaleForCustomerId: number | null;
  onNewSaleHandled: () => void;
}) {
  const [status, setStatus] = useState<SaleStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const list = useAsync(
    () => adminApi.sales({ status: status === "ALL" ? undefined : status, q: query || undefined, page, limit: PAGE_SIZE }),
    [status, query, page],
  );

  // Abre a venda pedida por outra aba (Solicitações) ou cria um rascunho para um cliente.
  useEffect(() => {
    if (openSaleId !== null) {
      setSelected(openSaleId);
      onOpenedSale();
    }
  }, [openSaleId, onOpenedSale]);

  useEffect(() => {
    if (newSaleForCustomerId === null) return;
    let cancelled = false;
    adminApi
      .createSale({ customerId: newSaleForCustomerId })
      .then((sale) => { if (!cancelled) { setSelected(sale.id); list.reload(); } })
      .catch((err: unknown) => { if (!cancelled) setCreateError(errorMessage(err)); })
      .finally(() => { if (!cancelled) onNewSaleHandled(); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSaleForCustomerId]);

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex gap-2 flex-wrap flex-1">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Código ou cliente..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setQuery(search.trim()); setPage(1); } }}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border focus:border-primary outline-none text-sm bg-background" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as SaleStatus | "ALL"); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-border text-sm bg-background text-primary font-semibold">
            <option value="ALL">Todas as situações</option>
            {(Object.keys(SALE_STATUS_LABELS) as SaleStatus[]).map((code) => <option key={code} value={code}>{SALE_STATUS_LABELS[code]}</option>)}
          </select>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 bg-accent hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md shadow-accent/30">
          <Plus size={16} /> Nova venda
        </button>
      </div>

      <FormError message={createError} />

      <AsyncBoundary loading={list.loading} error={list.error} onRetry={list.reload} hasData={list.data !== null}>
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          {(list.data?.items.length ?? 0) === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Receipt size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-sm">Nenhuma venda encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold text-[10px] uppercase tracking-wide text-left">
                    <th className="px-4 py-2.5">Código</th>
                    <th className="px-3 py-2.5">Data</th>
                    <th className="px-3 py-2.5">Cliente</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                    <th className="px-3 py-2.5 text-right hidden sm:table-cell">Pendente</th>
                    <th className="px-3 py-2.5">Pagamento</th>
                    <th className="px-3 py-2.5">Situação</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {list.data?.items.map((sale) => (
                    <tr key={sale.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-black text-primary font-mono text-xs">{sale.code}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(sale.saleDate)}</td>
                      <td className="px-3 py-2.5 font-bold">{sale.customerName}</td>
                      <td className="px-3 py-2.5 text-right font-black text-primary tabular-nums whitespace-nowrap">{brl(sale.total)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell">{Number(sale.pendingAmount) > 0 ? brl(sale.pendingAmount) : "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${PAYMENT_STATUS_STYLES[sale.paymentStatus]}`}>{PAYMENT_STATUS_LABELS[sale.paymentStatus]}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${SALE_STATUS_STYLES[sale.status]}`}>{SALE_STATUS_LABELS[sale.status]}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setSelected(sale.id)} className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center" aria-label="Abrir venda">
                          <Eye size={13} className="text-primary" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">Página {page} de {totalPages} · {list.data?.total} vendas</p>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-7 h-7 rounded-lg bg-muted disabled:opacity-40 flex items-center justify-center"><ChevronLeft size={14} /></button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="w-7 h-7 rounded-lg bg-muted disabled:opacity-40 flex items-center justify-center"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      </AsyncBoundary>

      {selected !== null && <SaleModal saleId={selected} onClose={() => setSelected(null)} onChanged={list.reload} />}
      {creating && (
        <NewSaleModal
          onClose={() => setCreating(false)}
          onCreated={(saleId) => { setCreating(false); setSelected(saleId); list.reload(); }}
        />
      )}
    </div>
  );
}

function NewSaleModal({ onClose, onCreated }: { onClose: () => void; onCreated: (saleId: number) => void }) {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const customers = useAsync(() => adminApi.customers({ q: query || undefined, active: true, limit: 20 }), [query]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  async function pick(customerId: number) {
    setError("");
    try {
      const sale = await adminApi.createSale({ customerId });
      onCreated(sale.id);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal title="Nova venda" subtitle="Escolha o cliente. A venda começa como rascunho." onClose={onClose}>
      <input type="text" autoFocus placeholder="Buscar cliente por nome, código, documento ou telefone" value={term}
        onChange={(e) => setTerm(e.target.value)} className={inputCls} />
      <FormError message={error} />
      <AsyncBoundary loading={customers.loading} error={customers.error} onRetry={customers.reload} hasData={customers.data !== null}>
        <ul className="space-y-1.5">
          {customers.data?.items.map((customer) => (
            <li key={customer.id}>
              <button onClick={() => void pick(customer.id)}
                className="w-full text-left border border-border hover:border-primary rounded-xl px-3 py-2.5 transition-colors">
                <p className="text-primary font-bold text-sm">{customer.tradeName || customer.name}</p>
                <p className="text-xs text-muted-foreground">{customer.code} · {customer.phone}</p>
              </button>
            </li>
          ))}
          {customers.data?.items.length === 0 && <li className="text-center text-muted-foreground text-sm py-6">Nenhum cliente ativo encontrado. Cadastre o cliente na aba Clientes.</li>}
        </ul>
      </AsyncBoundary>
    </Modal>
  );
}
