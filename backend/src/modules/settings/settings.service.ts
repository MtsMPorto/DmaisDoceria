import * as repository from "./settings.repository.js";

// Lista fixa: só estas chaves saem na rota pública.
const PUBLIC_KEYS = ["whatsapp_number", "company_name"] as const;
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

async function readMap(keys: readonly string[]): Promise<Map<string, string>> {
  const rows = await repository.findByKeys([...keys]);
  return new Map(rows.map((row) => [row.key, row.value]));
}

export async function getPublicSettings() {
  const map = await readMap(PUBLIC_KEYS);
  return {
    whatsappNumber: map.get("whatsapp_number") ?? null,
    companyName: map.get("company_name") ?? null,
  };
}

export async function getAdminSettings() {
  const map = await readMap([...PUBLIC_KEYS, "low_stock_threshold"]);
  const threshold = Number(map.get("low_stock_threshold"));
  return {
    whatsappNumber: map.get("whatsapp_number") ?? null,
    companyName: map.get("company_name") ?? null,
    lowStockThreshold:
      Number.isInteger(threshold) && threshold >= 0 ? threshold : DEFAULT_LOW_STOCK_THRESHOLD,
  };
}
