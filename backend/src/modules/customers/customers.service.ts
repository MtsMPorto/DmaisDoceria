import { AppError } from "../../shared/utils/errors.js";
import { money } from "../../shared/utils/money.js";
import * as repository from "./customers.repository.js";
import type { CustomerRow } from "./customers.repository.js";
import {
  documentProblem,
  type CreateCustomerInput,
  type ListCustomersQuery,
  type UpdateCustomerInput,
} from "./customers.schema.js";

const notFound = () => new AppError(404, "CUSTOMER_NOT_FOUND", "Cliente não encontrado.");

function withStats(row: CustomerRow, stats: Awaited<ReturnType<typeof repository.statsFor>> extends Map<number, infer S> ? S | undefined : never) {
  return {
    ...row,
    document: row.type === "PF" ? null : row.document,
    stats: {
      // "Total comprado" = total COM frete das vendas entregues.
      totalBoughtWithDelivery: stats?.totalBought ?? "0.00",
      pendingAmount: stats?.pending ?? "0.00",
      deliveredCount: stats?.deliveredCount ?? 0,
      salesCount: stats?.salesCount ?? 0,
      topProduct: stats?.topProduct ?? null,
      lastPurchase: stats?.lastPurchase ?? null,
    },
  };
}

export async function list(query: ListCustomersQuery) {
  const { total, rows } = await repository.listPage(query);
  const stats = await repository.statsFor(rows.map((row) => row.id));
  return {
    items: rows.map((row) => withStats(row, stats.get(row.id))),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function get(id: number) {
  const row = await repository.findById(id);
  if (!row) throw notFound();
  const stats = await repository.statsFor([id]);
  return withStats(row, stats.get(id));
}

export async function history(id: number) {
  if (!(await repository.findById(id))) throw notFound();
  const sales = await repository.salesHistory(id);
  return sales.map((sale) => ({
    id: sale.id,
    code: sale.code,
    saleDate: sale.saleDate.toISOString().slice(0, 10),
    status: sale.status,
    paymentStatus: sale.paymentStatus,
    paymentMethod: sale.paymentMethod,
    subtotal: money(sale.subtotal),
    discount: money(sale.discount),
    deliveryFee: money(sale.deliveryFee),
    total: money(sale.total),
    paidAmount: money(sale.paidAmount),
    notes: sale.notes,
    items: sale.items.map((item) => ({
      productName: item.productName,
      flavorName: item.flavorName,
      quantity: item.quantity.toString(),
      unitPrice: money(item.unitPrice),
      subtotal: money(item.subtotal),
    })),
  }));
}

export async function create(input: CreateCustomerInput) {
  const row = await repository.create(input);
  return withStats(row, undefined);
}

export async function update(id: number, input: UpdateCustomerInput) {
  const current = await repository.findById(id);
  if (!current) throw notFound();

  const type = input.type ?? current.type;
  // Não coletar novos CPFs; não apagar silenciosamente documentos históricos
  // ao salvar um formulário que deixou de ter esse campo.
  if (type === "PF") {
    if (input.document) throw new AppError(422, "INVALID_DOCUMENT", "Pessoa física não deve informar documento.");
    input = { ...input, document: undefined };
  }
  const document = input.document === undefined ? current.document : input.document;
  if (type === "PJ" && (input.type !== undefined || input.document !== undefined)) {
    const problem = documentProblem(type, document);
    if (problem) throw new AppError(422, "INVALID_DOCUMENT", problem);
  }

  const row = await repository.update(id, input);
  const stats = await repository.statsFor([id]);
  return withStats(row, stats.get(id));
}
