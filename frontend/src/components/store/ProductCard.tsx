import type { ReactNode } from "react";
import { Link } from "react-router";
import { Minus, Plus } from "lucide-react";
import { LOW_STOCK_THRESHOLD } from "@/config/constants";
import { useCart } from "@/contexts/CartContext";
import { Stars } from "@/components/ui/Stars";
import type { Product } from "@/types";

export function ProductCard({
  product,
  onOpenFlavorModal,
  badge,
  compact = false,
}: {
  product: Product;
  onOpenFlavorModal?: () => void;
  badge?: ReactNode;
  compact?: boolean;
}) {
  const { cart: cartItems, addToCart, updateQty, cartKey } = useCart();
  const hasFlavors = !!product.flavors?.length;
  const cKey = `${product.id}::`;
  const inCart = !hasFlavors ? cartItems.find((i) => cartKey(i) === `${product.id}::`) : undefined;
  const anyInCart = cartItems.filter((i) => i.id === product.id);
  const totalInCart = anyInCart.reduce((s, i) => s + i.qty, 0);
  const lowStock = product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;

  const imgH = compact ? "h-36" : "h-44";
  const pad  = compact ? "p-2.5" : "p-3";

  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all group flex flex-col">
      <Link to={`/product/${product.id}`} className={`relative overflow-hidden bg-secondary ${imgH} flex-shrink-0 block`}>
        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <span className="absolute top-2 left-2 bg-primary/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">{product.category}</span>
        {hasFlavors && <span className="absolute top-2 right-2 bg-accent text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{product.flavors!.length} sabores</span>}
        {lowStock && <span className="absolute bottom-2 right-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">Últimas!</span>}
        {badge && <div className="absolute bottom-2 left-2">{badge}</div>}
      </Link>
      <div className={`${pad} flex flex-col flex-1`}>
        <p className="text-[10px] text-muted-foreground font-semibold">{product.brand}</p>
        <Link to={`/product/${product.id}`}>
          <h3 className="text-primary font-bold text-xs leading-tight mt-0.5 line-clamp-2 hover:underline">{product.name}</h3>
        </Link>
        <p className="text-[10px] text-muted-foreground mt-0.5">{product.unit}</p>
        <div className="mt-1"><Stars count={product.stars} size={10} /></div>

        <div className="flex items-center justify-between mt-2 pt-1.5">
          <div>
            {product.minQty > 1 && <p className="text-[10px] text-muted-foreground">mín. {product.minQty}</p>}
          </div>

          {hasFlavors ? (
            <button
              onClick={onOpenFlavorModal}
              className="active:scale-95 text-white text-[10px] font-bold px-2.5 py-1 rounded-full transition-all flex items-center gap-1"
              style={{ background: totalInCart > 0 ? "#27408A" : "#F97316" }}>
              {totalInCart > 0 ? `🍫 ${totalInCart} un · Editar` : "Escolher Sabor"}
            </button>
          ) : inCart ? (
            <div className="flex items-center gap-1">
              <button onClick={() => updateQty(cKey, -1)} className="w-6 h-6 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors">
                <Minus size={10} className="text-primary" />
              </button>
              <span className="text-primary font-black text-xs w-4 text-center">{inCart.qty}</span>
              <button onClick={() => updateQty(cKey, 1)} className="w-6 h-6 rounded-full bg-accent hover:bg-orange-500 flex items-center justify-center transition-colors">
                <Plus size={10} className="text-white" />
              </button>
            </div>
          ) : (
            <button onClick={() => addToCart(product)}
              className="bg-accent hover:bg-orange-500 active:scale-95 text-white text-[10px] font-bold px-2.5 py-1 rounded-full transition-all">
              + Adicionar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
