import { AppError } from "../../shared/utils/errors.js";
import * as repository from "./testimonials.repository.js";
import type { CreateTestimonialInput, UpdateTestimonialInput } from "./testimonials.schema.js";

export const listPublic = repository.listPublished;
export const listAdmin = repository.listAll;
export const create = (input: CreateTestimonialInput) => repository.create(input);

export async function update(id: number, input: UpdateTestimonialInput) {
  if (!(await repository.exists(id))) {
    throw new AppError(404, "TESTIMONIAL_NOT_FOUND", "Depoimento não encontrado.");
  }
  return repository.update(id, input);
}
