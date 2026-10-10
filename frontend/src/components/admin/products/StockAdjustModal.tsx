import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { inputCls } from "@/components/admin/customers/inputCls";
import { errorMessage } from "@/services/api";
import { adminApi } from "@/services/endpoints";
import type { AdminProduct } from "@/types/api";

// Único caminho para mudar o saldo depois do cadastro. O motivo é obrigatório e o banco registra
// o movimento com o administrador logado.
export function StockAdjustModal({ product, onSaved, onClose }: { product: AdminProduct; onSaved: () => void; onClose: () => void }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const value = Number(delta);
  const valid = delta.trim() !== "" && Number.isInteger(value) && value !== 0;
  const result = valid ? product.stock + value : null;

  async function save() {
    setError("");
    if (!valid) { setError("Informe uma variação inteira diferente de zero (use - para saída)."); return; }
    if (reason.trim().length < 3) { setError("Informe o motivo do ajuste."); return; }
    if (result !== null && result < 0) { setError(`O saldo atual é ${product.stock}; não é possível chegar a ${result}.`); return; }

    setSaving(true);
    try {
      await adminApi.adjustStock(product.id, { delta: value, reason: reason.trim() });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-primary font-black text-lg">Ajustar estoque</h3>
            <p className="text-muted-foreground text-xs">{product.name} · saldo atual <strong>{product.stock}</strong></p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-primary"><X size={18} /></button>
        </div>

        <Field label="Variação (+ entrada, − saída)">
          <input type="number" step={1} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="Ex: 10 ou -3" className={inputCls} />
        </Field>
        {result !== null && (
          <p className={`text-sm font-bold ${result < 0 ? "text-red-600" : "text-primary"}`}>Saldo depois do ajuste: {result}</p>
        )}
        <Field label="Motivo *">
          <input type="text" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Reposição conferida, perda, contagem" className={inputCls} />
        </Field>

        {error && <p className="text-red-600 text-sm font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border-2 border-border text-muted-foreground font-bold py-2.5 rounded-xl text-sm">Cancelar</button>
          <button onClick={() => void save()} disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-black py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
