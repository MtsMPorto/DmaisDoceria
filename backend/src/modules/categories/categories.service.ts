import { AppError } from "../../shared/utils/errors.js";
import * as repository from "./categories.repository.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema.js";

export const listPublic = repository.listActive;
export const listAdmin = repository.listAll;
export const create = (input: CreateCategoryInput) => repository.create(input);

export async function update(id: number, input: UpdateCategoryInput) {
  if (!(await repository.exists(id))) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "Categoria não encontrada.");
  }
  return repository.update(id, input);
}
