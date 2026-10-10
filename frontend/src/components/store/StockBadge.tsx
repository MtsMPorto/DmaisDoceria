import { LOW_STOCK_THRESHOLD } from "@/config/constants";

export function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Sem estoque
    </span>
  );
  if (stock <= LOW_STOCK_THRESHOLD) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Últimas unidades ({stock} restantes)
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Em estoque
    </span>
  );
}
