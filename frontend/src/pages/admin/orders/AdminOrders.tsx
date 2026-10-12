import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Inbox } from "lucide-react";
import { AsyncBoundary } from "@/components/ui/AsyncState";
import { FormError, Modal } from "@/components/ui/Modal";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES, SALE_STATUS_LABELS, SALE_STATUS_STYLES } from "@/config/labels";
import { useAsync } from "@/hooks/useAsync";
import { formatCEP, formatDocument, formatPhone } from "@/lib/format";
import { brl } from "@/lib/money";
import { errorMessage } from "@/services/api";
import { adminApi } from "@/services/endpoints";

const PAGE_SIZE = 20;

const formatDateTime = (iso: string) =>
  new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

// "Solicitações": pedidos registrados pela loja. Não baixam estoque. Só podem ser cancelados
// (REQUESTED -> CANCELED); viram CONFIRMED quando a venda vinculada é confirmada.
export default function AdminOrders({ onOpenSale }: { onOpenSale: (saleId: number) => void }) {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  const list = useAsync(
    () => adminApi.orders({ status: "REQUESTED", page, limit: PAGE_SIZE }),
    [page],
  );

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));
  useEffect(() => {
    if (!list.loading && list.data && page > totalPages) setPage(totalPages);
  }, [list.loading, list.data, page, totalPages]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl">
          <span className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white text-primary shadow-sm">Solicitações pendentes</span>
        </div>
        <p className="text-muted-foreground text-xs">Mais recentes primeiro · pedidos não baixam estoque</p>
      </div>

      <AsyncBoundary loading={list.loading} error={list.error} onRetry={list.reload} hasData={list.data !== null}>
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          {(list.data?.items.length ?? 0) === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Inbox size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-sm">Nenhuma solicitação neste filtro</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold text-[10px] uppercase tracking-wide text-left">
                    <th className="px-4 py-2.5">Nº</th>
                    <th className="px-3 py-2.5">Data</th>
                    <th className="px-3 py-2.5">Cliente</th>
                    <th className="px-3 py-2.5 hidden sm:table-cell">Cidade</th>
                    <th className="px-3 py-2.5 text-right">Itens</th>
                    <th className="px-3 py-2.5">Situação</th>
                    <th className="px-3 py-2.5">Venda</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {list.data?.items.map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-black text-primary">#{order.id}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDateTime(order.createdAt)}</td>
                      <td className="px-3 py-2.5 font-bold">{order.customerName}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground">{order.city}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{order.totalItems}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${ORDER_STATUS_STYLES[order.status]}`}>{ORDER_STATUS_LABELS[order.status]}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {order.sale ? (
                          <button onClick={() => onOpenSale(order.sale!.id)} className="text-primary font-bold text-xs hover:underline">{order.sale.code}</button>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setOpenId(order.id)} className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center" aria-label="Ver pedido">
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
              <p className="text-xs text-muted-foreground">Página {page} de {totalPages} · {list.data?.total} pedidos</p>
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

      {openId !== null && (
        <OrderModal id={openId} onClose={() => setOpenId(null)} onChanged={list.reload}
          onOpenSale={(saleId) => { setOpenId(null); onOpenSale(saleId); }} />
      )}
    </div>
  );
}

function OrderModal({ id, onClose, onChanged, onOpenSale }: {
  id: number; onClose: () => void; onChanged: () => void; onOpenSale: (saleId: number) => void;
}) {
  const detail = useAsync(() => adminApi.order(id), [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const order = detail.data;

  async function createSale() {
    setBusy(true);
    setError("");
    try {
      const sale = await adminApi.createSaleFromOrder(id);
      onChanged();
      onOpenSale(sale.id);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      await adminApi.cancelOrder(id);
      onChanged();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const canAct = order?.status === "REQUESTED" && !order.sale;

  return (
    <Modal wide title={`Solicitação #${id}`} subtitle={order ? formatDateTime(order.createdAt) : undefined} onClose={onClose}
      footer={order && (
        <>
          {order.sale && (
            <button onClick={() => onOpenSale(order.sale!.id)}
              className="bg-primary hover:bg-primary/90 text-white font-black px-4 py-2.5 rounded-xl text-sm">Abrir venda {order.sale.code}</button>
          )}
          {canAct && (
            <>
              <button onClick={() => void createSale()} disabled={busy}
                className="bg-accent hover:bg-orange-500 disabled:opacity-60 text-white font-black px-4 py-2.5 rounded-xl text-sm">Criar venda a partir do pedido</button>
              <button onClick={() => void cancel()} disabled={busy}
                className="border-2 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60 font-bold px-4 py-2.5 rounded-xl text-sm">Cancelar solicitação</button>
            </>
          )}
        </>
      )}>
      <AsyncBoundary loading={detail.loading} error={detail.error} onRetry={detail.reload} hasData={order !== null}>
        {order && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${ORDER_STATUS_STYLES[order.status]}`}>{ORDER_STATUS_LABELS[order.status]}</span>
              {order.sale && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${SALE_STATUS_STYLES[order.sale.status]}`}>
                  Venda {order.sale.code} · {SALE_STATUS_LABELS[order.sale.status]}
                </span>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-muted-foreground text-[10px] font-bold uppercase">Cliente</p>
                <p className="text-primary font-black">{order.customer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {order.customer.type === "PJ" ? `CNPJ ${formatDocument(order.customer.document || "", "juridica")}` : "Pessoa Física"}
                </p>
                <p className="text-xs text-muted-foreground">{formatPhone(order.customer.phone)}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-muted-foreground text-[10px] font-bold uppercase">Entrega</p>
                <p className="text-xs">{order.customer.street}, {order.customer.streetNumber}{order.customer.complement ? ` — ${order.customer.complement}` : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {[order.customer.neighborhood, `${order.customer.city}/${order.customer.state}`].filter(Boolean).join(" · ")} · CEP {formatCEP(order.customer.zip)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-primary font-bold text-sm mb-2">Itens</p>
              <ul className="space-y-2">
                {order.items.map((item) => (
                  <li key={item.id} className="border border-border rounded-xl p-3">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="text-primary font-bold text-sm">{item.productName} <span className="text-muted-foreground font-normal">({item.brand})</span></p>
                        <p className="text-xs text-muted-foreground">{item.unit} · mín. {item.minQty}</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="font-black text-primary">{item.totalQuantity} un.</p>
                        <p className="text-xs text-muted-foreground">{brl(item.unitPrice)}/un.</p>
                      </div>
                    </div>
                    {item.flavors.some((flavor) => flavor.flavor) && (
                      <p className="text-xs text-accent font-bold mt-1">
                        {item.flavors.map((flavor) => `${flavor.flavor} × ${flavor.quantity}`).join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        <FormError message={error} />
      </AsyncBoundary>
    </Modal>
  );
}
