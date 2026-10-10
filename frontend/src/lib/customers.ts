import type { Customer, CustomerStats, Sale } from "@/types";

export function genCustomerCode(existing: Customer[]): string {
  const max = existing.reduce((m, c) => {
    const n = parseInt(c.code.replace("CLI-", ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `CLI-${String(max + 1).padStart(3, "0")}`;
}

export function getDisplayName(c: Customer): string {
  return c.personType === "juridica" ? (c.nomeFantasia || c.name) : c.name;
}

export function computeStats(sales: Sale[]): CustomerStats {
  const concluded = sales.filter(s => s.saleStatus === "concluida");
  const active = sales.filter(s => s.saleStatus !== "cancelada");
  const totalComprado = concluded.reduce((s, v) => s + v.total, 0);
  const valorPendente = active.filter(s => s.paymentStatus !== "pago").reduce((s, v) => s + v.total, 0);
  const pqty: Record<string, { name: string; qty: number }> = {};
  concluded.forEach(s => s.items.forEach(i => {
    const k = String(i.productId);
    pqty[k] = { name: i.productName, qty: (pqty[k]?.qty ?? 0) + i.qty };
  }));
  let topProduct = "";
  let topQty = 0;
  Object.values(pqty).forEach(({ name, qty }) => { if (qty > topQty) { topQty = qty; topProduct = name; } });
  const dates = sales.map(s => s.date).filter(Boolean).sort();
  return {
    totalComprado, valorPendente, topProduct,
    lastDate: dates[dates.length - 1] ?? "",
    totalSales: sales.length,
    concludedCount: concluded.length,
  };
}
