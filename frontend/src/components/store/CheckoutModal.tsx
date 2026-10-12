import { checkoutGeneration, exclusiveCheckout, getOrderAttempt, orderAttemptKey } from "@/lib/orderAttempt";
import { AccountModal } from "@/components/account/AccountModal";
import { useAccount } from "@/contexts/AccountContext";
import { accountRequest } from "@/services/accountService";
import type { OrderReceipt } from "@/types/api";
import { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useProducts } from "@/contexts/ProductsContext";
import type { CheckoutForm } from "@/hooks/useCheckoutForm";
import { aboveStock, belowMinimum, toOrderItems } from "@/lib/cart";
import { onlyDigits } from "@/lib/document";
import { formatCEP, formatDocument, formatPhone } from "@/lib/format";
import { buildReceiptMessage } from "@/lib/whatsapp";
import { ApiError } from "@/services/api";
import { WaIcon } from "@/components/ui/WaIcon";




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

export function CheckoutModal(props: { form: CheckoutForm; onClose: () => void }) {
  const { profile, loading, accountOpen } = useAccount();
  if (loading) return <div className="account-overlay"><div className="account-modal" role="status">Carregando sua conta...</div></div>;
  if (!profile) return accountOpen ? null : <AccountModal onClose={props.onClose} onAuthenticated={() => {}} initialScreen="login" />;
  return <AuthenticatedCheckout {...props} />;
}
function AuthenticatedCheckout({ form, onClose }: { form: CheckoutForm; onClose: () => void }) {
  const { openAccount, profile } = useAccount();
  const { cart, clearCart } = useCart();
  const { settings } = useProducts();
  const { customer, errors, validate } = form;
  const [sending, setSending] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [sentLink, setSentLink] = useState<string | null>(null);
  const [generation] = useState(() => {
    try { return checkoutGeneration(localStorage); } catch { return null; }
  });


  // Mesmo requestId em tentativas repetidas do MESMO pedido (idempotência). Se o conteúdo mudar,
  // vira um pedido novo e ganha outro identificador.

  const tooLow = belowMinimum(cart);
  const overStock = aboveStock(cart);
  const whatsappNumber = settings?.whatsappNumber ?? null;

  async function sendWhatsApp() {
    if (sending || tooLow.length > 0 || overStock.length > 0 || cart.length === 0) return;
    setProblems([]);
    if (!validate()) return;
    if (!whatsappNumber) {
      setProblems(["O WhatsApp da loja não está disponível agora. Recarregue a página e tente de novo."]);
      return;
    }

    const payload = {
      customer: {
        type: customer.personType === "fisica" ? "PF" : "PJ",
        name: customer.name.trim(),
        document: customer.personType === "juridica" ? customer.document.replace(/[./-]/g, "") : "",
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
    if (!profile) return;
    if (generation === null) {
      setProblems(["Permita o armazenamento do navegador para finalizar o pedido com segurança."]);
      return;
    }

    // Abre a janela já no clique (navegadores bloqueiam abrir depois de aguardar a rede).
    const popup = window.open("", "_blank");
    setSending(true);
    try {
      const { receipt, attempt } = await exclusiveCheckout(navigator.locks, localStorage, generation, async () => {
        const attempt = getOrderAttempt(localStorage, orderAttemptKey(profile.id, payload.items), () => crypto.randomUUID());
        const receipt = await accountRequest<OrderReceipt>("/api/orders", { requestId: attempt.requestId, items: payload.items });
        return { receipt, attempt };
      }, () => crypto.randomUUID());
      const text = buildReceiptMessage(customer, receipt, settings?.companyName ?? "D'mais Comercial de Doces");
      const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
      clearCart();
      try { localStorage.removeItem(attempt.storageKey); } catch {}
      if (popup) popup.location.href = link;
      else window.open(link, "_blank");
      setSentLink(link);
    } catch (err) {
      popup?.close();
      setProblems(err instanceof ApiError ? problemMessages(err) : [err instanceof Error && (err.message.startsWith("Este carrinho") || err.message.startsWith("Atualize seu navegador")) ? err.message : "Não foi possível registrar o pedido. Tente de novo."]);
    } finally {
      setSending(false);
    }
  }


  return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!sending) onClose(); }} />
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
            <div className="bg-primary px-5 py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-black text-lg" style={{ fontFamily: "'Baloo 2', cursive" }}>Finalizar Pedido</h2>
                <button onClick={() => onClose()} className="text-white/60 hover:text-white"><X size={22} /></button>
              </div>
            </div>

              <div className="overflow-y-auto px-5 py-5 space-y-4 flex-1">
                <div className="rounded-2xl bg-secondary p-4 space-y-2 text-sm text-primary break-words">
                  <p className="font-bold">{customer.name}</p>
                  {customer.personType === "juridica" && <p>CNPJ: {formatDocument(customer.document, "juridica")}</p>}
                  <p>{formatPhone(customer.phone)}</p>
                  <p>{customer.address}, {customer.number}{customer.complement ? ' — '+customer.complement : ''}</p>
                  <p>{customer.neighborhood} · {customer.city}/{customer.state}</p>
                  <p>CEP: {formatCEP(customer.cep)}</p>
                </div>
                <button className="text-primary font-bold text-sm" onClick={openAccount}>Editar meus dados na conta</button>
              </div>

            <div className="px-5 py-4 border-t border-border bg-card flex-shrink-0 space-y-2">
              {Object.keys(errors).length > 0 && <div role="alert" className="text-sm text-red-700">{Object.values(errors).map(message => <p key={message}>{message}</p>)}</div>}
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
                  <button onClick={sendWhatsApp} disabled={sending || tooLow.length > 0 || overStock.length > 0 || cart.length === 0}
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
