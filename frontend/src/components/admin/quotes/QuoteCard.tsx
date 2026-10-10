import { Clock, ShoppingBag } from "lucide-react";
import { QUOTE_STATUS_CONFIG } from "@/config/labels";
import { formatCurrency, formatDate } from "@/lib/format";
import { isExpired } from "@/lib/quotes";
import type { Quote } from "@/types";

export function QuoteCard({ quote, onClick }: { quote: Quote; onClick: () => void }) {
  const cfg = QUOTE_STATUS_CONFIG[quote.status];
  const expired = isExpired(quote.validity) && quote.status === "em_aberto";
  const productSummary = quote.items.length === 0 ? "Nenhum item"
    : quote.items.length === 1 ? `${quote.items[0].productName} (${quote.items[0].qty}x)`
    : `${quote.items.length} produtos`;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-border cursor-pointer hover:shadow-md transition-all overflow-hidden group"
      style={{ borderTop: `4px solid ${cfg.color}` }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10px] font-black tracking-wider uppercase">{quote.code}</p>
            <p className="text-primary font-black text-sm leading-tight truncate" style={{ fontFamily: "'Baloo 2', cursive" }}>
              {quote.customerName}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
            {expired && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                <Clock size={9} /> Vencida
              </span>
            )}
          </div>
        </div>

        {/* Dashed divider */}
        <div className="border-t border-dashed border-border my-2" />

        {/* Info rows */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Produtos</span>
            <span className="text-foreground font-semibold truncate max-w-[140px] text-right">{productSummary}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="text-primary font-black tabular-nums">{formatCurrency(quote.total)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Criado em</span>
            <span className="text-foreground">{formatDate(quote.createdAt.slice(0, 10))}</span>
          </div>
          {quote.validity && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Validade</span>
              <span className={expired ? "text-amber-600 font-bold" : "text-foreground"}>{formatDate(quote.validity)}</span>
            </div>
          )}
        </div>

        {quote.convertedSaleId && (
          <div className="mt-3 flex items-center gap-1 text-green-600 text-[10px] font-bold">
            <ShoppingBag size={10} /> Convertido em pedido
          </div>
        )}
      </div>
    </div>
  );
}
