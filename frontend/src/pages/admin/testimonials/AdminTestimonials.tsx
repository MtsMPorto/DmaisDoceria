import { useState } from "react";
import { MessageSquare, Pencil, Plus } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { AsyncBoundary } from "@/components/ui/AsyncState";
import { FormError, Modal } from "@/components/ui/Modal";
import { inputCls } from "@/components/admin/customers/inputCls";
import { Stars } from "@/components/ui/Stars";
import { useAsync } from "@/hooks/useAsync";
import { errorMessage } from "@/services/api";
import { adminApi } from "@/services/endpoints";
import type { AdminTestimonial } from "@/types/api";

// Depoimentos editoriais: só os PUBLICADOS aparecem na loja. Nada é apagado; "despublicar" esconde.
export default function AdminTestimonials() {
  const list = useAsync(() => adminApi.testimonials(), []);
  const [editing, setEditing] = useState<AdminTestimonial | "new" | null>(null);
  const [actionError, setActionError] = useState("");

  async function togglePublished(item: AdminTestimonial) {
    setActionError("");
    try {
      await adminApi.updateTestimonial(item.id, { published: !item.published });
      list.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">Só depoimentos <strong>publicados</strong> aparecem na loja, na ordem abaixo.</p>
        <button onClick={() => setEditing("new")}
          className="flex items-center gap-2 bg-accent hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md shadow-accent/30 flex-shrink-0">
          <Plus size={16} /> Novo depoimento
        </button>
      </div>

      <FormError message={actionError} />

      <AsyncBoundary loading={list.loading} error={list.error} onRetry={list.reload} hasData={list.data !== null}>
        {(list.data?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-border">
            <MessageSquare size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">Nenhum depoimento cadastrado</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.data?.map((item) => (
              <li key={item.id} className={`bg-white rounded-2xl border border-border shadow-sm p-4 flex flex-wrap gap-3 justify-between ${item.published ? "" : "opacity-70"}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-primary font-black">{item.name}{item.city ? <span className="text-muted-foreground font-normal text-sm"> · {item.city}</span> : null}</p>
                  <Stars count={item.stars} size={12} />
                  <p className="text-sm text-foreground mt-1">"{item.text}"</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Ordem {item.sortOrder}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => void togglePublished(item)}
                    className={`text-[11px] font-black px-3 py-1.5 rounded-lg ${item.published ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                    {item.published ? "Publicado" : "Não publicado"}
                  </button>
                  <button onClick={() => setEditing(item)} className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary" aria-label="Editar">
                    <Pencil size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncBoundary>

      {editing && (
        <TestimonialForm item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />
      )}
    </div>
  );
}

function TestimonialForm({ item, onClose, onSaved }: { item: AdminTestimonial | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [city, setCity] = useState(item?.city ?? "");
  const [stars, setStars] = useState(item?.stars ?? 5);
  const [text, setText] = useState(item?.text ?? "");
  const [avatar, setAvatar] = useState(item?.avatar ?? "");
  const [published, setPublished] = useState(item?.published ?? false);
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setError("");
    const order = Number(sortOrder);
    if (!name.trim() || !text.trim()) { setError("Informe o nome e o depoimento."); return; }
    if (!Number.isInteger(order) || order < 0) { setError("Ordem inválida."); return; }

    const body = {
      name: name.trim(),
      city: city.trim() || null,
      stars,
      text: text.trim(),
      avatar: avatar.trim() || null,
      published,
      sortOrder: order,
    };
    setSaving(true);
    try {
      if (item) await adminApi.updateTestimonial(item.id, body);
      else await adminApi.createTestimonial(body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={item ? "Editar depoimento" : "Novo depoimento"} onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 border-2 border-border text-muted-foreground font-bold py-2.5 rounded-xl text-sm">Cancelar</button>
          <button onClick={() => void save()} disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-black py-2.5 rounded-xl text-sm">Salvar</button>
        </>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome *"><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Cidade"><input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Porto Alegre, RS" className={inputCls} /></Field>
      </div>
      <Field label="Depoimento *">
        <textarea rows={4} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} className={`${inputCls} resize-none`} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Estrelas">
          <select value={stars} onChange={(e) => setStars(Number(e.target.value))} className={inputCls}>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </Field>
        <Field label="Iniciais (avatar)">
          <input type="text" maxLength={3} value={avatar} onChange={(e) => setAvatar(e.target.value.toUpperCase())} className={inputCls} />
        </Field>
        <Field label="Ordem">
          <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm font-bold text-primary">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publicar na loja
      </label>
      <FormError message={error} />
    </Modal>
  );
}
