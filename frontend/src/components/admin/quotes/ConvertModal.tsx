import { useState } from "react";
import { ShoppingBag, X } from "lucide-react";
import { PAYMENT_METHOD_SHORT_LABELS } from "@/config/labels";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod, Quote } from "@/types";

export function ConvertModal({
  quote, onClose, onConfirm,
}: {
  quote: Quote;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div style={{ background: "#16a34a" }} className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/80 text-xs">Revisão</p>
            <h3 className="text-white font-black" style={{ fontFamily: "'Baloo 2', cursive" }}>Transformar em Pedido</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-muted/20 rounded-2xl p-4 text-xs space-y-2">
            <p className="font-bold text-primary">{quote.customerName}</p>
            {quote.items.map((item, i) => (
              <div key={i} className="flex justify-between text-muted-foreground">
                <span>{item.productName} — {item.qty}x</span>
                <span className="tabular-nums font-semibold text-foreground">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 space-y-1">
              {quote.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>− {formatCurrency(quote.discountAmount)}</span></div>}
              <div className="flex justify-between text-primary font-black"><span>Total</span><span className="tabular-nums">{formatCurrency(quote.total)}</span></div>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground font-bold block mb-2">Forma de pagamento</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 text-xs border border-border rounded-xl outline-none focus:border-primary bg-white">
              {Object.entries(PAYMENT_METHOD_SHORT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>

          <p className="text-[11px] text-muted-foreground bg-blue-50 border border-blue-200/60 rounded-xl px-3 py-2">
            O pedido será criado como <strong>Em andamento</strong> com pagamento <strong>Pendente</strong>. Gerencie os detalhes na aba Clientes &amp; Vendas.
          </p>

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button onClick={() => onConfirm(paymentMethod)}
              className="flex-1 bg-green-600 text-white text-xs font-bold rounded-xl px-4 py-2 hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5">
              <ShoppingBag size={13} /> Confirmar e criar pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
