interface Item { productId: number; flavors: { flavor: string | null; quantity: number }[] }
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
