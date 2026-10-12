import { prisma } from "../../config/prisma.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema.js";

const adminSelect = { id: true, name: true, sortOrder: true, active: true } as const;

export function listActive() {
  return prisma.category.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

export function listAll() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: adminSelect,
  });
}

export function create(input: CreateCategoryInput) {
  return prisma.category.create({ data: input, select: adminSelect });
}

export async function exists(id: number): Promise<boolean> {
  return (await prisma.category.count({ where: { id } })) > 0;
}

export function update(id: number, input: UpdateCategoryInput) {
  return prisma.category.update({ where: { id }, data: input, select: adminSelect });
}

export async function remove(id: number) {
  return prisma.category.delete({ where: { id }, select: adminSelect });
}

export function countProducts(id: number) {
  return prisma.product.count({ where: { categoryId: id } });
}
