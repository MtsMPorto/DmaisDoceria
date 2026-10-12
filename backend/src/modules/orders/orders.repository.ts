import { prisma } from "../../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { CatalogProduct, OrderLine, OrderStatusValue } from "./orders.rules.js";
import type { CreateOrderInput } from "./orders.schema.js";

// Recibo com os dados OFICIAIS dos itens: o banco sobrescreve nome, marca, descrição, unidade e
// preço pelos do catálogo, então o recibo é sempre lido de volta depois da gravação.
const receiptSelect = {
  id: true,
  status: true,
  createdAt: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      productId: true,
      productName: true,
      brand: true,
      description: true,
      unit: true,
      unitPrice: true,
      totalQuantity: true,
      flavors: { orderBy: { id: "asc" }, select: { flavorName: true, quantity: true } },
    },
  },
} satisfies Prisma.OrderSelect;

export type OrderReceipt = Prisma.OrderGetPayload<{ select: typeof receiptSelect }>;

export interface OrderFilters {
  status?: OrderStatusValue;
  createdFrom?: Date;
  createdTo?: Date;
  customerName?: string;
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

export function findReceiptByRequestId(requestId: string, customerId: number): Promise<OrderReceipt | null> {
  return prisma.order.findFirst({ where: { requestId, customerId }, select: receiptSelect });
}

export function findProductsForOrder(ids: number[]): Promise<CatalogProduct[]> {
  return prisma.product.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: {
      id: true,
      name: true,
      brand: true,
      unit: true,
      minQty: true,
      stock: true,
      active: true,
      price: true,
      flavors: { where: { active: true }, select: { id: true, name: true } },
    },
  });
}

// Pedido, itens e sabores numa única escrita aninhada (atômica). Nome, marca, descrição,
// unidade, mínimo e preço do item são gravados pelo banco a partir do catálogo; os valores
// enviados aqui não prevalecem. Não mexe em estoque.
export function createWithItems(input: {
  requestId?: string;
  customerId: number;
  customer: CreateOrderInput["customer"];
  lines: OrderLine[];
}): Promise<{ id: number }> {
  const { requestId, customer, customerId, lines } = input;

  return prisma.order.create({
    select: { id: true },
    data: {
      requestId,
      customerId,
      customerType: customer.type,
      customerName: customer.name,
      document: customer.type === "PF" ? null : customer.document,
      phone: customer.phone,
      zip: customer.zip,
      street: customer.street,
      streetNumber: customer.streetNumber,
      complement: customer.complement,
      neighborhood: customer.neighborhood,
      city: customer.city,
      state: customer.state,
      items: {
        create: lines.map((line) => ({
          productId: line.product.id,
          productName: line.product.name,
          brand: line.product.brand,
          unit: line.product.unit,
          minQty: line.product.minQty,
          unitPrice: line.product.price.toString(),
          totalQuantity: line.totalQuantity,
          flavors: {
            create: line.flavors.map((entry) => ({
              flavorId: entry.flavor?.id,
              flavorName: entry.flavor?.name ?? null,
              quantity: entry.quantity,
            })),
          },
        })),
      },
    },
  });
}

export function findReceiptById(id: number): Promise<OrderReceipt | null> {
  return prisma.order.findUnique({ where: { id }, select: receiptSelect });
}

export async function listPage(filters: OrderFilters, skip: number, take: number) {
  const where: Prisma.OrderWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    // A solicitação só está pendente enquanto a venda não foi concluída/cancelada.
    // Considerar a venda também cobre registros antigos com status desatualizado.
    ...(filters.status === "REQUESTED" ? {
      OR: [{ sale: { is: null } }, { sale: { is: { status: "DRAFT" } } }],
    } : {}),
    ...(filters.createdFrom || filters.createdTo
      ? {
          createdAt: {
            ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
            ...(filters.createdTo ? { lte: filters.createdTo } : {}),
          },
        }
      : {}),
    ...(filters.customerName
      ? { customerName: { contains: filters.customerName, mode: "insensitive" } }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      select: {
        id: true,
        status: true,
        createdAt: true,
        customerName: true,
        city: true,
        items: { select: { totalQuantity: true } },
        sale: { select: { id: true, code: true, status: true } },
      },
    }),
  ]);

  return { total, rows };
}

export function findDetailsById(id: number) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      sale: { select: { id: true, code: true, status: true } },
      items: {
        orderBy: { id: "asc" },
        include: { flavors: { orderBy: { id: "asc" } } },
      },
    },
  });
}

export function findStatusById(id: number): Promise<{ status: OrderStatusValue } | null> {
  return prisma.order.findUnique({ where: { id }, select: { status: true } });
}

// Só atualiza se o status ainda for o esperado (evita corrida entre dois admins).
export async function updateStatusIfCurrent(
  id: number,
  from: OrderStatusValue,
  to: OrderStatusValue,
): Promise<number> {
  const { count } = await prisma.order.updateMany({
    where: { id, status: from },
    data: { status: to },
  });
  return count;
}

export function findStatusSnapshot(id: number) {
  return prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true, updatedAt: true },
  });
}
