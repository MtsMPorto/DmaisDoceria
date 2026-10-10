import { useState } from "react";
import { Check, Copy, Send, X } from "lucide-react";
import { buildQuoteMessage, formatPhoneForWA } from "@/lib/whatsapp";
import type { Quote } from "@/types";

export function WhatsAppModal({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const message = buildQuoteMessage(quote);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(message).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openWA() {
    const phone = formatPhoneForWA(quote.customerPhone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85dvh] flex flex-col overflow-hidden">
        <div style={{ background: "#25D366" }} className="px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="text-white/80 text-xs">Pré-visualização</p>
            <h3 className="text-white font-black" style={{ fontFamily: "'Baloo 2', cursive" }}>Mensagem WhatsApp</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-[#ECE5DD] rounded-2xl p-4">
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <pre className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans break-words">{message}</pre>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-4 py-4 border-t border-border shrink-0">
          <button onClick={copy}
            className={`flex items-center gap-1.5 px-4 py-2 border border-border rounded-xl text-xs font-bold transition-colors ${copied ? "text-green-600 border-green-300 bg-green-50" : "text-muted-foreground hover:border-primary hover:text-primary"}`}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copiado!" : "Copiar"}
          </button>
          <button onClick={openWA}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] text-white text-xs font-bold rounded-xl px-4 py-2 hover:bg-[#1ebe5a] transition-colors">
            <Send size={13} /> Abrir no WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
