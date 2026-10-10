import { prisma } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { dateOnly } from "../../shared/utils/params.js";

// Todas as consultas são SOMENTE LEITURA. Valores monetários saem como texto (numeric(.,2)).

function productFilter(ids: number[]): Prisma.Sql {
  return ids.length > 0 ? Prisma.sql`AND i.product_id IN (${Prisma.join(ids)})` : Prisma.empty;
}

export interface KpiRow {
  saleCount: number;
  units: string;
  revenue: string;
  costComplete: boolean;
  cost: string | null;
}

// Faturamento = subtotal - desconto das vendas ENTREGUES por sale_date (sem frete). Com filtro
// de produto, o desconto é rateado entre os itens pelo peso do subtotal.
export async function kpis(from: string, to: string, productIds: number[]): Promise<KpiRow> {
  const rows = await prisma.$queryRaw<
    { sale_count: number; units: string; revenue: string; cost_complete: boolean; cost: string | null }[]
  >`
    SELECT count(DISTINCT s.id)::int AS sale_count,
           coalesce(sum(i.quantity), 0)::text AS units,
           round(coalesce(sum(i.subtotal - s.discount * i.subtotal / nullif(s.subtotal, 0)), 0), 2)::text AS revenue,
           coalesce(bool_and(i.unit_cost IS NOT NULL), true) AS cost_complete,
           round(sum(i.quantity * i.unit_cost), 2)::text AS cost
    FROM public.sales s
    JOIN public.sale_items i ON i.sale_id = s.id
    WHERE s.status = 'DELIVERED'
      AND s.sale_date BETWEEN ${from}::date AND ${to}::date
      ${productFilter(productIds)}`;

  const row = rows[0];
  return {
    saleCount: row?.sale_count ?? 0,
    units: row?.units ?? "0",
    revenue: row?.revenue ?? "0.00",
    costComplete: row?.cost_complete ?? true,
    cost: row?.cost ?? null,
  };
}

// Recebido e pendente vêm de v_sales_summary (pending_amount é regra do banco).
export async function payments(from: string, to: string): Promise<{ received: string; pending: string }> {
  const rows = await prisma.$queryRaw<{ received: string; pending: string }[]>`
    SELECT coalesce(sum(paid_amount), 0)::numeric(14,2)::text AS received,
           coalesce(sum(pending_amount), 0)::numeric(14,2)::text AS pending
    FROM public.v_sales_summary
    WHERE status IN ('CONFIRMED', 'DELIVERED')
      AND sale_date BETWEEN ${from}::date AND ${to}::date`;
  return { received: rows[0]?.received ?? "0.00", pending: rows[0]?.pending ?? "0.00" };
}

export interface SeriesRow {
  bucket: string;
  revenue: string;
  units: string;
  costComplete: boolean;
  cost: string | null;
}

export async function series(
  from: string,
  to: string,
  productIds: number[],
  monthly: boolean,
): Promise<SeriesRow[]> {
  const bucket = monthly ? Prisma.sql`to_char(s.sale_date, 'YYYY-MM')` : Prisma.sql`to_char(s.sale_date, 'YYYY-MM-DD')`;
  const rows = await prisma.$queryRaw<
    { bucket: string; revenue: string; units: string; cost_complete: boolean; cost: string | null }[]
  >`
    SELECT ${bucket} AS bucket,
           round(coalesce(sum(i.subtotal - s.discount * i.subtotal / nullif(s.subtotal, 0)), 0), 2)::text AS revenue,
           coalesce(sum(i.quantity), 0)::text AS units,
           coalesce(bool_and(i.unit_cost IS NOT NULL), true) AS cost_complete,
           round(sum(i.quantity * i.unit_cost), 2)::text AS cost
    FROM public.sales s
    JOIN public.sale_items i ON i.sale_id = s.id
    WHERE s.status = 'DELIVERED'
      AND s.sale_date BETWEEN ${from}::date AND ${to}::date
      ${productFilter(productIds)}
    GROUP BY 1
    ORDER BY 1`;
  return rows.map((row) => ({
    bucket: row.bucket,
    revenue: row.revenue,
    units: row.units,
    costComplete: row.cost_complete,
    cost: row.cost,
  }));
}

export interface RankingRow {
  productId: number | null;
  name: string;
  brand: string | null;
  qty: string;
  revenue: string;
  costComplete: boolean;
  cost: string | null;
}

export async function ranking(from: string, to: string, productIds: number[]): Promise<RankingRow[]> {
  const rows = await prisma.$queryRaw<
    {
      product_id: number | null;
      name: string;
      brand: string | null;
      qty: string;
      revenue: string;
      cost_complete: boolean;
      cost: string | null;
    }[]
  >`
    SELECT i.product_id,
           max(i.product_name) AS name,
           max(i.brand) AS brand,
           sum(i.quantity)::text AS qty,
           round(sum(i.subtotal - s.discount * i.subtotal / nullif(s.subtotal, 0)), 2)::text AS revenue,
           bool_and(i.unit_cost IS NOT NULL) AS cost_complete,
           round(sum(i.quantity * i.unit_cost), 2)::text AS cost
    FROM public.sales s
    JOIN public.sale_items i ON i.sale_id = s.id
    WHERE s.status = 'DELIVERED'
      AND s.sale_date BETWEEN ${from}::date AND ${to}::date
      ${productFilter(productIds)}
    GROUP BY i.product_id, CASE WHEN i.product_id IS NULL THEN i.product_name END
    ORDER BY sum(i.subtotal - s.discount * i.subtotal / nullif(s.subtotal, 0)) DESC NULLS LAST
    LIMIT 100`;
  return rows.map((row) => ({
    productId: row.product_id,
    name: row.name,
    brand: row.brand,
    qty: row.qty,
    revenue: row.revenue,
    costComplete: row.cost_complete,
    cost: row.cost,
  }));
}

export function salesForExport(from: string, to: string) {
  return prisma.sale.findMany({
    where: { saleDate: { gte: dateOnly(from), lte: dateOnly(to) } },
    orderBy: [{ saleDate: "asc" }, { id: "asc" }],
    select: {
      code: true,
      saleDate: true,
      customerName: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      subtotal: true,
      discount: true,
      deliveryFee: true,
      total: true,
      items: { orderBy: { id: "asc" }, select: { productName: true, flavorName: true, quantity: true } },
    },
  });
}
