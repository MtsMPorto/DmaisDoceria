import { z } from "zod";

const name = z.string().trim().min(1, "Informe o nome.").max(60, "Máximo de 60 caracteres.");
const sortOrder = z.number().int().min(0).max(9999);

export const createCategorySchema = z.strictObject({
  name,
  sortOrder: sortOrder.default(0),
});

export const updateCategorySchema = z
  .strictObject({
    name: name.optional(),
    sortOrder: sortOrder.optional(),
    active: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Informe ao menos um campo.");

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
