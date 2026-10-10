import { useMemo, useRef, useState } from "react";
import { X, Eye, Copy, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useProducts } from "@/contexts/ProductsContext";
import type { CheckoutForm } from "@/hooks/useCheckoutForm";
import { aboveStock, belowMinimum, toOrderItems } from "@/lib/cart";
import { onlyDigits } from "@/lib/document";
import { formatCEP, formatDocument, formatPhone } from "@/lib/format";
import { buildOrderMessage, buildReceiptMessage } from "@/lib/whatsapp";
import { ApiError } from "@/services/api";
import { storeApi } from "@/services/endpoints";
import type { PersonType } from "@/types";
import { Field } from "@/components/ui/Field";
import { WaIcon } from "@/components/ui/WaIcon";
import { WhatsAppMessage } from "./WhatsAppMessage";

type CheckoutTab = "form" | "preview";

function problemMessages(error: ApiError): string[] {
  const details = error.details;
  if (Array.isArray(details)) {
    const messages = details
      .map((entry) => (entry && typeof entry === "object" && "message" in entry ? String((entry as { message: unknown }).message) : ""))
      .filter(Boolean);
    if (messages.length > 0) return messages;
  }
  return [error.message];
}

export function CheckoutModal({ form, onClose }: { form: CheckoutForm; onClose: () => void }) {
  const { cart, clearCart } = useCart();
  const { settings } = useProducts();
  const { customer, setCustomer, errors, validate } = form;
  const [activeTab, setActiveTab] = useState<CheckoutTab>("form");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [sentLink, setSentLink] = useState<string | null>(null);

  // Prévia com os dados do navegador. A mensagem final é montada com os dados oficiais da API.
  const message = useMemo(() => buildOrderMessage(customer, cart), [customer, cart]);

  // Mesmo requestId em tentativas repetidas do MESMO pedido (idempotência). Se o conteúdo mudar,
  // vira um pedido novo e ganha outro identificador.
  const attempt = useRef<{ key: string; requestId: string } | null>(null);

  const tooLow = belowMinimum(cart);
  const overStock = aboveStock(cart);
  const whatsappNumber = settings?.whatsappNumber ?? null;

  async function sendWhatsApp() {
    if (sending || tooLow.length > 0) return;
    setProblems([]);
    if (!validate()) { setActiveTab("form"); return; }
    if (!whatsappNumber) {
      setProblems(["O WhatsApp da loja não está disponível agora. Recarregue a página e tente de novo."]);
      return;
    }

    const payload = {
      customer: {
        type: customer.personType === "fisica" ? "PF" : "PJ",
        name: customer.name.trim(),
        document: onlyDigits(customer.document),
        phone: onlyDigits(customer.phone),
        zip: onlyDigits(customer.cep),
        street: customer.address.trim(),
        streetNumber: customer.number.trim(),
        ...(customer.complement.trim() ? { complement: customer.complement.trim() } : {}),
        neighborhood: customer.neighborhood.trim(),
        city: customer.city.trim(),
        state: customer.state.trim().toUpperCase(),
      },
      items: toOrderItems(cart),
    };
    const key = JSON.stringify(payload);
    if (!attempt.current || attempt.current.key !== key) {
      attempt.current = { key, requestId: crypto.randomUUID() };
    }

    // Abre a janela já no clique (navegadores bloqueiam abrir depois de aguardar a rede).
    const popup = window.open("", "_blank");
    setSending(true);
    try {
      const receipt = await storeApi.createOrder({ requestId: attempt.current.requestId, ...payload });
      const text = buildReceiptMessage(customer, receipt, settings?.companyName ?? "D'mais Comercial de Doces");
      const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
      attempt.current = null;
      clearCart();
      if (popup) popup.location.href = link;
      else window.open(link, "_blank");
      setSentLink(link);
    } catch (err) {
      popup?.close();
      setProblems(err instanceof ApiError ? problemMessages(err) : ["Não foi possível registrar o pedido. Tente de novo."]);
    } finally {
      setSending(false);
    }
  }

  function copyMessage() {
    navigator.clipboard.writeText(message).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onClose()} />
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
            <div className="bg-primary px-5 py-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-black text-lg" style={{ fontFamily: "'Baloo 2', cursive" }}>Finalizar Pedido</h2>
                <button onClick={() => onClose()} className="text-white/60 hover:text-white"><X size={22} /></button>
              </div>
              <div className="flex gap-1 bg-white/10 p-1 rounded-xl">
                {([["form","📋 Meus Dados"],["preview","👁 Pré-visualizar"]] as const).map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === tab ? "bg-white text-primary shadow" : "text-white/70 hover:text-white"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "form" && (
              <div className="overflow-y-auto px-5 py-5 space-y-4 flex-1">
                <div>
                  <label className="block text-primary font-bold text-sm mb-2">Tipo de Cliente</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["fisica","juridica"] as PersonType[]).map((type) => (
                      <button key={type} onClick={() => setCustomer((c) => ({ ...c, personType: type, document: "" }))}
                        className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${customer.personType === type ? "border-primary bg-primary text-white" : "border-border bg-secondary text-primary hover:border-primary/40"}`}>
                        {type === "fisica" ? "👤 Pessoa Física" : "🏢 Pessoa Jurídica"}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label={customer.personType === "fisica" ? "Nome Completo" : "Razão Social"} error={errors.name}>
                  <input type="text" placeholder={customer.personType === "fisica" ? "Ex: João da Silva" : "Ex: Empresa LTDA"} value={customer.name}
                    onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} className="input-style" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={customer.personType === "fisica" ? "CPF" : "CNPJ"} error={errors.document}>
                    <input type="text" placeholder={customer.personType === "fisica" ? "000.000.000-00" : "00.000.000/0000-00"} value={customer.document}
                      onChange={(e) => setCustomer((c) => ({ ...c, document: formatDocument(e.target.value, c.personType) }))} className="input-style" />
                  </Field>
                  <Field label="WhatsApp / Telefone" error={errors.phone}>
                    <input type="tel" placeholder="(11) 99999-9999" value={customer.phone}
                      onChange={(e) => setCustomer((c) => ({ ...c, phone: formatPhone(e.target.value) }))} className="input-style" />
                  </Field>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-primary font-bold text-sm mb-3">📍 Endereço de Entrega</p>
                  <div className="space-y-3">
                    <Field label="CEP" error={errors.cep}>
                      <input type="text" placeholder="00000-000" value={customer.cep}
                        onChange={(e) => setCustomer((c) => ({ ...c, cep: formatCEP(e.target.value) }))} className="input-style" />
                    </Field>
                    <Field label="Endereço" error={errors.address}>
                      <input type="text" placeholder="Rua, Avenida..." value={customer.address}
                        onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))} className="input-style" />
                    </Field>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Número" error={errors.number}>
                        <input type="text" placeholder="123" value={customer.number}
                          onChange={(e) => setCustomer((c) => ({ ...c, number: e.target.value }))} className="input-style" />
                      </Field>
                      <div className="col-span-2">
                        <Field label="Complemento">
                          <input type="text" placeholder="Apto, Sala... (opcional)" value={customer.complement}
                            onChange={(e) => setCustomer((c) => ({ ...c, complement: e.target.value }))} className="input-style" />
                        </Field>
                      </div>
                    </div>
                    <Field label="Bairro" error={errors.neighborhood}>
                      <input type="text" placeholder="Ex: Centro" value={customer.neighborhood}
                        onChange={(e) => setCustomer((c) => ({ ...c, neighborhood: e.target.value }))} className="input-style" />
                    </Field>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Field label="Cidade" error={errors.city}>
                          <input type="text" placeholder="Ex: São Paulo" value={customer.city}
                            onChange={(e) => setCustomer((c) => ({ ...c, city: e.target.value }))} className="input-style" />
                        </Field>
                      </div>
                      <Field label="Estado" error={errors.state}>
                        <input type="text" placeholder="SP" maxLength={2} value={customer.state}
                          onChange={(e) => setCustomer((c) => ({ ...c, state: e.target.value.toUpperCase() }))} className="input-style" />
                      </Field>
                    </div>
                  </div>
                </div>
                <button onClick={() => setActiveTab("preview")}
                  className="w-full border-2 border-primary text-primary font-bold py-2.5 rounded-full text-sm flex items-center justify-center gap-2 hover:bg-primary/5 transition-all">
                  <Eye size={15} /> Ver pré-visualização da mensagem
                </button>
              </div>
            )}

            {activeTab === "preview" && (
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                <div className="flex items-start gap-3 bg-[#e7f8ef] border border-[#25D366]/30 rounded-xl p-3">
                  <WaIcon className="flex-shrink-0 mt-0.5 text-[#25D366]" size={18} />
                  <div>
                    <p className="text-[#1a7a3c] font-bold text-sm">Mensagem pronta para envio</p>
                    <p className="text-[#1a7a3c]/70 text-xs mt-0.5">Essa mensagem será enviada automaticamente ao fornecedor no WhatsApp.</p>
                  </div>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border shadow">
                  <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"><span className="text-lg">🍬</span></div>
                    <div>
                      <p className="text-white font-bold text-sm">D'mais Comercial de Doces</p>
                      <p className="text-white/60 text-xs">online</p>
                    </div>
                  </div>
                  <div className="p-4 min-h-32" style={{ background: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d1fae5' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\"), #ECE5DD" }}>
                    <div className="ml-auto max-w-[90%] w-fit">
                      <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm relative">
                        <div className="text-gray-800 leading-relaxed" style={{ fontFamily: "system-ui, sans-serif" }}>
                          <WhatsAppMessage text={message} />
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-2">
                          <span className="text-[10px] text-gray-400">agora</span>
                          <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><path d="M11.071.653L5.76 9.26 2.47 6.03 1 7.5l4.76 4.5 6.87-10.5-1.56-.847z" fill="#53bdeb"/><path d="M15.071.653L9.76 9.26 8.47 8.03 7 9.5l2.76 2.5 6.87-10.5-1.56-.847z" fill="#53bdeb"/></svg>
                        </div>
                        <div className="absolute top-0 right-0 translate-x-1.5 w-0 h-0" style={{ borderLeft: "8px solid #DCF8C6", borderTop: "8px solid transparent" }} />
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={copyMessage}
                  className={`w-full border-2 font-bold py-2.5 rounded-full text-sm flex items-center justify-center gap-2 transition-all ${copied ? "border-green-500 text-green-600 bg-green-50" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "Mensagem copiada!" : "Copiar mensagem"}
                </button>
                <button onClick={() => setActiveTab("form")} className="w-full text-muted-foreground text-sm font-semibold py-1 flex items-center justify-center gap-1 hover:text-primary transition-colors">
                  ← Voltar e editar dados
                </button>
              </div>
            )}

            <div className="px-5 py-4 border-t border-border bg-card flex-shrink-0 space-y-2">
              {sentLink ? (
                <>
                  <p className="text-center text-[#1a7a3c] font-bold text-sm">Pedido registrado! Envie a mensagem no WhatsApp.</p>
                  <a href={sentLink} target="_blank" rel="noopener noreferrer"
                    className="w-full bg-[#25D366] hover:bg-[#1ebe5a] text-white font-black py-3 rounded-full text-base flex items-center justify-center gap-2 shadow-lg transition-all">
                    <WaIcon size={22} /> Abrir WhatsApp novamente
                  </a>
                  <button onClick={() => onClose()} className="w-full text-muted-foreground text-sm font-semibold py-1 hover:text-primary">Fechar</button>
                </>
              ) : (
                <>
                  {tooLow.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                      {tooLow.map((item) => (
                        <p key={item.productId}><strong>{item.name}</strong>: quantidade mínima é {item.minQty} (você tem {item.qty}).</p>
                      ))}
                    </div>
                  )}
                  {overStock.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 flex gap-2">
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        {overStock.map((item) => `${item.name}: só há ${item.stock} em estoque`).join(" · ")}. O pedido pode ser recusado.
                      </span>
                    </div>
                  )}
                  {problems.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700 space-y-0.5">
                      {problems.map((text, index) => <p key={index}>{text}</p>)}
                    </div>
                  )}
                  <button onClick={sendWhatsApp} disabled={sending || tooLow.length > 0 || cart.length === 0}
                    className="w-full bg-[#25D366] hover:bg-[#1ebe5a] active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-full text-base flex items-center justify-center gap-2 shadow-lg transition-all">
                    {sending ? <><Loader2 size={20} className="animate-spin" /> Registrando pedido...</>
                      : problems.length > 0 ? <><WaIcon size={22} /> Tentar de novo</>
                      : <><WaIcon size={22} /> Enviar Pedido pelo WhatsApp</>}
                  </button>
                  <p className="text-center text-muted-foreground text-xs">O pedido é registrado e, em seguida, o WhatsApp abre com a mensagem pronta</p>
                </>
              )}
            </div>
          </div>
        </div>
  );
}
