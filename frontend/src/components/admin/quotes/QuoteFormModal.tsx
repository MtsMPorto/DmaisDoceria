import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, Check, DollarSign, FileText, MessageSquare, Package, Plus, ShoppingBag, Trash2, User, X } from "lucide-react";
import { QUOTE_STATUS_CONFIG } from "@/config/labels";
import { getDisplayName } from "@/lib/customers";
import { formatCurrency, normalizePhone } from "@/lib/format";
import { calcTotals, isExpired } from "@/lib/quotes";
import type { Customer, DiscountType, Quote, QuoteItem } from "@/types";
import { CustomerSearchBox } from "./CustomerSearchBox";
import { ItemRow } from "./ItemRow";

export const EMPTY_ITEM: QuoteItem = {
  productId: 0, productName: "", productBrand: "", productUnit: "",
  unitPrice: 0, qty: 1, subtotal: 0, notes: "",
};

export interface QuoteFormState {
  customerId: string;
  customerName: string;
  customerPhone: string;
  isNewCustomer: boolean;
  newName: string;
  newPhone: string;
  items: QuoteItem[];
  discountType: DiscountType;
  discountValue: number;
  deliveryFee: number;
  validity: string;
  deliveryDate: string;
  paymentTerms: string;
  customerNotes: string;
  internalNotes: string;
  markNotClosed: boolean;
  closedReason: string;
}

export function buildFormState(q: Quote | null): QuoteFormState {
  if (!q) return {
    customerId: "", customerName: "", customerPhone: "",
    isNewCustomer: false, newName: "", newPhone: "",
    items: [{ ...EMPTY_ITEM }],
    discountType: "reais", discountValue: 0, deliveryFee: 0,
    validity: "", deliveryDate: "", paymentTerms: "",
    customerNotes: "", internalNotes: "",
    markNotClosed: false, closedReason: "",
  };
  return {
    customerId: q.customerId, customerName: q.customerName, customerPhone: q.customerPhone,
    isNewCustomer: false, newName: "", newPhone: "",
    items: q.items.length > 0 ? q.items : [{ ...EMPTY_ITEM }],
    discountType: q.discountType, discountValue: q.discountValue, deliveryFee: q.deliveryFee,
    validity: q.validity, deliveryDate: q.deliveryDate,
    paymentTerms: q.paymentTerms, customerNotes: q.customerNotes,
    internalNotes: q.internalNotes,
    markNotClosed: q.status === "nao_fechado", closedReason: q.closedReason,
  };
}

export interface QuoteFormModalProps {
  open: boolean;
  editingQuote: Quote | null;
  customers: Customer[];
  products: Array<{ id: number; name: string; brand: string; unit: string; price: number; active: boolean }>;
  onClose: () => void;
  onSave: (form: QuoteFormState, editing: Quote | null) => string | null;
  onWhatsApp: (quote: Quote) => void;
  onConvert: (quote: Quote) => void;
  onDuplicate: (quote: Quote) => void;
  onDelete: (id: string) => void;
  allQuotes: Quote[];
}

export function QuoteFormModal({
  open, editingQuote, customers, products, onClose, onSave,
  onWhatsApp, onConvert, onDuplicate, onDelete, allQuotes,
}: QuoteFormModalProps) {
  const [form, setForm] = useState<QuoteFormState>(() => buildFormState(editingQuote));
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildFormState(editingQuote));
      setError(""); setPhoneError(""); setShowDeleteConfirm(false);
    }
  }, [open, editingQuote]);

  const set = (patch: Partial<QuoteFormState>) => setForm(f => ({ ...f, ...patch }));

  const { subtotal, discountAmount, total } = useMemo(() =>
    calcTotals(form.items, form.discountType, form.discountValue, form.deliveryFee),
    [form.items, form.discountType, form.discountValue, form.deliveryFee]);

  const maxDiscount = form.discountType === "percentual" ? 100 : subtotal;

  const isReadOnly = editingQuote?.status === "fechado";
  const canEdit = !isReadOnly && (editingQuote?.status !== "nao_fechado" || true);

  function updateItem(i: number, updated: QuoteItem) {
    const items = [...form.items];
    items[i] = updated;
    set({ items });
  }

  function removeItem(i: number) {
    set({ items: form.items.filter((_, idx) => idx !== i) });
  }

  function addItem() {
    set({ items: [...form.items, { ...EMPTY_ITEM }] });
  }

  function validate(): boolean {
    const name = form.isNewCustomer ? form.newName.trim() : form.customerName;
    const phone = form.isNewCustomer ? form.newPhone : form.customerPhone;

    if (!name) { setError("Informe o nome do cliente."); return false; }
    if (!phone || normalizePhone(phone).length < 10) { setPhoneError("Informe um WhatsApp válido com DDD."); return false; }

    const validItems = form.items.filter(i => i.productId && i.qty > 0);
    if (validItems.length === 0) { setError("Adicione pelo menos um produto."); return false; }
    if (discountAmount < 0) { setError("Desconto inválido."); return false; }
    if (form.discountValue > maxDiscount) { setError(`Desconto não pode exceder ${form.discountType === "percentual" ? "100%" : formatCurrency(subtotal)}.`); return false; }
    return true;
  }

  function handleSave() {
    setError(""); setPhoneError("");
    if (!validate()) return;

    // Check phone dedup for new customers
    if (form.isNewCustomer) {
      const digits = normalizePhone(form.newPhone);
      const duplicate = customers.find(c => normalizePhone(c.phone) === digits);
      if (duplicate) {
        const use = window.confirm(`Já existe um cliente com esse telefone: ${getDisplayName(duplicate)} (${duplicate.code}). Deseja usar esse cadastro?`);
        if (use) {
          set({ customerId: duplicate.id, customerName: getDisplayName(duplicate), customerPhone: duplicate.phone, isNewCustomer: false });
          return; // user needs to re-confirm save
        }
      }
    }

    const result = onSave({ ...form, items: form.items.filter(i => i.productId && i.qty > 0) }, editingQuote);
    if (result) setError(result);
  }

  const inputCls = "w-full px-3 py-2 text-xs border border-border rounded-xl outline-none focus:border-primary bg-white disabled:bg-muted/30 disabled:text-muted-foreground";

  if (!open) return null;

  const expired = editingQuote ? isExpired(editingQuote.validity) && editingQuote.status === "em_aberto" : false;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div style={{ background: "#27408A" }} className="px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="text-white/60 text-xs">{editingQuote ? editingQuote.code : "Novo orçamento"}</p>
            <h2 className="text-white font-black text-lg leading-tight" style={{ fontFamily: "'Baloo 2', cursive" }}>
              {editingQuote ? (editingQuote.customerName || "Orçamento") : "Novo Orçamento"}
            </h2>
            {editingQuote && (
              <div className="flex gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${QUOTE_STATUS_CONFIG[editingQuote.status].badge}`}>
                  {QUOTE_STATUS_CONFIG[editingQuote.status].label}
                </span>
                {expired && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏳ Validade vencida</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        {/* Action bar (for existing quotes) */}
        {editingQuote && (
          <div className="flex gap-2 px-4 py-2 border-b border-border bg-muted/20 shrink-0 overflow-x-auto">
            {editingQuote.status === "em_aberto" && (
              <button onClick={() => onConvert(editingQuote)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-colors whitespace-nowrap">
                <ShoppingBag size={12} /> Transformar em pedido
              </button>
            )}
            <button onClick={() => onWhatsApp(editingQuote)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-xl hover:bg-[#1ebe5a] transition-colors whitespace-nowrap">
              <MessageSquare size={12} /> WhatsApp
            </button>
            <button onClick={() => onDuplicate(editingQuote)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-bold text-muted-foreground rounded-xl hover:border-primary hover:text-primary transition-colors whitespace-nowrap">
              <FileText size={12} /> Duplicar
            </button>
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 text-xs font-bold rounded-xl hover:bg-red-50 transition-colors ml-auto whitespace-nowrap">
                <Trash2 size={12} /> Excluir
              </button>
            ) : (
              <div className="ml-auto flex gap-1.5 items-center">
                <span className="text-xs text-red-600 font-bold">Confirmar exclusão?</span>
                <button onClick={() => { onDelete(editingQuote.id); onClose(); }}
                  className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700">Sim</button>
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-1 border border-border text-xs font-bold rounded-lg hover:bg-muted">Não</button>
              </div>
            )}
          </div>
        )}

        {/* Form body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* CLIENTE */}
          <section>
            <h3 className="text-primary font-black text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User size={12} /> Cliente
            </h3>
            <CustomerSearchBox
              customers={customers}
              selectedId={form.customerId}
              selectedName={form.customerName}
              selectedPhone={form.customerPhone}
              onSelect={(id, name, phone) => set({ customerId: id, customerName: name, customerPhone: phone, isNewCustomer: false })}
              onClearCustomer={() => set({ customerId: "", customerName: "", customerPhone: "", isNewCustomer: false, newName: "", newPhone: "" })}
              isNewMode={form.isNewCustomer}
              newName={form.newName}
              newPhone={form.newPhone}
              onNewNameChange={v => set({ newName: v })}
              onNewPhoneChange={v => { set({ newPhone: v }); setPhoneError(""); }}
              onSwitchToNew={() => set({ isNewCustomer: true, customerId: "", customerName: "", customerPhone: "" })}
            />
            {phoneError && <p className="text-red-500 text-[10px] mt-1">{phoneError}</p>}
          </section>

          {/* PRODUTOS */}
          <section>
            <h3 className="text-primary font-black text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Package size={12} /> Produtos
            </h3>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <ItemRow key={i} item={item} products={products}
                  onChange={updated => updateItem(i, updated)}
                  onRemove={() => removeItem(i)} />
              ))}
            </div>
            <button onClick={addItem}
              className="mt-2 flex items-center gap-1.5 text-xs text-primary font-bold hover:underline transition-colors">
              <Plus size={13} /> Adicionar item
            </button>
          </section>

          {/* PREÇOS */}
          <section>
            <h3 className="text-primary font-black text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <DollarSign size={12} /> Preços
            </h3>
            <div className="bg-muted/20 rounded-2xl p-4 space-y-3">
              {/* Discount */}
              <div>
                <label className="text-[10px] text-muted-foreground font-bold block mb-1">Desconto</label>
                <div className="flex gap-2">
                  <div className="flex bg-white border border-border rounded-xl overflow-hidden">
                    {([["reais", "R$"], ["percentual", "%"]] as [DiscountType, string][]).map(([k, l]) => (
                      <button key={k} onClick={() => set({ discountType: k, discountValue: 0 })}
                        className={`px-3 py-2 text-xs font-bold transition-colors ${form.discountType === k ? "bg-primary text-white" : "text-muted-foreground hover:text-primary"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <input type="number" min="0" step={form.discountType === "percentual" ? "0.1" : "0.01"}
                    max={maxDiscount} value={form.discountValue || ""}
                    onChange={e => set({ discountValue: parseFloat(e.target.value) || 0 })}
                    placeholder={form.discountType === "reais" ? "0,00" : "0,0"}
                    className="flex-1 px-3 py-2 text-xs border border-border rounded-xl outline-none focus:border-primary bg-white" />
                </div>
              </div>
              {/* Delivery */}
              <div>
                <label className="text-[10px] text-muted-foreground font-bold block mb-1">Taxa de entrega (R$)</label>
                <input type="number" min="0" step="0.01" value={form.deliveryFee || ""}
                  onChange={e => set({ deliveryFee: parseFloat(e.target.value) || 0 })}
                  placeholder="0,00" className={inputCls} />
              </div>
              {/* Summary */}
              <div className="border-t border-border/40 pt-3 space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(subtotal)}</span></div>
                {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span className="tabular-nums">− {formatCurrency(discountAmount)}</span></div>}
                {form.deliveryFee > 0 && <div className="flex justify-between text-muted-foreground"><span>Entrega</span><span className="tabular-nums">+ {formatCurrency(form.deliveryFee)}</span></div>}
                <div className="flex justify-between text-primary font-black text-sm border-t border-border pt-1"><span>Total</span><span className="tabular-nums">{formatCurrency(total)}</span></div>
              </div>
            </div>
          </section>

          {/* DETALHES */}
          <section>
            <h3 className="text-primary font-black text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar size={12} /> Detalhes
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground font-bold block mb-1">Validade do orçamento</label>
                <input type="date" value={form.validity} onChange={e => set({ validity: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-bold block mb-1">Previsão de entrega/retirada</label>
                <input type="date" value={form.deliveryDate} onChange={e => set({ deliveryDate: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-[10px] text-muted-foreground font-bold block mb-1">Condições de pagamento</label>
              <input type="text" placeholder="Ex: 50% na aprovação, 50% na entrega"
                value={form.paymentTerms} onChange={e => set({ paymentTerms: e.target.value })} className={inputCls} />
            </div>
          </section>

          {/* OBSERVAÇÕES */}
          <section>
            <h3 className="text-primary font-black text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText size={12} /> Observações
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground font-bold block mb-1">Para o cliente (aparece no WhatsApp)</label>
                <textarea rows={2} placeholder="Instruções, informações de entrega..."
                  value={form.customerNotes} onChange={e => set({ customerNotes: e.target.value })}
                  className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-bold block mb-1">Internas (não aparecem no WhatsApp)</label>
                <textarea rows={2} placeholder="Notas internas da equipe..."
                  value={form.internalNotes} onChange={e => set({ internalNotes: e.target.value })}
                  className={`${inputCls} resize-none`} />
              </div>
            </div>
          </section>

          {/* STATUS — só para edição de orçamentos em aberto ou não fechado */}
          {editingQuote && editingQuote.status !== "fechado" && (
            <section>
              <h3 className="text-primary font-black text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <AlertCircle size={12} /> Situação
              </h3>
              {editingQuote.status === "em_aberto" && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.markNotClosed}
                    onChange={e => set({ markNotClosed: e.target.checked })}
                    className="mt-0.5 accent-primary" />
                  <div>
                    <p className="text-xs font-bold text-foreground">Marcar como não fechado</p>
                    <p className="text-[10px] text-muted-foreground">O cliente não aprovou ou desistiu. O orçamento pode ser reaberto.</p>
                  </div>
                </label>
              )}
              {(form.markNotClosed || editingQuote.status === "nao_fechado") && (
                <div className="mt-2">
                  <label className="text-[10px] text-muted-foreground font-bold block mb-1">Motivo (opcional)</label>
                  <input type="text" placeholder="Ex: Preço acima do esperado, cliente desistiu..."
                    value={form.closedReason} onChange={e => set({ closedReason: e.target.value })} className={inputCls} />
                </div>
              )}
              {editingQuote.status === "nao_fechado" && (
                <p className="text-xs text-muted-foreground mt-2">Para reabrir este orçamento, feche este formulário e use o botão "Reabrir" no cartão.</p>
              )}
            </section>
          )}

          {error && <p className="text-red-500 text-xs font-bold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border bg-muted/10 shrink-0">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave}
            className="flex-1 bg-primary text-white text-xs font-bold rounded-xl px-4 py-2 hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
            <Check size={14} /> Salvar orçamento
          </button>
        </div>
      </div>
    </div>
  );
}
