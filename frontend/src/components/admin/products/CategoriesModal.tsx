import { useState } from "react";
import { Plus, X } from "lucide-react";
import { inputCls } from "@/components/admin/customers/inputCls";
import { AsyncBoundary } from "@/components/ui/AsyncState";
import { useAsync } from "@/hooks/useAsync";
import { api, errorMessage } from "@/services/api";
import { adminApi } from "@/services/endpoints";
import type { AdminCategory } from "@/types/api";

// Gestão de categorias: criar, renomear, ordenar e ativar/desativar (nunca apaga).
export function CategoriesModal({ onChanged, onClose }: { onChanged: () => void; onClose: () => void }) {
  const { data, loading, error, reload } = useAsync(() => adminApi.categories(), []);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      reload();
      onChanged();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl max-h-[85dvh] flex flex-col overflow-hidden">
        <div className="bg-primary px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-black text-base">Categorias</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={20} /></button>
        </div>

        <fieldset disabled={busy} className="p-5 space-y-3 overflow-y-auto min-w-0">
          <div className="flex gap-2">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova categoria" className={`${inputCls} flex-1`} />
            <button
              onClick={() => { const name = newName.trim(); if (name) void run(async () => { await adminApi.createCategory({ name, sortOrder: (data?.length ?? 0) }); setNewName(""); }); }}
              className="bg-accent hover:bg-orange-500 text-white px-3 rounded-xl font-bold text-sm flex items-center gap-1"><Plus size={14} /> Criar</button>
          </div>

          {message && <p className="text-red-600 text-sm font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{message}</p>}

          <AsyncBoundary loading={loading} error={error} onRetry={reload} hasData={data !== null}>
            <ul className="space-y-2">
              {(data ?? []).map((category) => (
                <CategoryRow key={category.id} category={category}
                  onRemove={() => { void run(() => api(`/api/admin/categories/${category.id}`, { method: "DELETE", auth: true })); }}
                  onPatch={(body) => run(() => adminApi.updateCategory(category.id, body))} />
              ))}
            </ul>
          </AsyncBoundary>
        </fieldset>
      </div>
    </div>
  );
}

function CategoryRow({ category, onPatch, onRemove }: { onRemove: () => void; category: AdminCategory; onPatch: (body: Partial<{ name: string; sortOrder: number; active: boolean }>) => void }) {
  const [name, setName] = useState(category.name);
  const [order, setOrder] = useState(String(category.sortOrder));

  return (
    <li className="flex items-center gap-2">
      <input type="text" value={name} onChange={(e) => setName(e.target.value)}
        onBlur={() => { const trimmed = name.trim(); if (trimmed && trimmed !== category.name) onPatch({ name: trimmed }); else setName(category.name); }}
        className={`${inputCls} flex-1 ${category.active ? "" : "opacity-50"}`} />
      <input type="number" min={0} value={order} onChange={(e) => setOrder(e.target.value)} title="Ordem"
        onBlur={() => { const value = Number(order); if (Number.isInteger(value) && value >= 0 && value !== category.sortOrder) onPatch({ sortOrder: value }); else setOrder(String(category.sortOrder)); }}
        className={`${inputCls} w-16`} />
      <button onClick={() => onPatch({ active: !category.active })}
        className={`text-[11px] font-black px-2.5 py-2 rounded-lg ${category.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
        {category.active ? "Ativa" : "Inativa"}
      </button>
      <button type="button" onClick={onRemove} className="text-xs font-bold text-red-600 px-2 py-2">Remover</button>
    </li>
  );
}
