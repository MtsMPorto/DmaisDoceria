import { useMemo, useState } from "react";
import {
  AlertTriangle, Archive, Trash2, ChevronDown, ChevronUp, Layers, Package, Pencil, Plus, Search, SlidersHorizontal, TrendingUp,
} from "lucide-react";
import { AsyncBoundary } from "@/components/ui/AsyncState";
import { CategoriesModal } from "@/components/admin/products/CategoriesModal";
import { ProductFormModal } from "@/components/admin/products/ProductFormModal";
import { StockAdjustModal } from "@/components/admin/products/StockAdjustModal";
import { StockBadge } from "@/components/admin/products/StockBadge";
import { useAsync } from "@/hooks/useAsync";
import { brl } from "@/lib/money";
import { api, errorMessage } from "@/services/api";
import { adminApi } from "@/services/endpoints";
import type { AdminProduct } from "@/types/api";

type SortField = "name" | "cost" | "stock";

export default function AdminProducts() {
  const products = useAsync(() => adminApi.products(), []);
  const categories = useAsync(() => adminApi.categories(), []);
  const settings = useAsync(() => adminApi.settings(), []);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [adding, setAdding] = useState(false);
  const [adjusting, setAdjusting] = useState<AdminProduct | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [actionError, setActionError] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);

  const threshold = settings.data?.lowStockThreshold ?? 10;
  const list = products.data ?? [];

  const stats = useMemo(() => {
    const active = list.filter((product) => product.active);
    // Soma somente os custos informados, em centavos inteiros.
    const cents = active.reduce((sum, product) => sum + product.stock * Math.round(Number(product.cost ?? 0) * 100), 0);
    return {
      total: list.length,
      active: active.length,
      low: active.filter((product) => product.stock > 0 && product.stock <= threshold).length,
      out: active.filter((product) => product.stock === 0).length,
      costValue: (cents / 100).toFixed(2),
      missingCosts: active.filter((product) => product.stock > 0 && product.cost == null).length,
    };
  }, [list, threshold]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = list.filter((product) => {
      if (categoryFilter !== "all" && product.categoryId !== categoryFilter) return false;
      if (statusFilter === "active" && !product.active) return false;
      if (statusFilter === "inactive" && product.active) return false;
      return !term || product.name.toLowerCase().includes(term) || product.brand.toLowerCase().includes(term);
    });
    const direction = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sortField === "cost") {
        if (a.cost == null) return b.cost == null ? 0 : 1;
        if (b.cost == null) return -1;
        return (Number(a.cost) - Number(b.cost)) * direction;
      }
      if (sortField === "stock") return (a.stock - b.stock) * direction;
      return a.name.localeCompare(b.name, "pt-BR") * direction;
    });
  }, [list, search, categoryFilter, statusFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  const sortIcon = (field: SortField) =>
    sortField === field ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  async function toggleActive(product: AdminProduct) {
    setActionError("");
    try {
      await adminApi.updateProduct(product.id, { active: !product.active });
      products.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function removeProduct(product: AdminProduct) {
    if (removing !== null) return;
    setRemoving(product.id);
    setActionError("");
    try { await api(`/api/admin/products/${product.id}`, {method: "DELETE", auth: true}); products.reload(); }
    catch (err) { setActionError(errorMessage(err)); }
    finally { setRemoving(null); }
  }

  const reloadAll = () => { products.reload(); categories.reload(); };

  return (
    <div className="space-y-6">
      <AsyncBoundary loading={products.loading} error={products.error} onRetry={products.reload} hasData={products.data !== null}>
        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total de Produtos", value: String(stats.total), icon: <Package size={18} />, color: "bg-blue-500", sub: `${stats.active} ativos` },
            { label: "Custo do estoque", value: brl(stats.costValue), icon: <TrendingUp size={18} />, color: "bg-green-500", sub: stats.missingCosts > 0 ? `Total parcial: ${stats.missingCosts} produto(s) sem custo` : "estoque × custo" },
            { label: "Estoque Baixo", value: String(stats.low), icon: <AlertTriangle size={18} />, color: "bg-amber-500", sub: `≤ ${threshold} unidades` },
            { label: "Sem Estoque", value: String(stats.out), icon: <Archive size={18} />, color: "bg-red-500", sub: "produtos zerados" },
          ].map(({ label, value, icon, color, sub }) => (
            <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-border flex items-start gap-3">
              <div className={`${color} text-white w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0`}>{icon}</div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-semibold">{label}</p>
                <p className="text-primary font-black text-xl leading-tight truncate">{value}</p>
                <p className="text-muted-foreground text-[10px]">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* TOOLBAR */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex gap-2 flex-1 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar nome ou marca..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-border focus:border-primary outline-none text-sm bg-background" />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-border text-sm bg-background text-primary font-semibold">
              <option value="all">Todas as categorias</option>
              {(categories.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 rounded-xl border border-border text-sm bg-background text-primary font-semibold">
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCategories(true)}
              className="flex items-center gap-2 border border-border text-primary px-3 py-2 rounded-xl font-bold text-sm hover:border-primary">
              <Layers size={15} /> Categorias
            </button>
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-2 bg-accent hover:bg-orange-500 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md shadow-accent/30">
              <Plus size={16} /> Novo Produto
            </button>
          </div>
        </div>

        {actionError && <p className="text-red-600 text-sm font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{actionError}</p>}

        {/* TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="px-4 py-3 text-muted-foreground font-bold text-xs uppercase tracking-wide cursor-pointer" onClick={() => toggleSort("name")}>
                  <span className="flex items-center gap-1">Produto {sortIcon("name")}</span>
                </th>
                <th className="px-4 py-3 text-muted-foreground font-bold text-xs uppercase tracking-wide hidden md:table-cell">Categoria</th>
                <th className="px-4 py-3 text-muted-foreground font-bold text-xs uppercase tracking-wide cursor-pointer" onClick={() => toggleSort("cost")}>
                  <span className="flex items-center gap-1">Custo {sortIcon("cost")}</span>
                </th>
                <th className="px-4 py-3 text-muted-foreground font-bold text-xs uppercase tracking-wide cursor-pointer" onClick={() => toggleSort("stock")}>
                  <span className="flex items-center gap-1">Estoque {sortIcon("stock")}</span>
                </th>
                <th className="px-4 py-3 text-muted-foreground font-bold text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${product.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-3">
                    <p className="text-primary font-bold">{product.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {product.brand} · {product.unit}
                      {product.flavors.length > 0 && <span className="text-accent font-bold"> · {product.flavors.filter((f) => f.active).length} sabores</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">{product.category}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-primary font-black tabular-nums">{product.cost == null ? "Não informado" : brl(product.cost)}</p>
                    <p className="text-muted-foreground text-[10px]">mín. {product.minQty} un.</p>
                  </td>
                  <td className="px-4 py-3"><StockBadge stock={product.stock} threshold={threshold} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => void toggleActive(product)} aria-pressed={product.active}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${product.active ? "bg-green-500" : "bg-gray-300"}`}
                      title={product.active ? "Inativar" : "Reativar"}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${product.active ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => setAdjusting(product)} title="Ajustar estoque"
                        className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 flex items-center justify-center text-amber-700">
                        <SlidersHorizontal size={14} />
                      </button>
                      <button onClick={() => setEditing(product)} title="Editar"
                        className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => void removeProduct(product)} disabled={removing !== null} title="Excluir produto" aria-label="Excluir produto" className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-600 disabled:opacity-50"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10 text-sm">Nenhum produto encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </AsyncBoundary>

      {adding && (
        <ProductFormModal mode="add" categories={categories.data ?? []} onSaved={reloadAll} onClose={() => setAdding(false)} />
      )}
      {editing && (
        <ProductFormModal mode="edit" product={editing} categories={categories.data ?? []} onSaved={reloadAll} onClose={() => setEditing(null)} />
      )}
      {adjusting && <StockAdjustModal product={adjusting} onSaved={products.reload} onClose={() => setAdjusting(null)} />}
      {showCategories && <CategoriesModal onChanged={reloadAll} onClose={() => setShowCategories(false)} />}
    </div>
  );
}
