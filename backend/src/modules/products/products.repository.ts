import { prisma } from "../../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { CreateProductInput, UpdateFlavorInput, UpdateProductInput } from "./products.schema.js";

// Seleção pública EXPLÍCITA: `cost` nunca entra aqui.
const publicSelect = {
  id: true,
  name: true,
  brand: true,
  description: true,
  imageUrl: true,
  categoryId: true,
  category: { select: { name: true } },
  price: true,
  unit: true,
  unitDescription: true,
  minQty: true,
  stock: true,
  bestSeller: true,
  featured: true,
  stars: true,
  flavors: { where: { active: true }, orderBy: { id: "asc" }, select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;

const adminSelect = {
  id: true,
  name: true,
  brand: true,
  description: true,
  imageUrl: true,
  categoryId: true,
  category: { select: { name: true } },
  price: true,
  cost: true,
  unit: true,
  unitDescription: true,
  minQty: true,
  stock: true,
  bestSeller: true,
  featured: true,
  stars: true,
  active: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  flavors: { orderBy: { id: "asc" }, select: { id: true, name: true, active: true } },
} satisfies Prisma.ProductSelect;

const visibleInStore = {
  active: true,
  deletedAt: null,
  archivedAt: null,
  category: { active: true },
} satisfies Prisma.ProductWhereInput;

export type PublicProductRow = Prisma.ProductGetPayload<{ select: typeof publicSelect }>;
export type AdminProductRow = Prisma.ProductGetPayload<{ select: typeof adminSelect }>;

export function listPublic() {
  return prisma.product.findMany({
    where: visibleInStore,
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: publicSelect,
  });
}

export function findPublicById(id: number) {
  return prisma.product.findFirst({ where: { id, ...visibleInStore }, select: publicSelect });
}

export function listAdmin() {
  return prisma.product.findMany({ where: { archivedAt: null }, orderBy: [{ name: "asc" }], select: adminSelect });
}

export function findAdminById(id: number) {
  return prisma.product.findFirst({ where: { id, archivedAt: null }, select: adminSelect });
}

export async function categoryExists(id: number): Promise<boolean> {
  return (await prisma.category.count({ where: { id } })) > 0;
}

// O saldo inicial é gravado no INSERT, dentro de uma transação que informa o administrador ao
// trigger de auditoria (audit_stock). Resultado: movimento OPENING com o autor correto.
export function createWithInitialStock(adminId: number, input: CreateProductInput) {
  const { flavors, initialStock, ...data } = input;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('dmais.admin_id', ${String(adminId)}, true), set_config('dmais.stock_reason', 'Saldo inicial', true)`;

    return tx.product.create({
      data: {
        ...data,
        stock: initialStock,
        flavors: { create: flavors.map((name) => ({ name })) },
      },
      select: adminSelect,
    });
  });
}

// Nunca recebe `stock`: o schema do PATCH é estrito e o tipo abaixo não o inclui.
export function update(id: number, input: UpdateProductInput) {
  const { active, ...rest } = input;
  return prisma.product.update({
    where: { id },
    data: {
      ...rest,
      ...(active === undefined ? {} : { active, deletedAt: active ? null : new Date() }),
    },
    select: adminSelect,
  });
}

// Único caminho para mudar o saldo depois do cadastro: a função do banco registra o movimento.
export async function adjustStock(
  adminId: number,
  productId: number,
  delta: number,
  reason: string,
): Promise<number | undefined> {
  const rows = await prisma.$queryRaw<{ stock: number }[]>`
    SELECT public.adjust_stock(${productId}::int, ${delta}::int, ${adminId}::int, ${reason}::text) AS stock`;
  return rows[0]?.stock;
}

export function createFlavor(productId: number, name: string) {
  return prisma.productFlavor.create({
    data: { productId, name },
    select: { id: true, name: true, active: true },
  });
}

export function findFlavor(productId: number, flavorId: number) {
  return prisma.productFlavor.findFirst({ where: { id: flavorId, productId }, select: { id: true } });
}

export function updateFlavor(flavorId: number, input: UpdateFlavorInput) {
  return prisma.productFlavor.update({
    where: { id: flavorId },
    data: input,
    select: { id: true, name: true, active: true },
  });
}

export function remove(id: number) {
  return prisma.product.update({ where: { id }, data: { active: false, deletedAt: new Date(), archivedAt: new Date() }, select: { id: true } });
}
