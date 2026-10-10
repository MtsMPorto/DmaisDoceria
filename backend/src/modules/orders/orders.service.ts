import { AppError } from "../../shared/utils/errors.js";
import * as repository from "./orders.repository.js";
import type { OrderReceipt } from "./orders.repository.js";
import { money } from "../../shared/utils/money.js";
import { canTransition, checkItems, mergeItems, type CatalogProduct } from "./orders.rules.js";
import type { CreateOrderInput, ListOrdersQuery } from "./orders.schema.js";

// Formato devolvido à loja: a mensagem do WhatsApp é montada com ESTES dados, não com os do navegador.
export function toReceipt(order: OrderReceipt) {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      brand: item.brand,
      description: item.description,
      unit: item.unit,
      unitPrice: money(item.unitPrice),
      totalQuantity: item.totalQuantity,
      flavors: item.flavors.map((flavor) => ({ flavor: flavor.flavorName, quantity: flavor.quantity })),
    })),
  };
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<{ created: boolean; order: ReturnType<typeof toReceipt> }> {
  const { requestId, customer } = input;

  if (requestId) {
    const existing = await repository.findReceiptByRequestId(requestId);
    if (existing) return { created: false, order: toReceipt(existing) };
  }

  const merged = mergeItems(input.items);

  // Todos os produtos do pedido numa consulta só. Os dados do produto vêm sempre do
  // banco: nada que o cliente enviar (nome, marca, unidade, mínimo, preço) é usado.
  // O trigger order_items_prepare do banco também sobrescreve esses campos com o catálogo.
  const products = await repository.findProductsForOrder(merged.map((item) => item.productId));
  const catalog = new Map<number, CatalogProduct>(products.map((product) => [product.id, product]));

  const { problems, lines } = checkItems(merged, catalog);
  if (problems.length > 0) {
    throw new AppError(
      422,
      "ORDER_ITEMS_INVALID",
      "Alguns itens do pedido não puderam ser registrados.",
      problems,
    );
  }

  try {
    const { id } = await repository.createWithItems({ requestId, customer, lines });
    const receipt = await repository.findReceiptById(id);
    if (!receipt) throw new AppError(500, "ORDER_READ_FAILED", "Pedido registrado, mas não foi possível lê-lo.");
    return { created: true, order: toReceipt(receipt) };
  } catch (err) {
    // Duas requisições com o mesmo requestId chegando ao mesmo tempo.
    if (requestId && repository.isUniqueViolation(err)) {
      const existing = await repository.findReceiptByRequestId(requestId);
      if (existing) return { created: false, order: toReceipt(existing) };
    }
    throw err;
  }
}

function startOf(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
}

function endOf(value: string): Date {
  return new Date(value.length === 10 ? `${value}T23:59:59.999Z` : value);
}

export async function listOrders(query: ListOrdersQuery) {
  const { page, limit, status, from, to, q } = query;

  const { total, rows } = await repository.listPage(
    {
      status,
      createdFrom: from ? startOf(from) : undefined,
      createdTo: to ? endOf(to) : undefined,
      customerName: q,
    },
    (page - 1) * limit,
    limit,
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      customerName: row.customerName,
      city: row.city,
      sale: row.sale,
      totalItems: row.items.reduce((sum, item) => sum + item.totalQuantity, 0),
    })),
    page,
    limit,
    total,
  };
}

export async function getOrder(id: number) {
  const order = await repository.findDetailsById(id);
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");

  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customerId: order.customerId,
    sale: order.sale,
    customer: {
      type: order.customerType,
      name: order.customerName,
      document: order.document,
      phone: order.phone,
      zip: order.zip,
      street: order.street,
      streetNumber: order.streetNumber,
      complement: order.complement,
      neighborhood: order.neighborhood,
      city: order.city,
      state: order.state,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      brand: item.brand,
      unit: item.unit,
      minQty: item.minQty,
      unitPrice: money(item.unitPrice),
      totalQuantity: item.totalQuantity,
      flavors: item.flavors.map((flavor) => ({
        flavor: flavor.flavorName,
        quantity: flavor.quantity,
      })),
    })),
  };
}

// Mudar o status NÃO mexe em estoque e NÃO cria venda. Só REQUESTED -> CANCELED é permitido:
// a confirmação do pedido acontece no banco, ao confirmar a venda vinculada.
export async function updateOrderStatus(id: number, next: "CANCELED") {
  const current = await repository.findStatusById(id);
  if (!current) throw new AppError(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");

  const invalid = () =>
    new AppError(
      409,
      "INVALID_TRANSITION",
      `Não é possível mudar o pedido de ${current.status} para ${next}.`,
    );
  if (!canTransition(current.status, next)) throw invalid();

  const changed = await repository.updateStatusIfCurrent(id, current.status, next);
  if (changed === 0) throw invalid();

  const updated = await repository.findStatusSnapshot(id);
  if (!updated) throw new AppError(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
  return updated;
}
