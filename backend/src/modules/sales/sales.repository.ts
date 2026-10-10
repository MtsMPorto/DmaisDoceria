import { prisma } from "../../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { dateOnly } from "../../shared/utils/params.js";
import type { ListSalesQuery } from "./sales.schema.js";

export const saleSelect = {
  id: true,
  code: true,
  status: true,
  saleDate: true,
  customerId: true,
  orderId: true,
  customerName: true,
  customerPhone: true,
  customerDocument: true,
  deliveryAddress: true,
  subtotal: true,
  discount: true,
  deliveryFee: true,
  total: true,
  paymentMethod: true,
  paymentStatus: true,
  paidAmount: true,
  notes: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      productId: true,
      flavorId: true,
      productName: true,
      brand: true,
      unit: true,
      description: true,
      flavorName: true,
      notes: true,
      quantity: true,
      unitPrice: true,
      unitCost: true,
      subtotal: true,
    },
  },
} satisfies Prisma.SaleSelect;

export type SaleRow = Prisma.SaleGetPayload<{ select: typeof saleSelect }>;

export function findById(id: number) {
  return prisma.sale.findUnique({ where: { id }, select: saleSelect });
}

export async function listPage(query: ListSalesQuery) {
  const { page, limit, status, customerId, from, to, q } = query;
  const where: Prisma.SaleWhereInput = {
    ...(status ? { status } : {}),
    ...(customerId ? { customerId } : {}),
    ...(from || to
      ? { saleDate: { ...(from ? { gte: dateOnly(from) } : {}), ...(to ? { lte: dateOnly(to) } : {}) } }
      : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      orderBy: [{ saleDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        code: true,
        status: true,
        saleDate: true,
        customerId: true,
        customerName: true,
        total: true,
        paymentStatus: true,
        paidAmount: true,
        _count: { select: { items: true } },
      },
    }),
  ]);
  return { total, rows };
}

export function createDraft(data: {
  customerId: number;
  createdById: number;
  saleDate?: string;
  paymentMethod?: string | null;
  notes?: string | null;
}) {
  // code e os dados do cliente são preenchidos pelo trigger fill_customer_snapshot.
  return prisma.sale.create({
    data: {
      code: "",
      customerName: "",
      customerPhone: "",
      customerId: data.customerId,
      createdById: data.createdById,
      ...(data.saleDate ? { saleDate: dateOnly(data.saleDate) } : {}),
      ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
    select: { id: true },
  });
}

export function updateSale(id: number, data: Prisma.SaleUpdateInput) {
  return prisma.sale.update({ where: { id }, data, select: { id: true } });
}

export function findOrderForSale(orderId: number) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      customerType: true,
      customerName: true,
      document: true,
      phone: true,
      zip: true,
      street: true,
      streetNumber: true,
      complement: true,
      neighborhood: true,
      city: true,
      state: true,
      sale: { select: { id: true, code: true } },
      items: {
        orderBy: { id: "asc" },
        select: {
          productId: true,
          productName: true,
          unitPrice: true,
          totalQuantity: true,
          product: { select: { price: true } },
          flavors: { orderBy: { id: "asc" }, select: { flavorId: true, quantity: true } },
        },
      },
    },
  });
}

type OrderForSale = NonNullable<Awaited<ReturnType<typeof findOrderForSale>>>;

// Cliente (achado pelo documento ou criado com os dados do pedido) e venda em rascunho, na
// mesma transação.
export function createSaleFromOrder(adminId: number, order: OrderForSale) {
  return prisma.$transaction(async (tx) => {
    let customer = await tx.customer.findUnique({
      where: { document: order.document },
      select: { id: true, type: true, active: true },
    });

    if (customer && customer.type !== order.customerType) {
      return { conflict: "TYPE_MISMATCH" as const };
    }
    if (customer && !customer.active) {
      return { conflict: "INACTIVE" as const };
    }

    if (!customer) {
      customer = await tx.customer.create({
        data: {
          code: "",
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
        select: { id: true, type: true, active: true },
      });
    }

    const items: Prisma.SaleItemCreateWithoutSaleInput[] = [];
    for (const item of order.items) {
      const price = (item.unitPrice ?? item.product.price).toFixed(2);
      for (const flavor of item.flavors) {
        items.push({
          product: { connect: { id: item.productId } },
          ...(flavor.flavorId ? { flavor: { connect: { id: flavor.flavorId } } } : {}),
          productName: item.productName,
          quantity: String(flavor.quantity),
          unitPrice: price,
          subtotal: "0", // recalculado pelo trigger sale_items_prepare
        });
      }
    }

    const sale = await tx.sale.create({
      data: {
        code: "",
        customerName: "",
        customerPhone: "",
        customer: { connect: { id: customer.id } },
        order: { connect: { id: order.id } },
        createdBy: { connect: { id: adminId } },
        items: { create: items },
      },
      select: { id: true },
    });
    return { saleId: sale.id };
  });
}

export async function confirmSale(id: number): Promise<void> {
  await prisma.$queryRaw`SELECT id FROM public.confirm_sale(${id}::int)`;
}

export async function cancelSale(id: number): Promise<void> {
  await prisma.$queryRaw`SELECT id FROM public.cancel_sale(${id}::int)`;
}

// CONFIRMED -> DELIVERED não mexe em estoque; só vale se ainda estiver CONFIRMED.
export async function markDelivered(id: number): Promise<number> {
  const { count } = await prisma.sale.updateMany({
    where: { id, status: "CONFIRMED" },
    data: { status: "DELIVERED" },
  });
  return count;
}

export function findProductForItem(productId: number) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      active: true,
      deletedAt: true,
      price: true,
      flavors: { where: { active: true }, select: { id: true } },
    },
  });
}

export function findItem(saleId: number, itemId: number) {
  return prisma.saleItem.findFirst({
    where: { id: itemId, saleId },
    select: { id: true, productId: true, flavorId: true, quantity: true, unitPrice: true, subtotal: true },
  });
}

export function createItem(saleId: number, data: {
  productId: number | null;
  flavorId: number | null;
  productName: string;
  quantity: string;
  unitPrice: string;
  notes: string | null;
}) {
  return prisma.saleItem.create({
    data: { saleId, ...data, subtotal: "0" },
    select: { id: true },
  });
}

export function updateItem(itemId: number, data: Prisma.SaleItemUncheckedUpdateInput) {
  return prisma.saleItem.update({ where: { id: itemId }, data, select: { id: true } });
}

export function deleteItem(itemId: number) {
  return prisma.saleItem.delete({ where: { id: itemId }, select: { id: true } });
}
