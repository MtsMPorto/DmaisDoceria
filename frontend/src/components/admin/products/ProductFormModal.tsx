import { useEffect, useState } from "react";
import { Archive, DollarSign, Image as ImageIcon, Layers, Loader2, Pencil, Plus, Save, X } from "lucide-react";
// import { Star } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { inputCls } from "@/components/admin/customers/inputCls";
import { parseMoneyInput } from "@/lib/money";
import { api, errorMessage } from "@/services/api";
import { adminApi, type ProductPayload } from "@/services/endpoints";
import type { AdminCategory, AdminFlavor, AdminProduct } from "@/types/api";

interface Props {
  mode: "add" | "edit";
  product?: AdminProduct;
  categories: AdminCategory[];
  onSaved: () => void;
  onClose: () => void;
}

// Cadastro: saldo inicial permitido. Edição: o saldo NÃO é editável aqui (só pela ação
// "Ajustar estoque", que exige motivo e fica registrada no histórico de movimentações).
export function ProductFormModal({ mode, product, categories, onSaved, onClose }: Props) {
  const activeCategories = categories.filter((category) => category.active || category.id === product?.categoryId);

  const [name, setName] = useState(product?.name ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  useEffect(() => {
    if (!imageFile) { setImagePreview(""); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  const [cost, setCost] = useState(product?.cost ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "");
  const [minQty, setMinQty] = useState(String(product?.minQty ?? 1));
  const [categoryId, setCategoryId] = useState<number | "">(product?.categoryId ?? activeCategories[0]?.id ?? "");
  const [bestSeller, setBestSeller] = useState(product?.bestSeller ?? false);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [stars, setStars] = useState(product?.stars ?? 5);
  const [active, setActive] = useState(product?.active ?? true);
  const [initialStock, setInitialStock] = useState("0");

  const [flavors, setFlavors] = useState<AdminFlavor[]>(product?.flavors ?? []);
  const [pendingFlavors, setPendingFlavors] = useState<string[]>([]);
  const [flavorInput, setFlavorInput] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  function close() {
    if (saving) return;
    if (changed) onSaved();
    onClose();
  }

  function validate(): ProductPayload | null {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Informe o nome.";
    if (!brand.trim()) next.brand = "Informe a marca.";
    if (!unit.trim()) next.unit = "Informe a unidade.";
    const costText = String(cost).trim();
    const costValue = costText === "" ? null : parseMoneyInput(costText);
    if (costText !== "" && costValue === null) next.cost = "Custo inválido.";
    const min = Number(minQty);
    if (!Number.isInteger(min) || min < 1) next.minQty = "Mínimo deve ser 1 ou mais.";
    if (categoryId === "") next.categoryId = "Escolha a categoria.";
    if (mode === "add") {
      const stock = Number(initialStock);
      if (!Number.isInteger(stock) || stock < 0) next.initialStock = "Saldo inicial inválido.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || categoryId === "") return null;

    return {
      name: name.trim(),
      brand: brand.trim(),
      description: description.trim() || null,
      imageUrl: imageUrl.trim() || null,
      categoryId,
      price: product?.price ?? "0.00",
      cost: costValue,
      unit: unit.trim(),
      minQty: min,
      bestSeller,
      featured,
      stars,
      active,
    };
  }

  async function handleSave() {
    if (saving) return;
    setFormError("");
    const payload = validate();
    if (!payload) return;

    setSaving(true);
    try {
      if (imageFile) {
        const uploaded = await api<{ imageUrl: string }>("/api/admin/products/image", { method: "POST", rawBody: imageFile, auth: true });
        payload.imageUrl = uploaded.imageUrl;
        setImageUrl(uploaded.imageUrl);
        setImageFile(null);
      }
      if (mode === "add") {
        await adminApi.createProduct({
          ...payload,
          initialStock: Number(initialStock),
          flavors: pendingFlavors,
        });
      } else if (product) {
        await adminApi.updateProduct(product.id, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function addFlavor() {
    const trimmed = flavorInput.trim();
    if (!trimmed) return;
    setFormError("");

    if (mode === "add") {
      if (pendingFlavors.some((flavor) => flavor.toLowerCase() === trimmed.toLowerCase())) {
        setFormError("Esse sabor já está na lista.");
        return;
      }
      setPendingFlavors((list) => [...list, trimmed]);
      setFlavorInput("");
      return;
    }

    if (!product) return;
    try {
      const created = await adminApi.createFlavor(product.id, trimmed);
      setFlavors((list) => [...list, created]);
      setFlavorInput("");
      setChanged(true);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  async function patchFlavor(flavor: AdminFlavor, body: Partial<{ name: string; active: boolean }>) {
    if (!product) return;
    setFormError("");
    try {
      const updated = await adminApi.updateFlavor(product.id, flavor.id, body);
      setFlavors((list) => list.map((item) => (item.id === flavor.id ? updated : item)));
      setChanged(true);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col">
        <div className="bg-primary px-5 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-white font-black text-base flex items-center gap-2" style={{ fontFamily: "'Baloo 2', cursive" }}>
            {mode === "edit" ? <><Pencil size={16} /> Editar Produto</> : <><Plus size={16} /> Novo Produto</>}
          </h2>
          <button onClick={close} className="text-white/60 hover:text-white"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {(imagePreview || imageUrl) && (
            <img key={imagePreview || imageUrl} src={imagePreview || imageUrl} alt="Pré-visualização" className="w-full h-40 object-cover rounded-2xl bg-secondary"
              onError={(event) => { event.currentTarget.style.display = "none"; }} />
          )}

          <Field label="Imagem do produto" error={errors.imageUrl}>
            <label className={`${inputCls} flex items-center justify-center gap-2 cursor-pointer`}>
              <ImageIcon size={16} /> {imageFile ? "Trocar imagem selecionada" : "Escolher imagem"}
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) {
                    setErrors(current => ({ ...current, imageUrl: "Escolha uma imagem JPG, PNG ou WebP de até 5 MB." }));
                    return;
                  }
                  setErrors(current => ({ ...current, imageUrl: "" }));
                  setImageFile(file);
                }} />
            </label>
            <p className="text-xs text-muted-foreground mt-2 break-all">{imageFile?.name || "JPG, PNG ou WebP · até 5 MB"}</p>
            {(imageFile || imageUrl) && <button type="button" disabled={saving} className="text-xs text-red-600 mt-2" onClick={() => { setImageFile(null); setImageUrl(""); }}>Remover imagem</button>}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome do Produto *" error={errors.name}>
              <input type="text" placeholder="Ex: Bala de Goma Sortida" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Marca *" error={errors.brand}>
              <input type="text" placeholder="Ex: Fini" value={brand} onChange={(e) => setBrand(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Descrição" error={errors.description}>
            <textarea rows={3} maxLength={1000} placeholder="Texto que aparece na página do produto" value={description}
              onChange={(e) => setDescription(e.target.value)} className={`${inputCls} resize-none`} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Custo (R$)" error={errors.cost}>
              <div className="relative">
                <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" inputMode="decimal" placeholder="0,00" value={cost} onChange={(e) => setCost(e.target.value)} className={`${inputCls} pl-9`} />
              </div>
            </Field>
            <Field label="Unidade *" error={errors.unit}>
              <input type="text" placeholder="pct 500g" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Qtd. Mínima" error={errors.minQty}>
              <input type="number" min={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Categoria *" error={errors.categoryId}>
              <div className="relative">
                <Layers size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className={`${inputCls} pl-9`}>
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}{category.active ? "" : " (inativa)"}</option>
                  ))}
                </select>
              </div>
            </Field>
            {/* Avaliações desativadas; o valor existente é preservado no cadastro. */}
            {/* <Field label="Estrelas">
              <div className="relative">
                <Star size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select value={stars} onChange={(e) => setStars(Number(e.target.value))} className={`${inputCls} pl-9`}>
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
            </Field> */}
          </div>

          {mode === "add" ? (
            <Field label="Saldo inicial (unidades)" error={errors.initialStock}>
              <div className="relative">
                <Archive size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="number" min={0} value={initialStock} onChange={(e) => setInitialStock(e.target.value)} className={`${inputCls} pl-9`} />
              </div>
              <p className="text-muted-foreground text-[11px] mt-1">Depois do cadastro, o saldo só muda pela ação "Ajustar estoque" (com motivo).</p>
            </Field>
          ) : (
            <div className="bg-muted/40 rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm">
              <Archive size={14} className="text-primary" />
              <span className="text-primary font-bold">Estoque atual: {product?.stock ?? 0} un.</span>
              <span className="text-muted-foreground text-xs">— altere em "Ajustar estoque" na lista</span>
            </div>
          )}

          {/* Sabores */}
          <div>
            <label className="block text-primary font-bold text-xs mb-2">Sabores (opcional)</label>
            <div className="flex gap-2 mb-2">
              <input type="text" placeholder="Ex: Ao Leite" value={flavorInput} onChange={(e) => setFlavorInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addFlavor(); } }}
                className={`${inputCls} flex-1`} />
              <button onClick={() => void addFlavor()} className="bg-primary hover:bg-primary/90 text-white px-3 rounded-xl font-bold text-sm">+ Add</button>
            </div>

            {mode === "add" ? (
              <div className="flex flex-wrap gap-1.5">
                {pendingFlavors.map((flavor) => (
                  <span key={flavor} className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    {flavor}
                    <button onClick={() => setPendingFlavors((list) => list.filter((item) => item !== flavor))} className="text-primary/50 hover:text-red-500"><X size={11} /></button>
                  </span>
                ))}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {flavors.map((flavor) => (
                  <FlavorRow key={flavor.id} flavor={flavor} onRename={(value) => patchFlavor(flavor, { name: value })}
                    onToggle={() => patchFlavor(flavor, { active: !flavor.active })} />
                ))}
                {flavors.length === 0 && <li className="text-muted-foreground text-xs">Sem sabores: produto vendido sem variação.</li>}
              </ul>
            )}
          </div>

            <label className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3 text-sm font-bold text-primary">
              <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} className="h-4 w-4 accent-primary" />
              Exibir nos Destaques da Semana
            </label>

          <label className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3 text-sm font-bold text-primary">
            <input type="checkbox" checked={bestSeller} onChange={(event) => setBestSeller(event.target.checked)} className="h-4 w-4 accent-primary" />
            Exibir nos Mais Vendidos
          </label>

          <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3">
            <div>
              <p className="text-primary font-bold text-sm">Produto Ativo</p>
              <p className="text-muted-foreground text-xs">Visível na loja para os clientes</p>
            </div>

            <button onClick={() => setActive((value) => !value)} aria-pressed={active}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${active ? "bg-green-500" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${active ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {formError && <p className="text-red-600 text-sm font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{formError}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3 flex-shrink-0">
          <button onClick={close} className="flex-1 border-2 border-border text-muted-foreground font-bold py-2.5 rounded-xl text-sm hover:border-primary hover:text-primary transition-all">Cancelar</button>
          <button onClick={() => void handleSave()} disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-black py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {mode === "edit" ? "Salvar Alterações" : "Adicionar Produto"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FlavorRow({ flavor, onRename, onToggle }: { flavor: AdminFlavor; onRename: (name: string) => void; onToggle: () => void }) {
  const [value, setValue] = useState(flavor.name);
  return (
    <li className="flex items-center gap-2">
      <input type="text" value={value} onChange={(e) => setValue(e.target.value)}
        onBlur={() => { const trimmed = value.trim(); if (trimmed && trimmed !== flavor.name) onRename(trimmed); else setValue(flavor.name); }}
        className={`${inputCls} flex-1 ${flavor.active ? "" : "opacity-50"}`} />
      <button onClick={onToggle}
        className={`text-[11px] font-black px-2.5 py-1.5 rounded-lg ${flavor.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
        {flavor.active ? "Ativo" : "Inativo"}
      </button>
    </li>
  );
}
