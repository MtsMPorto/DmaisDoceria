import { useEffect, useState, type RefObject } from "react";
import { Link } from "react-router";
import { fetchMe, isAuthenticated } from "@/services/authService";
import { useAccount } from "@/contexts/AccountContext";
import { Search, ShoppingCart, X, UserRound, Settings } from "lucide-react";
import logoImg from "@/assets/images/Logo_Doces-removebg-preview__1_.png";

export function StoreHeader({
  searchBtnRef,
  searchOpen,
  openSearch,
  closeSearch,
  onOpenCart,
  totalItems,
}: {
  searchBtnRef: RefObject<HTMLButtonElement>;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  onOpenCart: () => void;
  totalItems: number;
}) {
  const { openAccount } = useAccount();
  const [adminLoggedIn, setAdminLoggedIn] = useState(isAuthenticated);
  useEffect(() => {
    let active = true;
    async function checkAdmin() {
      if (!isAuthenticated()) {
        if (active) setAdminLoggedIn(false);
        return;
      }
      try {
        await fetchMe();
        if (active) setAdminLoggedIn(true);
      } catch {
        // A network failure does not end the session; a 401 clears it in api.ts.
        if (active) setAdminLoggedIn(isAuthenticated());
      }
    }
    void checkAdmin();
    window.addEventListener("focus", checkAdmin);
    return () => {
      active = false;
      window.removeEventListener("focus", checkAdmin);
    };
  }, []);
  return (
      <header className="absolute top-0 left-0 right-0 z-40" style={{ background: "transparent" }}>
        <div className="max-w-7xl mx-auto px-4 grid items-center" style={{ gridTemplateColumns: "1fr auto 1fr", height: "calc(4rem + max(env(safe-area-inset-top, 0px), var(--sat-fallback, 0px)))", paddingTop: "max(env(safe-area-inset-top, 0px), var(--sat-fallback, 0px))" }}>
          <div />
          <div className="flex flex-col items-center justify-center">
            <img src={logoImg} alt="D'mais Comercial de Doces" className="h-20 w-20 object-contain drop-shadow-lg" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <div className="relative flex items-center">
              <button
                ref={searchBtnRef}
                onClick={searchOpen ? closeSearch : openSearch}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all z-10 relative"
                style={{ background: searchOpen ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)" }}
                title="Buscar">
                {searchOpen ? <X size={15} className="text-white" /> : <Search size={15} className="text-white" />}
              </button>
            </div>
            <button onClick={() => onOpenCart()}
              className="relative flex items-center gap-2 text-white px-4 py-2 rounded-full font-bold text-sm transition-all active:scale-95 shadow-lg"
              style={{ background: "#F97316" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#ea6c0a")}
              onMouseLeave={e => (e.currentTarget.style.background = "#F97316")}>
              <ShoppingCart size={18} />
              <span className="hidden sm:inline">Carrinho</span>
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center" style={{ color: "#27408A" }}>{totalItems}</span>
              )}
            </button>
            {adminLoggedIn ? (
              <Link to="/admin/panel" className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,0.10)" }} title="Painel Admin" aria-label="Abrir painel de administração">
                <Settings size={15} className="text-white/60" />
              </Link>
            ) : (
            <button onClick={openAccount} type="button" className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,0.10)" }} title="Minha conta" aria-label="Minha conta">
              <UserRound size={15} className="text-white/60" />
            </button>
            )}
          </div>
        </div>
      </header>
  );
}
