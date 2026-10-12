import { prisma } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/errors.js";
import type { CreateCustomerInput, ListCustomersQuery, UpdateCustomerInput } from "./customers.schema.js";

export const customerSelect = {
  id: true,
  code: true,
  type: true,
  name: true,
  tradeName: true,
  responsibleName: true,
  document: true,
  phone: true,
  email: true,
  notes: true,
  active: true,
  zip: true,
  street: true,
  streetNumber: true,
  complement: true,
  neighborhood: true,
  city: true,
  state: true,
  createdAt: true,
} satisfies Prisma.CustomerSelect;

export type CustomerRow = Prisma.CustomerGetPayload<{ select: typeof customerSelect }>;

export function findById(id: number) {
  return prisma.customer.findUnique({ where: { id }, select: customerSelect });
}

export function findByDocument(document: string) {
  return prisma.customer.findUnique({ where: { document }, select: customerSelect });
}

export async function listPage(query: ListCustomersQuery) {
  const { page, limit, q, type, active } = query;
  const digitsOnly = q?.replace(/\D/g, "") ?? "";

  const where: Prisma.CustomerWhereInput = {
    ...(type ? { type } : {}),
    ...(active === undefined ? {} : { active }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { tradeName: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
            ...(digitsOnly ? [{ document: { startsWith: digitsOnly } }, { phone: { contains: digitsOnly } }] : []),
          ],
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: customerSelect,
    }),
  ]);
  return { total, rows };
}

// `code` é gerado pelo trigger customer_code quando vem vazio.
export function create(input: CreateCustomerInput) {
  return prisma.customer.create({ data: { ...input, code: "" }, select: customerSelect });
}

export async function update(id: number, input: UpdateCustomerInput) {
  return prisma.$transaction(async tx => {
    const account = await tx.customerAccount.findUnique({where:{customerId:id}});
    if (account) {
      await tx.$queryRaw`SELECT id FROM public.customer_accounts WHERE id = ${account.id} FOR UPDATE`;
      const current = await tx.customer.findUniqueOrThrow({where:{id}});
      if ((input.email !== undefined && input.email?.trim().toLowerCase() !== current.email?.trim().toLowerCase()) ||
          (input.type !== undefined && input.type !== current.type) ||
          (current.type === "PJ" && input.document !== undefined && input.document !== current.document)) {
        throw new AppError(409,"ACCOUNT_IDENTITY","Cliente com conta no site: a troca de e-mail deve ser verificada pela própria conta. Tipo e CNPJ não podem ser alterados aqui.");
      }
    }
    return tx.customer.update({where:{id},data:input,select:customerSelect});
  });
}

export interface CustomerStatsRow {
  customerId: number;
  totalBought: string;
  pending: string;
  deliveredCount: number;
  salesCount: number;
  lastPurchase: string | null;
}

// Estatísticas a partir de v_sales_summary (regras do banco: pendente = pending_amount).
export async function statsFor(ids: number[]): Promise<Map<number, CustomerStatsRow & { topProduct: string | null }>> {
  const result = new Map<number, CustomerStatsRow & { topProduct: string | null }>();
  if (ids.length === 0) return result;

  const rows = await prisma.$queryRaw<
    {
      customer_id: number;
      total_bought: string;
      pending: string;
      delivered_count: number;
      sales_count: number;
      last_purchase: string | null;
    }[]
  >`
    SELECT customer_id,
           coalesce(sum(total) FILTER (WHERE status = 'DELIVERED'), 0)::numeric(12,2)::text AS total_bought,
           coalesce(sum(pending_amount), 0)::numeric(12,2)::text AS pending,
           (count(*) FILTER (WHERE status = 'DELIVERED'))::int AS delivered_count,
           (count(*) FILTER (WHERE status <> 'CANCELED'))::int AS sales_count,
           to_char(max(sale_date) FILTER (WHERE status = 'DELIVERED'), 'YYYY-MM-DD') AS last_purchase
    FROM public.v_sales_summary
    WHERE customer_id IN (${Prisma.join(ids)})
    GROUP BY customer_id`;

  const tops = await prisma.$queryRaw<{ customer_id: number; product_name: string; qty: string }[]>`
    SELECT s.customer_id, i.product_name, sum(i.quantity)::text AS qty
    FROM public.sale_items i JOIN public.sales s ON s.id = i.sale_id
    WHERE s.status = 'DELIVERED' AND s.customer_id IN (${Prisma.join(ids)})
    GROUP BY s.customer_id, i.product_name`;

  const best = new Map<number, { name: string; qty: number }>();
  for (const row of tops) {
    const qty = Number(row.qty);
    const current = best.get(row.customer_id);
    if (!current || qty > current.qty) best.set(row.customer_id, { name: row.product_name, qty });
  }

  for (const id of ids) {
    const row = rows.find((candidate) => candidate.customer_id === id);
    result.set(id, {
      customerId: id,
      totalBought: row?.total_bought ?? "0.00",
      pending: row?.pending ?? "0.00",
      deliveredCount: row?.delivered_count ?? 0,
      salesCount: row?.sales_count ?? 0,
      lastPurchase: row?.last_purchase ?? null,
      topProduct: best.get(id)?.name ?? null,
    });
  }
  return result;
}

export function salesHistory(customerId: number) {
  return prisma.sale.findMany({
    where: { customerId },
    orderBy: [{ saleDate: "desc" }, { id: "desc" }],
    select: {
      id: true,
      code: true,
      saleDate: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      subtotal: true,
      discount: true,
      deliveryFee: true,
      total: true,
      paidAmount: true,
      notes: true,
      items: {
        orderBy: { id: "asc" },
        select: { productName: true, flavorName: true, quantity: true, unitPrice: true, subtotal: true },
      },
    },
  });
}
