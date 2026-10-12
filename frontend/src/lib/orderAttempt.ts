interface Item { productId: number; flavors: { flavor: string | null; quantity: number }[] }
const generationKey = "dmais_checkout_generation";
export function checkoutGeneration(storage: Pick<Storage, "getItem">) {
  return storage.getItem(generationKey) ?? "initial";
}

// The lock spans the request, so completion invalidates already-open checkouts.
export async function exclusiveCheckout<T>(
  locks: Pick<LockManager, "request"> | undefined,
  storage: Pick<Storage, "getItem" | "setItem">,
  generation: string,
  operation: () => Promise<T>,
  newId: () => string,
): Promise<T> {
  if (!locks) throw new Error("Atualize seu navegador e acesse o site por HTTPS para finalizar o pedido com segurança.");
  return locks.request("dmais_checkout", async () => {
    if (checkoutGeneration(storage) !== generation) {
      throw new Error("Este carrinho já foi finalizado em outra aba. Atualize a página antes de fazer um novo pedido.");
    }
    const result = await operation();
    storage.setItem(generationKey, newId());
    return result;
  });
}
export function orderAttemptKey(customerId: number, items: Item[]) {
  return JSON.stringify({ customerId, items: [...items].sort((a,b) => a.productId-b.productId).map(i => ({...i, flavors: [...i.flavors].sort((a,b) => (a.flavor || "").localeCompare(b.flavor || ""))})) });
}
export function getOrderAttempt(storage: Pick<Storage, "getItem" | "setItem">, key: string, newId: () => string) {
  const storageKey = "dmais_order_attempt_" + encodeURIComponent(key);
  let requestId: string | undefined;
  try { const saved = JSON.parse(storage.getItem(storageKey) || "null"); if (saved?.key === key && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved.requestId)) requestId = saved.requestId; } catch {}
  requestId ??= newId();
  storage.setItem(storageKey, JSON.stringify({key, requestId}));
  return {requestId, storageKey};
}
