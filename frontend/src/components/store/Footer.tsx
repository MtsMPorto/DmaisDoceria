import logoImg from "@/assets/images/Logo_Doces-removebg-preview__1_.png";
import { useProducts } from "@/contexts/ProductsContext";
import { WaIcon } from "@/components/ui/WaIcon";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// Links sem destino real (antes href="#") ficam ESCONDIDOS até existir uma página ou endereço.
export function Footer({ onSelectCategory }: { onSelectCategory: (category: string) => void }) {
  const { categories, settings } = useProducts();
  const companyName = settings?.companyName ?? "D'mais Comercial de Doces";
  const whatsappNumber = settings?.whatsappNumber ?? null;

  const shopLinks: { label: string; action: () => void }[] = [
    { label: "Mais Vendidos", action: () => scrollTo("mais-vendidos") },
    { label: "Todos os Produtos", action: () => scrollTo("catalogo") },
    ...categories.map((name) => ({
      label: name,
      action: () => {
        onSelectCategory(name);
        scrollTo("catalogo");
      },
    })),
  ];

  return (
      <footer className="text-white relative overflow-hidden" style={{ background: "#0f1f4a" }}>
        {/* Dot texture overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }} />
        {/* Accent top line */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(to right, transparent, #F97316, #27408A, transparent)" }} />

        {/* Main footer content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">

            {/* Loja */}
            <div>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">Loja</p>
              <ul className="space-y-2">
                {shopLinks.map(({ label, action }) => (
                  <li key={label}>
                    <button onClick={action} className="text-white/55 text-sm hover:text-white hover:translate-x-1 transition-all text-left">{label}</button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Logo + WhatsApp CTA */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <img src={logoImg} alt="D'mais" className="h-20 w-20 object-contain" />
                <div>
                  <p className="text-white font-black text-base leading-tight" style={{ fontFamily: "'Baloo 2', cursive" }}>D'mais</p>
                  <p className="text-white/40 text-xs">Comercial de Doces</p>
                </div>
              </div>
              <p className="text-white/50 text-xs leading-relaxed">
                Os melhores confeitos para revenda, com atendimento direto e preço de atacado. Simples assim.
              </p>
              {whatsappNumber && (
                <div>
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-wide mb-2">Fale conosco</p>
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all w-fit shadow-lg active:scale-95"
                    style={{ background: "#25D366" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#1ebe5a")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#25D366")}>
                    <WaIcon size={16} /> Iniciar conversa
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-8 border-t border-white/10" />

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Payment badges */}
            <div className="flex items-center gap-2">
              {["Pix", "Boleto", "Cartão"].map((method) => (
                <span key={method} className="text-white/40 text-[10px] font-bold px-2.5 py-1 rounded-md"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  {method}
                </span>
              ))}
            </div>

            {/* Copyright */}
            <p className="text-white/25 text-xs text-center sm:text-right">
              © {new Date().getFullYear()} {companyName} · Todos os direitos reservados
            </p>
          </div>
        </div>
      </footer>
  );
}
