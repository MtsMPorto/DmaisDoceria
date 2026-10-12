import { useState } from "react";
import { Pencil, Receipt } from "lucide-react";
import { AsyncBoundary } from "@/components/ui/AsyncState";
import { Modal } from "@/components/ui/Modal";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
  SALE_STATUS_LABELS,
  SALE_STATUS_STYLES,
} from "@/config/labels";
import { useAsync } from "@/hooks/useAsync";
import { formatCEP, formatDate, formatDocument, formatPhone } from "@/lib/format";
import { brl } from "@/lib/money";
import { adminApi } from "@/services/endpoints";
import type { CustomerRecord } from "@/types/api";

export function customerDisplayName(customer: Pick<CustomerRecord, "type" | "name" | "tradeName">): string {
  return customer.type === "PJ" ? customer.tradeName || customer.name : customer.name;
}

export function CustomerFicha({ customer, onEdit, onNewSale, onOpenSale, onClose }: {
  customer: CustomerRecord; onEdit: () => void; onNewSale: () => void; onOpenSale: (saleId: number) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<"dados" | "historico">("dados");
  const history = useAsync(() => adminApi.customerSales(customer.id), [customer.id]);
  const { stats } = customer;

  return (
    <Modal wide title={customerDisplayName(customer)}
      subtitle={`${customer.code} · ${customer.type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}${customer.active ? "" : " · INATIVO"}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onEdit} className="flex items-center gap-2 border-2 border-border text-primary hover:border-primary font-bold px-4 py-2.5 rounded-xl text-sm">
            <Pencil size={14} /> Editar
          </button>
          {customer.active && (
            <button onClick={onNewSale} className="flex items-center gap-2 bg-accent hover:bg-orange-500 text-white font-black px-4 py-2.5 rounded-xl text-sm">
              <Receipt size={14} /> Nova venda
            </button>
          )}
        </>
      }>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total comprado", value: stats.deliveredCount > 0 ? brl(stats.totalBoughtWithDelivery) : "—", sub: "vendas entregues" },
          { label: "Valor pendente", value: brl(stats.pendingAmount), sub: "a receber", warn: Number(stats.pendingAmount) > 0 },
          { label: "Produto favorito", value: stats.topProduct ?? "—", sub: "mais comprado" },
          { label: "Última compra", value: stats.lastPurchase ? formatDate(stats.lastPurchase) : "—", sub: `${stats.deliveredCount} entregues · ${stats.salesCount} vendas` },
        ].map((card) => (
          <div key={card.label} className="bg-muted/40 rounded-xl p-3">
            <p className="text-muted-foreground text-[10px] font-bold uppercase leading-tight">{card.label}</p>
            <p className={`font-black text-sm mt-0.5 ${card.warn ? "text-amber-600" : "text-primary"}`}>{card.value}</p>
            <p className="text-muted-foreground text-[10px]">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit">
        {([["dados", "Dados"], ["historico", "Histórico de vendas"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg ${tab === key ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}>{label}</button>
        ))}
      </div>

      {tab === "dados" ? (
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ["Nome", customer.name],
            ["Nome fantasia", customer.tradeName],
            ["Responsável", customer.responsibleName],
            ...(customer.type === "PJ" ? [["CNPJ", customer.document ? formatDocument(customer.document, "juridica") : null]] : []),
            ["Telefone", formatPhone(customer.phone)],
            ["E-mail", customer.email],
            ["Endereço", [customer.street, customer.streetNumber].filter(Boolean).join(", ") + (customer.complement ? ` — ${customer.complement}` : "") || null],
            ["Bairro", customer.neighborhood],
            ["Cidade/UF", [customer.city, customer.state].filter(Boolean).join("/") || null],
            ["CEP", customer.zip ? formatCEP(customer.zip) : null],
            ["Observações", customer.notes],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-muted-foreground text-[10px] font-bold uppercase">{label}</dt>
              <dd className="text-foreground">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <AsyncBoundary loading={history.loading} error={history.error} onRetry={history.reload} hasData={history.data !== null}>
          {history.data?.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhuma venda registrada para este cliente.</p>
          ) : (
            <ul className="space-y-2">
              {history.data?.map((sale) => (
                <li key={sale.id} className="border border-border rounded-xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => onOpenSale(sale.id)} className="text-primary font-black text-sm font-mono hover:underline">{sale.code}</button>
                      <span className="text-muted-foreground text-xs">{formatDate(sale.saleDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${SALE_STATUS_STYLES[sale.status]}`}>{SALE_STATUS_LABELS[sale.status]}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${PAYMENT_STATUS_STYLES[sale.paymentStatus]}`}>{PAYMENT_STATUS_LABELS[sale.paymentStatus]}</span>
                      <span className="text-primary font-black text-sm tabular-nums">{brl(sale.total)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sale.items.map((item) => `${item.productName}${item.flavorName ? ` (${item.flavorName})` : ""} × ${Number(item.quantity)}`).join(" · ") || "Sem itens"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </AsyncBoundary>
      )}
    </Modal>
  );
}
