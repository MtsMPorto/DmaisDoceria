import { Instagram } from "lucide-react";
import logoImg from "@/assets/images/Logo_Doces-removebg-preview__1_.png";
import { useProducts } from "@/contexts/ProductsContext";
import { WaIcon } from "@/components/ui/WaIcon";

// Link público do perfil oficial da loja.
const instagramUrl = "https://www.instagram.com/dmaiscomercial/";
const contactMessage = "Olá! Vim pelo site e queria saber mais sobre";

export function Footer() {
  const { settings } = useProducts();
  const companyName = settings?.companyName ?? "D'mais Comercial de Doces";
  const whatsappNumber = settings?.whatsappNumber;

  return (
    <footer className="text-white relative overflow-hidden" style={{ background: "#0f1f4a" }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }} />
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-12">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-6">
            <img src={logoImg} alt="D'mais" className="h-20 w-20 object-contain" />
            <div>
              <p className="text-white font-black text-xl leading-tight" style={{ fontFamily: "'Baloo 2', cursive" }}>D'mais</p>
              <p className="text-white/40 text-base">Comercial de Doces</p>
            </div>
          </div>
          <p className="text-white/50 text-base leading-relaxed max-w-sm mt-8">
            Os melhores confeitos para revenda, com atendimento direto e preço de atacado. Simples assim.
          </p>
          <p className="text-white/60 text-sm font-black uppercase mt-5 mb-3">Fale conosco</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {whatsappNumber && (
              <a href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(contactMessage)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5a] text-white font-bold text-base px-5 py-3 rounded-2xl transition-colors">
                <WaIcon size={20} /> Iniciar conversa
              </a>
            )}
            {instagramUrl ? (
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-white font-bold text-base px-5 py-3 rounded-2xl hover:opacity-90 transition-opacity"
                style={{ background: "linear-gradient(110deg, #f79420, #e72b56, #c21585)" }}>
                <Instagram size={20} /> Instagram
              </a>
            ) : null}
          </div>
        </div>
        <div className="my-10 border-t border-white/10" />
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-2">
            {["Pix", "Dinheiro"].map((method) => (
              <span key={method} className="text-white/40 text-xs font-bold px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
                {method}
              </span>
            ))}
          </div>
          <p className="text-white/25 text-base text-center">
            © {new Date().getFullYear()} {companyName} · Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}
