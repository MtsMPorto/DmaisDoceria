import { useState, useEffect, useMemo, useRef } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { useProducts } from "@/contexts/ProductsContext";
import { useCart } from "@/contexts/CartContext";
import { useCheckoutForm } from "@/hooks/useCheckoutForm";
import type { Product } from "@/types";
import { AboutSection } from "@/components/store/AboutSection";
import { BestSellersCarousel } from "@/components/store/BestSellersCarousel";
import { CartDrawer } from "@/components/store/CartDrawer";
import { CatalogSection } from "@/components/store/CatalogSection";
import { CategoryBar } from "@/components/store/CategoryBar";
import { CheckoutModal } from "@/components/store/CheckoutModal";
import { FeaturedSection } from "@/components/store/FeaturedSection";
import { FlavorModal } from "@/components/store/FlavorModal";
import { FloatingCartButton } from "@/components/store/FloatingCartButton";
import { Footer } from "@/components/store/Footer";
import { Hero } from "@/components/store/Hero";
// Avaliações desativadas nesta versão; preservar para reativação futura.
// import { ReviewsSection } from "@/components/store/ReviewsSection";
import { SearchOverlay } from "@/components/store/SearchOverlay";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ErrorBox, LoadingBox } from "@/components/ui/AsyncState";

export default function Store() {
  const { products, loading, error, reload } = useProducts();
  const activeProducts = products.filter((p) => p.active);
  const { cart, totalItems, cartKey, replaceFlavors } = useCart();
  const checkoutForm = useCheckoutForm();
  const navigate = useNavigate();

  const [flavorModalProduct, setFlavorModalProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Todos");

  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchAnimating, setSearchAnimating] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);

  const bestSellers = useMemo(() => activeProducts.filter(p => p.bestSeller), [activeProducts]);
  const promotions = useMemo(() => activeProducts.filter((p) => p.featured), [activeProducts]);

  const suggestions = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return activeProducts
      .filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, activeProducts]);

  function openSearch() {
    setSearchAnimating(true);
    setTimeout(() => {
      setSearchOpen(true);
      setSearchAnimating(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }, 380);
  }

  function closeSearch() {
    setSearch("");
    setCommittedSearch("");
    setSearchOpen(false);
    setShowSuggestions(false);
  }

  function commitSearch(value: string) {
    setCommittedSearch(value.trim());
    setSearchOpen(false);
    setSearchAnimating(false);
    setTimeout(() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }), 0);
    setActiveCategory("Todos");
    setShowSuggestions(false);
  }

  function pickSuggestion(productId: number, name: string) {
    setSearch(name);
    setSearchOpen(false);
    setSearchAnimating(false);
    setShowSuggestions(false);
    navigate(`/product/${productId}`);
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitSearch(search);
    if (e.key === "Escape") closeSearch();
  }

  const filtered = activeProducts.filter((p) => {
    const matchCat = activeCategory === "Todos" || p.category === activeCategory;
    const matchSearch =
      !committedSearch ||
      p.name.toLowerCase().includes(committedSearch.toLowerCase()) ||
      p.brand.toLowerCase().includes(committedSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  function handleFlavorConfirm(product: Product, selections: { flavor: string; qty: number }[]) {
    replaceFlavors(product, selections);
    setFlavorModalProduct(null);
  }

  useEffect(() => {
    document.body.style.overflow = cartOpen || checkoutOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen, checkoutOpen]);

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <StoreHeader
        searchBtnRef={searchBtnRef}
        searchOpen={searchOpen}
        openSearch={openSearch}
        closeSearch={closeSearch}
        onOpenCart={() => setCartOpen(true)}
        totalItems={totalItems}
      />

      <Hero />

      <CategoryBar activeCategory={activeCategory} onSelect={setActiveCategory} />

      {products.length === 0 && error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : products.length === 0 && loading ? (
        <LoadingBox label="Carregando catálogo..." />
      ) : (
        <>
          <FeaturedSection products={promotions} onOpenFlavorModal={setFlavorModalProduct} />
          {bestSellers.length > 0 && <BestSellersCarousel products={bestSellers} onOpenFlavorModal={setFlavorModalProduct} />}

          <CatalogSection
            activeCategory={activeCategory}
            products={filtered}
            onOpenFlavorModal={setFlavorModalProduct}
          />
        </>
      )}

      {/* <ReviewsSection /> */}
      <AboutSection />
      <Footer />

      {totalItems > 0 && !cartOpen && !checkoutOpen && (
        <FloatingCartButton totalItems={totalItems} onOpen={() => setCartOpen(true)} />
      )}

      {cartOpen && (
        <CartDrawer
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
      )}

      {checkoutOpen && <CheckoutModal form={checkoutForm} onClose={() => setCheckoutOpen(false)} />}

      {flavorModalProduct && (
        <FlavorModal
          product={flavorModalProduct}
          cartItems={cart}
          cartKey={cartKey}
          onConfirm={(selections) => handleFlavorConfirm(flavorModalProduct, selections)}
          onClose={() => setFlavorModalProduct(null)}
        />
      )}

      {(searchAnimating || searchOpen) && (
        <SearchOverlay
          searchAnimating={searchAnimating}
          searchInputRef={searchInputRef}
          search={search}
          setSearch={setSearch}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
          suggestions={suggestions}
          closeSearch={closeSearch}
          commitSearch={commitSearch}
          pickSuggestion={pickSuggestion}
          handleSearchKeyDown={handleSearchKeyDown}
        />
      )}
    </div>
  );
}
