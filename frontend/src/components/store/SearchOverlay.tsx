import type { KeyboardEvent, RefObject } from "react";
import { Search, X } from "lucide-react";
import type { Product } from "@/types";

  function highlight(text: string, query: string) {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-black" style={{ color: "#27408A" }}>{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  }

export function SearchOverlay({
  searchAnimating,
  searchInputRef,
  search,
  setSearch,
  showSuggestions,
  setShowSuggestions,
  suggestions,
  closeSearch,
  commitSearch,
  pickSuggestion,
  handleSearchKeyDown,
}: {
  searchAnimating: boolean;
  searchInputRef: RefObject<HTMLInputElement>;
  search: string;
  setSearch: (value: string) => void;
  showSuggestions: boolean;
  setShowSuggestions: (value: boolean) => void;
  suggestions: Product[];
  closeSearch: () => void;
  commitSearch: (value: string) => void;
  pickSuggestion: (productId: number, name: string) => void;
  handleSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center ${searchAnimating ? "search-ripple-enter" : "search-ripple-done"}`}
          style={{
            background: "linear-gradient(to bottom, rgba(121,130,168,0.93) 0%, rgba(121,130,168,0.52) 55%, rgba(121,130,168,0.06) 100%)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        >
          <div className="w-full flex justify-end px-6 pt-5">
            <button onClick={closeSearch} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <X size={20} className="text-white" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-start pt-10 px-4 w-full max-w-xl">
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-4">Buscar produto</p>
            <div className="relative w-full">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Digite o nome ou marca..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-11 pr-4 py-4 text-white text-lg font-semibold focus:outline-none placeholder:text-white/40"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "2px solid rgba(255,255,255,0.35)",
                  borderRadius: "1rem",
                  fontFamily: "'Nunito', sans-serif",
                }}
              />
              {search && (
                <button onClick={() => { setSearch(""); setShowSuggestions(false); searchInputRef.current?.focus(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="w-full mt-2 rounded-2xl overflow-hidden shadow-2xl"
                style={{ background: "rgba(255,255,255,0.97)", maxHeight: 340, overflowY: "auto" }}>
                {suggestions.map((product) => (
                  <button
                    key={product.id}
                    onMouseDown={() => pickSuggestion(product.id, product.name)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#7982A8]/10 transition-colors text-left border-b border-gray-100 last:border-0">
                    <img src={product.image} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-secondary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-tight">{highlight(product.name, search)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{highlight(product.brand, search)} · {product.category}</p>
                    </div>
                    <Search size={13} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {showSuggestions && search.trim() && suggestions.length === 0 && (
              <div className="w-full mt-2 rounded-2xl px-4 py-6 text-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                <p className="text-white/70 text-sm">Nenhum produto encontrado para "<strong>{search}</strong>"</p>
              </div>
            )}

            {search.trim() && (
              <button
                onMouseDown={() => commitSearch(search)}
                className="mt-3 text-white/60 text-xs font-semibold flex items-center gap-1.5 hover:text-white transition-colors">
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black">Enter</span>
                para ver todos os resultados de "{search}"
              </button>
            )}
          </div>
        </div>
  );
}
