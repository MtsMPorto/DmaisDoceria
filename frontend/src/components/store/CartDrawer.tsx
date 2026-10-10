import { Link } from "react-router";
import { ShoppingCart, X, Plus, Minus, Trash2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { aboveStock, belowMinimum } from "@/lib/cart";
import { WaIcon } from "@/components/ui/WaIcon";

export function CartDrawer({ onClose, onCheckout }: { onClose: () => void; onCheckout: () => void }) {
  const { cart, updateQty, removeItem, cartKey } = useCart();
  const tooLow = belowMinimum(cart);
  const overStock = aboveStock(cart);

  return (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onClose()} />
          <div className="relative ml-auto w-full max-w-md bg-background h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-primary flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-accent" />
                <h2 className="text-white font-black text-lg" style={{ fontFamily: "'Baloo 2', cursive" }}>Seu Carrinho</h2>
              </div>
              <button onClick={() => onClose()} className="text-white/60 hover:text-white transition-colors"><X size={22} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-5xl mb-3">🛒</p>
                  <p className="font-bold">Carrinho vazio</p>
                  <p className="text-sm">Adicione produtos para continuar</p>
                </div>
              ) : (
                cart.map((item) => {
                  const iKey = cartKey(item);
                  return (
                    <div key={iKey} className="bg-card rounded-xl p-3 flex gap-3 border border-border shadow-sm">
                      <Link to={`/product/${item.id}`} onClick={() => onClose()} className="flex-shrink-0">
                        <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover bg-secondary" />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground font-semibold">{item.brand}</p>
                        <p className="text-primary font-bold text-sm leading-tight truncate">{item.name}</p>
                        {item.selectedFlavor && <p className="text-accent text-xs font-bold mt-0.5">🍫 {item.selectedFlavor}</p>}
                        <p className="text-xs text-muted-foreground">{item.unit}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => updateQty(iKey, -1)} className="w-6 h-6 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center"><Minus size={11} className="text-primary" /></button>
                            <span className="text-primary font-black text-sm w-5 text-center">{item.qty}</span>
                            <button onClick={() => updateQty(iKey, 1)} className="w-6 h-6 rounded-full bg-accent hover:bg-orange-500 flex items-center justify-center"><Plus size={11} className="text-white" /></button>
                            <button onClick={() => removeItem(iKey)} className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center ml-1"><Trash2 size={11} className="text-red-500" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {cart.length > 0 && (
              <div className="px-4 py-4 border-t border-border bg-card flex-shrink-0 space-y-2">
                {tooLow.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                    {tooLow.map((item) => (
                      <p key={item.productId}><strong>{item.name}</strong>: mínimo de {item.minQty} (você tem {item.qty}).</p>
                    ))}
                  </div>
                )}
                {overStock.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                    {overStock.map((item) => (
                      <p key={item.productId}>Aviso: {item.name} tem só {item.stock} em estoque.</p>
                    ))}
                  </div>
                )}
                <button onClick={onCheckout} disabled={tooLow.length > 0}
                  className="w-full bg-[#25D366] hover:bg-[#1ebe5a] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98] text-white font-black py-3.5 rounded-full text-base flex items-center justify-center gap-2 shadow-lg transition-all">
                  <WaIcon /> Finalizar pelo WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
  );
}
