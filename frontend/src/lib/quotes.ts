import { getSPToday } from "@/lib/dates";
import type { DiscountType, Quote, QuoteItem } from "@/types";

export function genQuoteCode(existing: Quote[]): string {
  const max = existing.reduce((m, q) => {
    const n = parseInt(q.code.replace("ORC-", ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `ORC-${String(max + 1).padStart(3, "0")}`;
}

export function isExpired(validity: string): boolean {
  if (!validity) return false;
  return validity < getSPToday();
}

export function calcTotals(items: QuoteItem[], discountType: DiscountType, discountValue: number, deliveryFee: number) {
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const discountAmount = discountType === "percentual"
    ? Math.min(subtotal, subtotal * (discountValue / 100))
    : Math.min(subtotal, discountValue);
  const total = subtotal - discountAmount + deliveryFee;
  return { subtotal, discountAmount, total };
}
