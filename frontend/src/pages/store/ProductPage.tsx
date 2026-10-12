import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, ShoppingCart, Package, Truck, Minus, Plus } from "lucide-react";
import { CartDrawer } from "@/components/store/CartDrawer";
import { CheckoutModal } from "@/components/store/CheckoutModal";
import { useCheckoutForm } from "@/hooks/useCheckoutForm";
import logoImg from "@/assets/images/Logo_Doces-removebg-preview__1_.png";
import { useProducts } from "@/contexts/ProductsContext";
import { useCart } from "@/contexts/CartContext";
import { Stars } from "@/components/ui/Stars";
import { WaIcon } from "@/components/ui/WaIcon";
import { StockBadge } from "@/components/store/StockBadge";
import { UpsellModal } from "@/components/store/UpsellModal";
import { ErrorBox, LoadingBox } from "@/components/ui/AsyncState";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, loading, error, reload } = useProducts();
  const { addToCart, updateQty, cart, cartKey, totalItems } = useCart();
  const checkoutForm = useCheckoutForm();

  const product = products.find((p) => p.id === Number(id));

  const [selectedFlavor, setSelectedFlavor] = useState<string | undefined>(
    product?.flavors?.[0]
  );
  const [showUpsell, setShowUpsell] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    if (!cartOpen && !checkoutOpen && !showUpsell) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [cartOpen, checkoutOpen, showUpsell]);

  // Reset flavor when product changes
  useEffect(() => {
    setSelectedFlavor(product?.flavors?.[0]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id, product?.flavors]);

  if (!product && products.length === 0 && (loading || error)) {
    return (
      <div className="min-h-screen" style={{ background: "#FFF8F0", fontFamily: "'Nunito', sans-serif" }}>
        {error ? <ErrorBox message={error} onRetry={reload} /> : <LoadingBox label="Carregando produto..." />}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#FFF8F0", fontFamily: "'Nunito', sans-serif" }}>
        <p className="text-4xl">😕</p>
        <p className="font-bold text-lg" style={{ color: "#27408A" }}>Produto não encontrado</p>
        <Link to="/" className="px-6 py-2 rounded-full text-white font-bold text-sm" style={{ background: "#27408A" }}>← Voltar à loja</Link>
      </div>
    );
  }

  // Related: same category, exclude current, max 4
  const related = products
    .filter((p) => p.active && p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  // Upsell: 1-2 from related or other active products
  const upsellProducts = related.slice(0, 2).length > 0
    ? related.slice(0, 2)
    : products.filter((p) => p.active && p.id !== product.id).slice(0, 2);

  const flavor = product.flavors?.includes(selectedFlavor ?? "") ? selectedFlavor : product.flavors?.[0];
  const currentKey = `${product.id}::${flavor ?? ""}`;
  const inCart = cart.find((i) => cartKey(i) === currentKey);
  const totalForProduct = cart.filter(i => i.id === product.id).reduce((sum, i) => sum + i.qty, 0);
  const atStockLimit = totalForProduct >= product.stock;

  function increaseQuantity() {
    if (!atStockLimit) addToCart(product, flavor);
  }

  function handleAddToCart() {
    if (atStockLimit) return;
    increaseQuantity();
    setShowUpsell(true);
  }

  return (
    <div className="min-h-screen" style={{ background: "#FFF8F0", fontFamily: "'Nunito', sans-serif" }}>

      {/* HEADER */}
      <header className="sticky top-0 z-40" style={{ background: "#27408A" }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-semibold">
            <ArrowLeft size={18} /> Voltar
          </button>
          <Link to="/">
            <img src={logoImg} alt="D'mais" className="h-10 w-10 object-contain" />
          </Link>
          <button type="button" onClick={() => setCartOpen(true)} className="relative" aria-label="Ver carrinho">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#F97316" }}>
              <ShoppingCart size={16} className="text-white" />
            </div>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-xs font-black w-4 h-4 rounded-full flex items-center justify-center" style={{ color: "#27408A" }}>
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto pb-32">

        {/* HERO IMAGE */}
        <div className="relative overflow-hidden" style={{ background: "#27408A", height: "clamp(260px, 55vw, 380px)" }}>
          <img
            src={product.image.replace("w=400&h=400", "w=800&h=600")}
            alt={product.name}
            className="w-full h-full object-cover"
            style={{ opacity: 0.92 }}
          />
          {/* gradient bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-24" style={{ background: "linear-gradient(to top, #FFF8F0, transparent)" }} />
          {/* category badge */}
          <span className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-black text-white" style={{ background: "rgba(39,64,138,0.85)", backdropFilter: "blur(8px)" }}>
            {product.category}
          </span>
        </div>

        {/* PRODUCT INFO */}
        <div className="px-4 -mt-4 space-y-5">
          {/* Name + brand + stars */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#7982A8" }}>{product.brand}</p>
            <h1 className="font-black text-2xl leading-tight mb-2" style={{ fontFamily: "'Baloo 2', cursive", color: "#27408A" }}>
              {product.name}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <Stars count={product.stars} size={14} />
              <StockBadge stock={product.stock} />
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-sm leading-relaxed" style={{ color: "#6B5E4A" }}>
              {product.description}
            </p>
          )}

          {/* Unit / min qty */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(121,130,168,0.1)" }}>
              <Package size={14} style={{ color: "#7982A8" }} />
              <span className="font-semibold" style={{ color: "#27408A" }}>{product.unit}</span>
            </div>
            {product.minQty > 1 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(249,115,22,0.08)" }}>
                <Truck size={14} style={{ color: "#F97316" }} />
                <span className="font-semibold text-xs" style={{ color: "#F97316" }}>Mínimo {product.minQty} unidades</span>
              </div>
            )}
          </div>

          {/* Flavors */}
          {product.flavors && product.flavors.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: "#27408A" }}>
                Escolha o sabor:
              </p>
              <div className="flex flex-wrap gap-2">
                {product.flavors.map((flavor) => (
                  <button
                    key={flavor}
                    onClick={() => setSelectedFlavor(flavor)}
                    className="px-3 py-1.5 rounded-full text-sm font-bold transition-all"
                    style={selectedFlavor === flavor
                      ? { background: "#27408A", color: "#fff", boxShadow: "0 2px 8px rgba(39,64,138,0.3)" }
                      : { background: "rgba(121,130,168,0.12)", color: "#27408A", border: "1.5px solid rgba(121,130,168,0.25)" }}>
                    {flavor}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 border border-border">
            <div>
              <p className="text-sm font-bold text-primary">Quantidade no carrinho</p>
              {flavor && <p className="text-xs text-muted-foreground">Sabor: {flavor}</p>}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => updateQty(currentKey, -1)} disabled={!inCart}
                aria-label="Diminuir quantidade" className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center disabled:opacity-40">
                <Minus size={16} />
              </button>
              <span aria-live="polite" className="min-w-8 text-center font-black text-primary">{inCart?.qty ?? 0}</span>
              <button type="button" onClick={increaseQuantity} disabled={atStockLimit}
                aria-label="Aumentar quantidade" className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-40">
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* No-price note */}
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm" style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)" }}>
            <WaIcon size={16} />
            <span style={{ color: "#15803d" }} className="font-semibold">Preço negociado diretamente pelo WhatsApp com o fornecedor</span>
          </div>
        </div>

        {/* RELATED */}
        {related.length > 0 && (
          <div className="px-4 mt-8">
            <p className="font-black text-base mb-4" style={{ fontFamily: "'Baloo 2', cursive", color: "#27408A" }}>
              Você também pode gostar de:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {related.map((rel) => (
                <Link key={rel.id} to={`/product/${rel.id}`}
                  className="bg-white rounded-2xl overflow-hidden border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  style={{ borderColor: "rgba(121,130,168,0.15)" }}>
                  <img src={rel.image} alt={rel.name} className="w-full h-28 object-cover" />
                  <div className="p-2.5">
                    <p className="text-xs text-gray-400 font-semibold">{rel.brand}</p>
                    <p className="text-xs font-bold leading-tight mt-0.5 line-clamp-2" style={{ color: "#27408A" }}>{rel.name}</p>
                    <p className="text-[10px] mt-1" style={{ color: "#7982A8" }}>{rel.unit}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STICKY ADD TO CART */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-5 pt-3"
        style={{ background: "linear-gradient(to top, #FFF8F0 70%, transparent)" }}>
        <div className="max-w-2xl mx-auto">
          {inCart ? (
            <div className="flex gap-3">
              <Link to="/"
                className="flex-1 py-4 rounded-full text-sm font-black text-center border-2 transition-all"
                style={{ borderColor: "#27408A", color: "#27408A" }}>
                ← Voltar à loja
              </Link>
              <button
                onClick={handleAddToCart}
                disabled={atStockLimit}
                className="flex-1 py-4 rounded-full text-white font-black flex items-center justify-center gap-2 shadow-lg"
                style={{ background: "#27408A" }}>
                <ShoppingCart size={18} /> Adicionar mais
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={atStockLimit}
              className="w-full py-4 rounded-full text-white font-black flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[.98]"
              style={product.stock === 0
                ? { background: "#ccc", cursor: "not-allowed" }
                : { background: "#27408A", boxShadow: "0 6px 24px rgba(39,64,138,0.35)" }}>
              <ShoppingCart size={20} />
              {product.stock === 0 ? "Sem estoque" : "Adicionar ao carrinho"}
            </button>
          )}
        </div>
      </div>

      {/* UPSELL MODAL */}
      {showUpsell && (
        <UpsellModal
          product={product}
          suggestions={upsellProducts}
          onClose={() => setShowUpsell(false)}
          onGoToCart={() => { setShowUpsell(false); setCartOpen(true); }}
        />
      )}
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />}
      {checkoutOpen && <CheckoutModal form={checkoutForm} onClose={() => setCheckoutOpen(false)} />}
    </div>
  );
}
