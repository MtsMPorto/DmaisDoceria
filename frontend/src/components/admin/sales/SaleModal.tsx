import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { AsyncBoundary } from "@/components/ui/AsyncState";
import { Field } from "@/components/ui/Field";
import { FormError, Modal } from "@/components/ui/Modal";
import { inputCls } from "@/components/admin/customers/inputCls";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
  SALE_STATUS_LABELS,
  SALE_STATUS_STYLES,
} from "@/config/labels";
import { useAsync } from "@/hooks/useAsync";
import { formatDate } from "@/lib/format";
import { brl, parseMoneyInput } from "@/lib/money";
import { errorMessage } from "@/services/api";
import { adminApi } from "@/services/endpoints";
import type { PaymentMethodCode, PaymentStatusCode, SaleDetail } from "@/types/api";

// Fluxo: rascunho -> confirmar (baixa estoque no banco) -> entregue. Confirmada pode ser cancelada
// (estorna o estoque uma única vez); entregue NÃO cancela. Itens e valores só mudam em rascunho.
export function SaleModal({ saleId, onClose, onChanged }: { saleId: number; onClose: () => void; onChanged: () => void }) {
  const detail = useAsync(() => adminApi.sale(saleId), [saleId]);
  const products = useAsync(() => adminApi.products(), []);
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (detail.data) setSale(detail.data);
  }, [detail.data]);

  // Executa uma chamada que devolve a venda atualizada.
  async function run(action: () => Promise<SaleDetail>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      setSale(await action());
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const draft = sale?.status === "DRAFT";

  return (
    <Modal
      wide
      title={sale ? `Venda ${sale.code}` : "Venda"}
      subtitle={sale ? `${sale.customerName} · ${formatDate(sale.saleDate)}` : undefined}
      onClose={onClose}
      footer={sale && (
        <>
          {sale.status === "DRAFT" && (
            <button disabled={busy} onClick={() => void run(() => adminApi.confirmSale(sale.id), "Confirmar a venda? O estoque dos produtos será baixado.")}
              className="bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-black px-4 py-2.5 rounded-xl text-sm flex items-center gap-2">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirmar venda
            </button>
          )}
          {sale.status === "CONFIRMED" && (
            <button disabled={busy} onClick={() => void run(() => adminApi.deliverSale(sale.id), "Marcar como entregue? Depois disso a venda não poderá ser cancelada.")}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-black px-4 py-2.5 rounded-xl text-sm">Marcar como entregue</button>
          )}
          {(sale.status === "DRAFT" || sale.status === "CONFIRMED") && (
            <button disabled={busy}
              onClick={() => void run(() => adminApi.cancelSale(sale.id),
                sale.status === "CONFIRMED"
                  ? "Cancelar a venda confirmada? O estoque será devolvido (uma única vez). Esta ação não pode ser desfeita."
                  : "Cancelar este rascunho?")}
              className="border-2 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60 font-bold px-4 py-2.5 rounded-xl text-sm">
              Cancelar venda
            </button>
          )}
          {sale.status === "DELIVERED" && (
            <p className="text-xs text-muted-foreground self-center">Venda entregue não pode ser cancelada. Devolução e reembolso são tratados à parte.</p>
          )}
        </>
      )}
    >
      <AsyncBoundary loading={detail.loading} error={detail.error} onRetry={detail.reload} hasData={sale !== null}>
        {sale && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${SALE_STATUS_STYLES[sale.status]}`}>{SALE_STATUS_LABELS[sale.status]}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${PAYMENT_STATUS_STYLES[sale.paymentStatus]}`}>{PAYMENT_STATUS_LABELS[sale.paymentStatus]}</span>
              {sale.orderId && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Pedido #{sale.orderId}</span>}
            </div>

            <ItemsSection sale={sale} editable={draft} busy={busy}
              products={(products.data ?? []).filter((product) => product.active)}
              onRun={run} />

            <TotalsSection sale={sale} editable={draft} busy={busy} onRun={run} />
            <PaymentSection sale={sale} busy={busy} onRun={run} />
            <NotesSection sale={sale} busy={busy} onRun={run} />
          </>
        )}
        <FormError message={error} />
      </AsyncBoundary>
    </Modal>
  );
}

type Runner = (action: () => Promise<SaleDetail>, confirmText?: string) => Promise<void>;

function ItemsSection({ sale, editable, busy, products, onRun }: {
  sale: SaleDetail; editable: boolean; busy: boolean; products: { id: number; name: string; brand: string; price: string; minQty: number; flavors: { id: number; name: string; active: boolean }[] }[]; onRun: Runner;
}) {
  const [productId, setProductId] = useState<number | "">("");
  const [flavorId, setFlavorId] = useState<number | "">("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [custom, setCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [localError, setLocalError] = useState("");

  const product = useMemo(() => products.find((candidate) => candidate.id === productId), [products, productId]);
  const flavors = product?.flavors.filter((flavor) => flavor.active) ?? [];

  function selectProduct(value: string) {
    const id = value === "" ? "" : Number(value);
    setProductId(id);
    setFlavorId("");
    const chosen = products.find((candidate) => candidate.id === id);
    setPrice(chosen ? chosen.price : "");
  }

  function add() {
    setLocalError("");
    const unitPrice = parseMoneyInput(price);
    if (unitPrice === null) { setLocalError("Informe o preço unitário (até 2 casas)."); return; }
    const qty = quantity.trim().replace(",", ".");
    if (!/^\d{1,9}(\.\d{1,3})?$/.test(qty) || Number(qty) <= 0) { setLocalError("Quantidade inválida."); return; }

    if (custom) {
      if (!customName.trim()) { setLocalError("Informe a descrição do item."); return; }
      void onRun(() => adminApi.addSaleItem(sale.id, { productName: customName.trim(), quantity: qty, unitPrice }));
      setCustomName("");
      return;
    }

    if (productId === "") { setLocalError("Escolha o produto."); return; }
    if (!Number.isInteger(Number(qty))) { setLocalError("Produto do catálogo só aceita quantidade inteira."); return; }
    if (flavors.length > 0 && flavorId === "") { setLocalError("Escolha o sabor."); return; }
    void onRun(() => adminApi.addSaleItem(sale.id, {
      productId,
      ...(flavorId === "" ? {} : { flavorId }),
      quantity: qty,
      unitPrice,
    }));
  }

  return (
    <div>
      <p className="text-primary font-bold text-sm mb-2">Itens</p>
      {sale.items.length === 0 ? (
        <p className="text-muted-foreground text-sm bg-muted/40 rounded-xl px-3 py-4 text-center">Nenhum item ainda.</p>
      ) : (
        <ul className="space-y-2">
          {sale.items.map((item) => (
            <ItemRow key={item.id} item={item} editable={editable} busy={busy} saleId={sale.id} onRun={onRun} />
          ))}
        </ul>
      )}

      {editable && (
        <div className="mt-3 border border-dashed border-border rounded-2xl p-3 space-y-2 bg-muted/20">
          <div className="flex gap-1 text-xs font-bold">
            <button onClick={() => setCustom(false)} className={`px-3 py-1 rounded-lg ${!custom ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>Produto do catálogo</button>
            <button onClick={() => setCustom(true)} className={`px-3 py-1 rounded-lg ${custom ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>Item avulso</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {custom ? (
              <div className="col-span-2 sm:col-span-3">
                <input type="text" placeholder="Descrição do item" value={customName} onChange={(e) => setCustomName(e.target.value)} className={inputCls} />
              </div>
            ) : (
              <>
                <div className="col-span-2 sm:col-span-2">
                  <select value={productId} onChange={(e) => selectProduct(e.target.value)} className={inputCls}>
                    <option value="">Produto...</option>
                    {products.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.brand})</option>)}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <select value={flavorId} onChange={(e) => setFlavorId(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={flavors.length === 0} className={`${inputCls} disabled:opacity-50`}>
                    <option value="">{flavors.length === 0 ? "Sem sabor" : "Sabor..."}</option>
                    {flavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <input type="text" inputMode="decimal" placeholder={custom ? "Qtd. (até 3 casas)" : "Qtd."} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
            <input type="text" inputMode="decimal" placeholder="Preço un." value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
            <button onClick={add} disabled={busy}
              className="bg-accent hover:bg-orange-500 disabled:opacity-60 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1 py-2">
              <Plus size={14} /> Incluir
            </button>
          </div>
          {product && <p className="text-[11px] text-muted-foreground">Mínimo para confirmar: {product.minQty} un. (somando os sabores do produto).</p>}
          <FormError message={localError} />
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, editable, busy, saleId, onRun }: {
  item: SaleDetail["items"][number]; editable: boolean; busy: boolean; saleId: number; onRun: Runner;
}) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [price, setPrice] = useState(item.unitPrice);

  useEffect(() => { setQuantity(item.quantity); setPrice(item.unitPrice); }, [item.quantity, item.unitPrice]);

  function commit() {
    const unitPrice = parseMoneyInput(price);
    const qty = quantity.trim().replace(",", ".");
    if (unitPrice === null || !/^\d{1,9}(\.\d{1,3})?$/.test(qty) || Number(qty) <= 0) {
      setQuantity(item.quantity);
      setPrice(item.unitPrice);
      return;
    }
    if (Number(qty) === Number(item.quantity) && unitPrice === item.unitPrice) return;
    void onRun(() => adminApi.updateSaleItem(saleId, item.id, { quantity: qty, unitPrice }));
  }

  return (
    <li className="border border-border rounded-xl p-3 flex flex-wrap items-center gap-3 justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-primary font-bold text-sm">
          {item.productName}{item.flavorName ? <span className="text-accent"> · {item.flavorName}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">{[item.brand, item.unit].filter(Boolean).join(" · ") || (item.productId ? "" : "Item avulso")}</p>
      </div>
      {editable ? (
        <div className="flex items-center gap-2">
          <input type="text" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} onBlur={commit} className={`${inputCls} w-20`} aria-label="Quantidade" />
          <span className="text-muted-foreground text-xs">×</span>
          <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={commit} className={`${inputCls} w-24`} aria-label="Preço unitário" />
          <span className="text-primary font-black text-sm tabular-nums w-24 text-right">{brl(item.subtotal)}</span>
          <button disabled={busy} onClick={() => void onRun(() => adminApi.removeSaleItem(saleId, item.id))}
            className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center" aria-label="Remover item">
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <div className="text-right text-sm">
          <p className="text-muted-foreground text-xs">{Number(item.quantity)} × {brl(item.unitPrice)}</p>
          <p className="text-primary font-black tabular-nums">{brl(item.subtotal)}</p>
        </div>
      )}
    </li>
  );
}

function TotalsSection({ sale, editable, busy, onRun }: { sale: SaleDetail; editable: boolean; busy: boolean; onRun: Runner }) {
  const [discount, setDiscount] = useState(sale.discount);
  const [fee, setFee] = useState(sale.deliveryFee);
  const [date, setDate] = useState(sale.saleDate);
  const [localError, setLocalError] = useState("");

  useEffect(() => { setDiscount(sale.discount); setFee(sale.deliveryFee); setDate(sale.saleDate); }, [sale.discount, sale.deliveryFee, sale.saleDate]);

  function save() {
    setLocalError("");
    const discountValue = parseMoneyInput(discount === "" ? "0" : discount);
    const feeValue = parseMoneyInput(fee === "" ? "0" : fee);
    if (discountValue === null || feeValue === null) { setLocalError("Valores inválidos (até 2 casas decimais)."); return; }
    if (!date) { setLocalError("Informe a data da venda."); return; }
    void onRun(() => adminApi.updateSale(sale.id, { discount: discountValue, deliveryFee: feeValue, saleDate: date }));
  }

  return (
    <div className="bg-muted/40 rounded-2xl p-4 space-y-3">
      {editable && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Data da venda">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Desconto (R$)">
            <input type="text" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Frete (R$)">
            <input type="text" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} />
          </Field>
        </div>
      )}
      {editable && (
        <button onClick={save} disabled={busy} className="text-xs font-bold text-primary border border-primary/30 hover:bg-primary/5 rounded-lg px-3 py-1.5">
          Aplicar desconto, frete e data
        </button>
      )}
      <FormError message={localError} />
      <dl className="text-sm space-y-1">
        <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{brl(sale.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Desconto</dt><dd className="tabular-nums text-green-600">− {brl(sale.discount)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Frete</dt><dd className="tabular-nums">+ {brl(sale.deliveryFee)}</dd></div>
        <div className="flex justify-between border-t border-border pt-1.5 text-base"><dt className="font-black text-primary">Total</dt><dd className="font-black text-primary tabular-nums">{brl(sale.total)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Recebido</dt><dd className="tabular-nums">{brl(sale.paidAmount)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Pendente</dt><dd className="tabular-nums text-amber-600 font-bold">{brl(sale.pendingAmount)}</dd></div>
      </dl>
    </div>
  );
}

function PaymentSection({ sale, busy, onRun }: { sale: SaleDetail; busy: boolean; onRun: Runner }) {
  const [method, setMethod] = useState<PaymentMethodCode | "">(sale.paymentMethod ?? "");
  const [status, setStatus] = useState<PaymentStatusCode>(sale.paymentStatus);
  const [paid, setPaid] = useState(sale.paymentStatus === "PARTIAL" ? sale.paidAmount : "");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setMethod(sale.paymentMethod ?? "");
    setStatus(sale.paymentStatus);
    setPaid(sale.paymentStatus === "PARTIAL" ? sale.paidAmount : "");
  }, [sale.paymentMethod, sale.paymentStatus, sale.paidAmount]);

  if (sale.status === "CANCELED") return null;

  function save() {
    setLocalError("");
    let paidAmount: string | undefined;
    if (status === "PARTIAL") {
      const parsed = parseMoneyInput(paid);
      if (parsed === null || Number(parsed) <= 0) { setLocalError("Informe o valor já recebido (maior que zero)."); return; }
      if (Number(parsed) >= Number(sale.total)) { setLocalError("No pagamento parcial o valor recebido deve ser menor que o total."); return; }
      paidAmount = parsed;
    }
    void onRun(() => adminApi.updateSale(sale.id, {
      paymentMethod: method === "" ? null : method,
      paymentStatus: status,
      ...(paidAmount === undefined ? {} : { paidAmount }),
    }));
  }

  return (
    <div className="space-y-3">
      <p className="text-primary font-bold text-sm">Pagamento</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Forma de pagamento">
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodCode | "")} className={inputCls}>
            <option value="">Não informada</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Situação">
          <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatusCode)} className={inputCls}>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
      </div>
      {status === "PARTIAL" && (
        <Field label="Valor já recebido (R$)">
          <input type="text" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0,00" className={inputCls} />
        </Field>
      )}
      <FormError message={localError} />
      <button onClick={save} disabled={busy} className="text-xs font-bold text-primary border border-primary/30 hover:bg-primary/5 rounded-lg px-3 py-1.5">
        Salvar pagamento
      </button>
      <p className="text-[11px] text-muted-foreground">Registro manual do que foi recebido; o sistema não processa pagamentos.</p>
    </div>
  );
}

function NotesSection({ sale, busy, onRun }: { sale: SaleDetail; busy: boolean; onRun: Runner }) {
  const [notes, setNotes] = useState(sale.notes ?? "");
  useEffect(() => setNotes(sale.notes ?? ""), [sale.notes]);
  if (sale.status === "CANCELED") return <p className="text-sm text-muted-foreground">{sale.notes}</p>;

  return (
    <Field label="Observações">
      <textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)}
        onBlur={() => { if ((sale.notes ?? "") !== notes.trim()) void onRun(() => adminApi.updateSale(sale.id, { notes: notes.trim() || null })); }}
        disabled={busy} className={`${inputCls} resize-none`} />
    </Field>
  );
}
