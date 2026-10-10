import { Prisma } from "../../generated/prisma/client.js";
import { money } from "../../shared/utils/money.js";

// Cálculos puros dos relatórios (sem banco). Entrada: linhas já agregadas pelo SQL.

const Decimal = Prisma.Decimal;
const DAY_MS = 86_400_000;
export const DAILY_MAX_DAYS = 45;

export interface KpiInput {
  saleCount: number;
  units: string;
  revenue: string;
  costComplete: boolean;
  cost: string | null;
}

export interface SeriesInput {
  bucket: string;
  revenue: string;
  units: string;
  costComplete: boolean;
  cost: string | null;
}

export interface RankingInput {
  productId: number | null;
  name: string;
  brand: string | null;
  qty: string;
  revenue: string;
  costComplete: boolean;
  cost: string | null;
}

const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
}

// Período imediatamente anterior, com a mesma duração.
export function previousRange(from: string, to: string): { from: string; to: string } {
  const length = daysBetween(from, to);
  const prevTo = Date.parse(from) - DAY_MS;
  return { from: isoOf(prevTo - (length - 1) * DAY_MS), to: isoOf(prevTo) };
}

// Custo e lucro só existem quando TODOS os itens do período têm custo. Sem vendas, são zero.
// Nunca devolve "lucro com custo zero" quando falta custo: devolve null (indisponível).
function profitOf(revenue: Prisma.Decimal, row: { costComplete: boolean; cost: string | null }, hasSales: boolean) {
  if (!hasSales) return { cost: new Decimal(0), profit: new Decimal(0) };
  if (!row.costComplete || row.cost === null) return { cost: null, profit: null };
  const cost = new Decimal(row.cost);
  return { cost, profit: revenue.minus(cost) };
}

export function toKpis(row: KpiInput, payments: { received: string; pending: string } | null) {
  const revenue = new Decimal(row.revenue);
  const hasSales = row.saleCount > 0;
  const { cost, profit } = profitOf(revenue, row, hasSales);
  const margin = profit && revenue.gt(0) ? profit.div(revenue).mul(100) : null;

  return {
    revenue: money(revenue),
    cost: cost ? money(cost) : null,
    grossProfit: profit ? money(profit) : null,
    grossMargin: margin ? margin.toFixed(1) : null,
    // true = algum item vendido não tem custo cadastrado: custo e lucro ficam "indisponíveis".
    costIncomplete: hasSales && (!row.costComplete || row.cost === null),
    saleCount: row.saleCount,
    units: row.units,
    averageTicket: hasSales ? money(revenue.div(row.saleCount).toDecimalPlaces(2)) : null,
    received: payments ? payments.received : null,
    pending: payments ? payments.pending : null,
  };
}

export function seriesPoints(rows: SeriesInput[], from: string, to: string, monthly: boolean) {
  const byBucket = new Map(rows.map((row) => [row.bucket, row]));
  const keys: string[] = [];

  if (monthly) {
    const end = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);
    for (
      let cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
      cursor <= end;
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
    ) {
      keys.push(cursor.toISOString().slice(0, 7));
    }
  } else {
    for (let ms = Date.parse(from); ms <= Date.parse(to); ms += DAY_MS) keys.push(isoOf(ms));
  }

  return keys.map((key) => {
    const row = byBucket.get(key);
    const revenue = new Decimal(row?.revenue ?? "0");
    const { profit } = row ? profitOf(revenue, row, true) : { profit: new Decimal(0) };
    return {
      key,
      revenue: money(revenue),
      // null = lucro indisponível nesse ponto (itens sem custo); nunca lucro com custo zero.
      profit: profit ? money(profit) : null,
      units: row?.units ?? "0",
    };
  });
}

export function rankingItems(rows: RankingInput[]) {
  return rows.map((row) => {
    const revenue = new Decimal(row.revenue);
    const cost = row.costComplete && row.cost !== null ? new Decimal(row.cost) : null;
    const profit = cost ? revenue.minus(cost) : null;
    return {
      productId: row.productId,
      name: row.name,
      brand: row.brand,
      qty: row.qty,
      revenue: money(revenue),
      cost: cost ? money(cost) : null,
      grossProfit: profit ? money(profit) : null,
      grossMargin: profit && revenue.gt(0) ? profit.div(revenue).mul(100).toFixed(1) : null,
    };
  });
}

// Evita que um texto digitado pelo usuário vire fórmula ao abrir o CSV no Excel.
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
