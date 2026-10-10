import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/errors.js";
import { money } from "../../shared/utils/money.js";
import * as repository from "./sales.repository.js";
import { assertDiscountFits, brl, lineSubtotal, pendingOf, resolvePayment } from "./sales.rules.js";
import type { SaleRow } from "./sales.repository.js";
import type {
  CreateItemInput,
  CreateSaleInput,
  ListSalesQuery,
  UpdateItemInput,
  UpdateSaleInput,
} from "./sales.schema.js";

const Decimal = Prisma.Decimal;

const notFound = () => new AppError(404, "SALE_NOT_FOUND", "Venda não encontrada.");

export function toSaleDetail(sale: SaleRow) {
  return {
    id: sale.id,
    code: sale.code,
    status: sale.status,
    saleDate: sale.saleDate.toISOString().slice(0, 10),
    customerId: sale.customerId,
    orderId: sale.orderId,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerDocument: sale.customerDocument,
    deliveryAddress: sale.deliveryAddress,
    subtotal: money(sale.subtotal),
    discount: money(sale.discount),
    deliveryFee: money(sale.deliveryFee),
    total: money(sale.total),
    paymentMethod: sale.paymentMethod,
    paymentStatus: sale.paymentStatus,
    paidAmount: money(sale.paidAmount),
    pendingAmount: money(pendingOf(sale.status, sale.total, sale.paidAmount)),
    notes: sale.notes,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      flavorId: item.flavorId,
      productName: item.productName,
      brand: item.brand,
      unit: item.unit,
      description: item.description,
      flavorName: item.flavorName,
      notes: item.notes,
      quantity: item.quantity.toString(),
      unitPrice: money(item.unitPrice),
      unitCost: money(item.unitCost),
      subtotal: money(item.subtotal),
    })),
  };
}

async function requireSale(id: number) {
  const sale = await repository.findById(id);
  if (!sale) throw notFound();
  return sale;
}

export async function get(id: number) {
  return toSaleDetail(await requireSale(id));
}

export async function list(query: ListSalesQuery) {
  const { total, rows } = await repository.listPage(query);
  return {
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      status: row.status,
      saleDate: row.saleDate.toISOString().slice(0, 10),
      customerId: row.customerId,
      customerName: row.customerName,
      total: money(row.total),
      paymentStatus: row.paymentStatus,
      paidAmount: money(row.paidAmount),
      pendingAmount: money(pendingOf(row.status, row.total, row.paidAmount)),
      itemCount: row._count.items,
    })),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function create(adminId: number, input: CreateSaleInput) {
  const created = await repository.createDraft({ ...input, createdById: adminId });
  return get(created.id);
}

export async function createFromOrder(adminId: number, orderId: number) {
  const order = await repository.findOrderForSale(orderId);
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
  if (order.status === "CANCELED") {
    throw new AppError(409, "ORDER_CANCELED", "Pedido cancelado não vira venda.");
  }
  if (order.sale) {
    throw new AppError(409, "ORDER_ALREADY_HAS_SALE", `Este pedido já tem a venda ${order.sale.code}.`, {
      saleId: order.sale.id,
    });
  }

  const result = await repository.createSaleFromOrder(adminId, order);
  if ("conflict" in result) {
    if (result.conflict === "TYPE_MISMATCH") {
      throw new AppError(
        409,
        "CUSTOMER_TYPE_MISMATCH",
        "Já existe um cliente com este documento, mas com tipo (PF/PJ) diferente do pedido.",
      );
    }
    throw new AppError(409, "CUSTOMER_INACTIVE", "O cliente deste pedido está inativo. Reative-o antes de criar a venda.");
  }
  return get(result.saleId);
}

export async function update(id: number, input: UpdateSaleInput) {
  const sale = await requireSale(id);

  if (sale.status === "CANCELED") {
    throw new AppError(409, "SALE_CANCELED", "Venda cancelada não pode ser alterada.");
  }
  const touchesDraftOnly =
    input.saleDate !== undefined || input.discount !== undefined || input.deliveryFee !== undefined;
  if (sale.status !== "DRAFT" && touchesDraftOnly) {
    throw new AppError(
      409,
      "SALE_NOT_DRAFT",
      "Venda confirmada: só pagamento e observações podem mudar. Cancele e refaça para corrigir itens ou valores.",
    );
  }

  const discount = new Decimal(input.discount ?? sale.discount.toFixed(2));
  const deliveryFee = new Decimal(input.deliveryFee ?? sale.deliveryFee.toFixed(2));
  assertDiscountFits(discount, sale.subtotal, "update");
  const total = sale.subtotal.minus(discount).plus(deliveryFee);

  const paymentTouched =
    input.paymentStatus !== undefined ||
    input.paidAmount !== undefined ||
    // mudou o total: o valor recebido precisa continuar coerente
    !total.equals(sale.total);
  const payment = paymentTouched ? resolvePayment(input, sale, total) : null;

  await repository.updateSale(id, {
    ...(input.saleDate === undefined ? {} : { saleDate: new Date(`${input.saleDate}T00:00:00.000Z`) }),
    ...(input.discount === undefined ? {} : { discount: discount.toFixed(2) }),
    ...(input.deliveryFee === undefined ? {} : { deliveryFee: deliveryFee.toFixed(2) }),
    ...(input.paymentMethod === undefined ? {} : { paymentMethod: input.paymentMethod }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(payment ? { paymentStatus: payment.paymentStatus, paidAmount: payment.paidAmount.toFixed(2) } : {}),
  });
  return get(id);
}

export async function confirm(id: number) {
  await requireSale(id);
  await repository.confirmSale(id);
  return get(id);
}

export async function cancel(id: number) {
  const sale = await requireSale(id);
  if (sale.status === "DELIVERED") {
    throw new AppError(
      409,
      "SALE_DELIVERED",
      "Venda entregue não pode ser cancelada. Devolução e reembolso são tratados à parte.",
    );
  }
  await repository.cancelSale(id);
  return get(id);
}

export async function deliver(id: number) {
  const sale = await requireSale(id);
  if (sale.status !== "CONFIRMED") {
    throw new AppError(409, "SALE_NOT_CONFIRMED", "Só uma venda confirmada pode ser marcada como entregue.");
  }
  if ((await repository.markDelivered(id)) === 0) {
    throw new AppError(409, "SALE_NOT_CONFIRMED", "A venda mudou de situação. Atualize a tela.");
  }
  return get(id);
}

// ---------------------------------------------------------------- itens (somente em DRAFT)

function assertEditable(sale: SaleRow) {
  if (sale.status !== "DRAFT") {
    throw new AppError(409, "SALE_NOT_DRAFT", "Itens só podem ser alterados em rascunho.");
  }
  if (sale.paymentStatus !== "PENDING") {
    throw new AppError(
      409,
      "PAYMENT_NOT_PENDING",
      "Volte o pagamento para pendente antes de alterar os itens (o total muda).",
    );
  }
}

async function checkProductItem(productId: number, flavorId: number | null | undefined, quantity: string) {
  const product = await repository.findProductForItem(productId);
  if (!product || !product.active || product.deletedAt !== null) {
    throw new AppError(422, "PRODUCT_UNAVAILABLE", "Produto indisponível.");
  }
  if (!Number.isInteger(Number(quantity))) {
    throw new AppError(422, "QUANTITY_INVALID", "Produto do catálogo só aceita quantidade inteira.");
  }
  const flavorIds = product.flavors.map((flavor) => flavor.id);
  if (flavorIds.length > 0 && !flavorId) {
    throw new AppError(422, "FLAVOR_REQUIRED", "Escolha o sabor deste produto.");
  }
  if (flavorId && !flavorIds.includes(flavorId)) {
    throw new AppError(422, "FLAVOR_INVALID", "Sabor inválido para este produto.");
  }
  return product;
}

export async function addItem(saleId: number, input: CreateItemInput) {
  const sale = await requireSale(saleId);
  assertEditable(sale);

  let productId: number | null = null;
  let productName = input.productName ?? "";
  let unitPrice = input.unitPrice;
  const flavorId = input.flavorId ?? null;

  if (input.productId !== undefined) {
    const product = await checkProductItem(input.productId, flavorId, input.quantity);
    productId = product.id;
    productName = "(produto)"; // o trigger grava o nome oficial
    unitPrice = unitPrice ?? product.price.toFixed(2);
  }

  await repository.createItem(saleId, {
    productId,
    flavorId,
    productName,
    quantity: input.quantity,
    unitPrice: unitPrice as string,
    notes: input.notes ?? null,
  });
  return get(saleId);
}

export async function updateItem(saleId: number, itemId: number, input: UpdateItemInput) {
  const sale = await requireSale(saleId);
  assertEditable(sale);

  const item = await repository.findItem(saleId, itemId);
  if (!item) throw new AppError(404, "ITEM_NOT_FOUND", "Item não encontrado.");

  const quantity = input.quantity ?? item.quantity.toString();
  const unitPrice = input.unitPrice ?? item.unitPrice.toFixed(2);
  const flavorId = input.flavorId === undefined ? item.flavorId : input.flavorId;

  if (item.productId !== null) {
    if (input.productName !== undefined) {
      throw new AppError(422, "ITEM_INVALID", "Item de produto não tem descrição própria.");
    }
    await checkProductItem(item.productId, flavorId, quantity);
  } else if (flavorId) {
    throw new AppError(422, "FLAVOR_INVALID", "Item avulso não tem sabor.");
  }

  const newSubtotal = sale.subtotal.minus(item.subtotal).plus(lineSubtotal(quantity, unitPrice));
  assertDiscountFits(sale.discount, newSubtotal, "item");

  await repository.updateItem(itemId, {
    quantity,
    unitPrice,
    flavorId,
    ...(input.productName === undefined ? {} : { productName: input.productName }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
  });
  return get(saleId);
}

export async function removeItem(saleId: number, itemId: number) {
  const sale = await requireSale(saleId);
  assertEditable(sale);

  const item = await repository.findItem(saleId, itemId);
  if (!item) throw new AppError(404, "ITEM_NOT_FOUND", "Item não encontrado.");

  const newSubtotal = sale.subtotal.minus(item.subtotal);
  assertDiscountFits(sale.discount, newSubtotal, "remove");

  await repository.deleteItem(itemId);
  return get(saleId);
}
