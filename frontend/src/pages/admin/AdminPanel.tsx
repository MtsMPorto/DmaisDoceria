import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Inbox, LogOut, Package, Receipt, Users } from "lucide-react";
// import { MessageSquare } from "lucide-react";
// import { BarChart2, ClipboardList } from "lucide-react";
import logoImg from "@/assets/images/Logo_Doces-removebg-preview__1_.png";
// import { SHOW_QUOTES } from "@/config/features";
import { setUnauthorizedHandler } from "@/services/api";
import { logout as clearSession } from "@/services/authService";
import AdminCustomers from "./customers/AdminCustomers";
import AdminOrders from "./orders/AdminOrders";
import AdminProducts from "./products/AdminProducts";
// Seções temporariamente desativadas; código preservado para reativação.
// import AdminQuotes from "./quotes/AdminQuotes";
// import AdminReports from "./reports/AdminReports";
import AdminSales from "./sales/AdminSales";
// import AdminTestimonials from "./testimonials/AdminTestimonials";

type Section = "produtos" | "solicitacoes" | "clientes" | "vendas" | "relatorios" | "depoimentos" | "orcamentos";

const TABS: { key: Section; label: string; icon: typeof Package }[] = [
  { key: "produtos", label: "Produtos", icon: Package },
  { key: "solicitacoes", label: "Solicitações", icon: Inbox },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "vendas", label: "Vendas", icon: Receipt },
  // { key: "relatorios", label: "Relatórios", icon: BarChart2 },
  // { key: "depoimentos", label: "Depoimentos", icon: MessageSquare },
  // ...(SHOW_QUOTES ? [{ key: "orcamentos" as const, label: "Orçamentos", icon: ClipboardList }] : []),
];

export default function AdminPanel() {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("produtos");
  // Navegação entre abas: abrir uma venda existente ou criar rascunho para um cliente.
  const [openSaleId, setOpenSaleId] = useState<number | null>(null);
  const [newSaleCustomerId, setNewSaleCustomerId] = useState<number | null>(null);

  // 401 em qualquer chamada autenticada derruba a sessão e volta ao login.
  useEffect(() => {
    setUnauthorizedHandler(() => navigate("/admin?motivo=sessao", { replace: true }));
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await clearSession();
      navigate("/admin", { replace: true });
    } catch {
      setLogoutError("Não foi possível encerrar a sessão. Verifique sua conexão e tente sair novamente.");
    } finally { setLoggingOut(false); }
  }

  const goToSale = useCallback((saleId: number) => {
    setOpenSaleId(saleId);
    setSection("vendas");
  }, []);

  const clearOpenSale = useCallback(() => setOpenSaleId(null), []);
  const clearNewSale = useCallback(() => setNewSaleCustomerId(null), []);

  return (
    <div className="min-h-screen bg-[#F4F6FA]" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <header className="bg-primary shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="D'mais" className="w-10 h-10 object-contain" />
            <div>
              <p className="text-white font-black text-base leading-tight" style={{ fontFamily: "'Baloo 2', cursive" }}>D'mais Admin</p>
              <p className="text-accent text-[10px] font-bold uppercase tracking-wider">Painel de Controle</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-white/60 hover:text-white text-xs font-semibold transition-colors">← Ver loja</a>
            <button onClick={logout} disabled={loggingOut} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all">
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </header>
      {logoutError && <p role="alert" className="p-3 text-red-700 bg-red-50">{logoutError}</p>}

      <div className="bg-white border-b border-border shadow-sm sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setSection(key)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${section === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {section === "produtos" && <AdminProducts />}
        {section === "solicitacoes" && <AdminOrders onOpenSale={goToSale} />}
        {section === "clientes" && (
          <AdminCustomers
            onOpenSale={goToSale}
            onNewSale={(customerId) => { setNewSaleCustomerId(customerId); setSection("vendas"); }}
          />
        )}
        {section === "vendas" && (
          <AdminSales
            openSaleId={openSaleId}
            onOpenedSale={clearOpenSale}
            newSaleForCustomerId={newSaleCustomerId}
            onNewSaleHandled={clearNewSale}
          />
        )}
        {/* {section === "relatorios" && <AdminReports />} */}
        {/* {section === "depoimentos" && <AdminTestimonials />} */}
        {/* {SHOW_QUOTES && section === "orcamentos" && <AdminQuotes />} */}
      </div>
    </div>
  );
}
