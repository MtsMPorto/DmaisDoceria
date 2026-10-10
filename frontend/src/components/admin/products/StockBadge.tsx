// `threshold` vem de GET /api/admin/settings (low_stock_threshold).
export function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock === 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-600">Sem estoque</span>;
  if (stock <= threshold) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">{stock} un. · baixo</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-green-100 text-green-700">{stock} un.</span>;
}
