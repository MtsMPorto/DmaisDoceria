import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { FormError, Modal } from "@/components/ui/Modal";
import { isValidCnpj, isValidUf, onlyDigits } from "@/lib/document";
import { formatCEP, formatDocument, formatPhone } from "@/lib/format";
import { errorMessage } from "@/services/api";
import { adminApi, type CustomerPayload } from "@/services/endpoints";
import type { CustomerRecord, PersonKind } from "@/types/api";
import { inputCls } from "./inputCls";

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

export function CustomerFormModal({ customer, onSaved, onClose }: {
  customer: CustomerRecord | null; onSaved: (saved: CustomerRecord) => void; onClose: () => void;
}) {
  const [type, setType] = useState<PersonKind>(customer?.type ?? "PF");
  const [name, setName] = useState(customer?.name ?? "");
  const [tradeName, setTradeName] = useState(customer?.tradeName ?? "");
  const [responsibleName, setResponsibleName] = useState(customer?.responsibleName ?? "");
  const [document, setDocument] = useState(customer?.document ? formatDocument(customer.document, customer.type === "PF" ? "fisica" : "juridica") : "");
  const [phone, setPhone] = useState(customer ? formatPhone(customer.phone) : "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [zip, setZip] = useState(customer?.zip ? formatCEP(customer.zip) : "");
  const [street, setStreet] = useState(customer?.street ?? "");
  const [streetNumber, setStreetNumber] = useState(customer?.streetNumber ?? "");
  const [complement, setComplement] = useState(customer?.complement ?? "");
  const [neighborhood, setNeighborhood] = useState(customer?.neighborhood ?? "");
  const [city, setCity] = useState(customer?.city ?? "");
  const [state, setState] = useState(customer?.state ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [active, setActive] = useState(customer?.active ?? true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function validate(): CustomerPayload | null {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Informe o nome.";

    const documentDigits = type === "PJ" ? document.replace(/[./-]/g, "").toUpperCase() : "";
    if (documentDigits) {
      if (type === "PJ" && !isValidCnpj(documentDigits)) next.document = "CNPJ inválido.";
    }

    const phoneDigits = onlyDigits(phone);
    if (phoneDigits.length < 10 || phoneDigits.length > 15) next.phone = "Telefone com DDD (10 a 15 dígitos).";

    const zipDigits = onlyDigits(zip);
    if (zipDigits && zipDigits.length !== 8) next.zip = "CEP deve ter 8 dígitos.";
    if (state.trim() && !isValidUf(state)) next.state = "UF inválida.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "E-mail inválido.";

    setErrors(next);
    if (Object.keys(next).length > 0) return null;

    return {
      type,
      name: name.trim(),
      tradeName: type === "PJ" ? orNull(tradeName) : null,
      responsibleName: type === "PJ" ? orNull(responsibleName) : null,
      document: documentDigits || null,
      phone: phoneDigits,
      email: orNull(email),
      notes: orNull(notes),
      zip: zipDigits || null,
      street: orNull(street),
      streetNumber: orNull(streetNumber),
      complement: orNull(complement),
      neighborhood: orNull(neighborhood),
      city: orNull(city),
      state: state.trim() ? state.trim().toUpperCase() : null,
    };
  }

  async function save() {
    setFormError("");
    const payload = validate();
    if (!payload) return;

    setSaving(true);
    try {
      const saved = customer
        ? await adminApi.updateCustomer(customer.id, { ...payload, active })
        : await adminApi.createCustomer(payload);
      onSaved(saved);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={customer ? `Editar ${customer.code}` : "Novo cliente"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 border-2 border-border text-muted-foreground font-bold py-2.5 rounded-xl text-sm">Cancelar</button>
          <button onClick={() => void save()} disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-black py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {(["PF", "PJ"] as PersonKind[]).map((kind) => (
          <button key={kind} onClick={() => { setType(kind); setDocument(""); }}
            className={`py-2.5 rounded-xl text-sm font-bold border-2 ${type === kind ? "border-primary bg-primary text-white" : "border-border bg-secondary text-primary"}`}>
            {kind === "PF" ? "👤 Pessoa Física" : "🏢 Pessoa Jurídica"}
          </button>
        ))}
      </div>

      <Field label={type === "PF" ? "Nome completo *" : "Razão social *"} error={errors.name}>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </Field>

      {type === "PJ" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome fantasia">
            <input type="text" value={tradeName} onChange={(e) => setTradeName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Responsável">
            <input type="text" value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} className={inputCls} />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {type === "PJ" && <Field label="CNPJ (opcional)" error={errors.document}>
          <input type="text" maxLength={18} placeholder="00.000.000/0000-00" value={document}
            onChange={(e) => setDocument(formatDocument(e.target.value, "juridica"))} className={inputCls} />
        </Field>}
        <Field label="Telefone / WhatsApp *" error={errors.phone}>
          <input type="tel" placeholder="(51) 99999-9999" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className={inputCls} />
        </Field>
      </div>

      <Field label="E-mail" error={errors.email}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </Field>

      <div className="border-t border-border pt-3 space-y-3">
        <p className="text-primary font-bold text-sm">📍 Endereço</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="CEP" error={errors.zip}>
            <input type="text" placeholder="00000-000" value={zip} onChange={(e) => setZip(formatCEP(e.target.value))} className={inputCls} />
          </Field>
          <div className="col-span-2">
            <Field label="Logradouro">
              <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Número"><input type="text" value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} className={inputCls} /></Field>
          <div className="col-span-2">
            <Field label="Complemento"><input type="text" value={complement} onChange={(e) => setComplement(e.target.value)} className={inputCls} /></Field>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Bairro"><input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={inputCls} /></Field>
          <Field label="Cidade"><input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} /></Field>
          <Field label="UF" error={errors.state}>
            <input type="text" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className={inputCls} />
          </Field>
        </div>
      </div>

      <Field label="Observações">
        <textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
      </Field>

      {customer && (
        <label className="flex items-center gap-2 text-sm font-bold text-primary">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Cliente ativo <span className="text-muted-foreground font-normal text-xs">(clientes não são apagados; inative para esconder)</span>
        </label>
      )}

      <FormError message={formError} />
    </Modal>
  );
}
