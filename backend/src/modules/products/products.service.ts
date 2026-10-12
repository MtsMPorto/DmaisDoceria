import { AppError } from "../../shared/utils/errors.js";
import { money } from "../../shared/utils/money.js";
import * as repository from "./products.repository.js";
import type { AdminProductRow, PublicProductRow } from "./products.repository.js";
import type { CreateProductInput, UpdateFlavorInput, UpdateProductInput } from "./products.schema.js";

const notFound = () => new AppError(404, "PRODUCT_NOT_FOUND", "Produto não encontrado.");

export function toPublicProduct(row: PublicProductRow) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    description: row.description,
    imageUrl: row.imageUrl,
    categoryId: row.categoryId,
    category: row.category.name,
    price: money(row.price),
    unit: row.unit,
    unitDescription: row.unitDescription,
    minQty: row.minQty,
    stock: row.stock,
    bestSeller: row.bestSeller,
    featured: row.featured,
    stars: row.stars,
    flavors: row.flavors,
  };
}

export function toAdminProduct(row: AdminProductRow) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    description: row.description,
    imageUrl: row.imageUrl,
    categoryId: row.categoryId,
    category: row.category.name,
    price: money(row.price),
    cost: money(row.cost),
    unit: row.unit,
    unitDescription: row.unitDescription,
    minQty: row.minQty,
    stock: row.stock,
    bestSeller: row.bestSeller,
    featured: row.featured,
    stars: row.stars,
    active: row.active,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    flavors: row.flavors,
  };
}

export async function listPublic() {
  return (await repository.listPublic()).map(toPublicProduct);
}

export async function getPublic(id: number) {
  const row = await repository.findPublicById(id);
  if (!row) throw notFound();
  return toPublicProduct(row);
}

export async function listAdmin() {
  return (await repository.listAdmin()).map(toAdminProduct);
}

async function requireProduct(id: number) {
  const row = await repository.findAdminById(id);
  if (!row) throw notFound();
  return row;
}

async function requireCategory(categoryId: number) {
  if (!(await repository.categoryExists(categoryId))) {
    throw new AppError(422, "CATEGORY_NOT_FOUND", "Categoria não encontrada.");
  }
}

export async function create(adminId: number, input: CreateProductInput) {
  await requireCategory(input.categoryId);
  return toAdminProduct(await repository.createWithInitialStock(adminId, input));
}

export async function update(id: number, input: UpdateProductInput) {
  await requireProduct(id);
  if (input.categoryId !== undefined) await requireCategory(input.categoryId);
  return toAdminProduct(await repository.update(id, input));
}

export async function adjustStock(adminId: number, id: number, delta: number, reason: string) {
  const product = await requireProduct(id);
  if (product.stock + delta < 0) {
    throw new AppError(
      422,
      "STOCK_NEGATIVE",
      `O saldo atual é ${product.stock}; não é possível reduzir ${Math.abs(delta)}.`,
    );
  }
  // O banco confere de novo (CHECK stock >= 0) caso o saldo mude entre a leitura e o ajuste.
  const stock = await repository.adjustStock(adminId, id, delta, reason);
  return { id, stock };
}

export async function createFlavor(productId: number, name: string) {
  await requireProduct(productId);
  return repository.createFlavor(productId, name);
}

export async function updateFlavor(productId: number, flavorId: number, input: UpdateFlavorInput) {
  if (!(await repository.findFlavor(productId, flavorId))) {
    throw new AppError(404, "FLAVOR_NOT_FOUND", "Sabor não encontrado.");
  }
  return repository.updateFlavor(flavorId, input);
}

export async function remove(id: number) {
  await requireProduct(id);
  return repository.remove(id);
}
