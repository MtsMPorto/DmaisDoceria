import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const fields = {
  name: z.string().trim().min(1, "Informe o nome.").max(80, "Máximo de 80 caracteres."),
  city: optionalText(80),
  stars: z.number().int().min(1).max(5),
  text: z.string().trim().min(1, "Informe o depoimento.").max(600, "Máximo de 600 caracteres."),
  avatar: optionalText(3),
  published: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
};

export const createTestimonialSchema = z.strictObject({
  name: fields.name,
  city: fields.city.optional(),
  stars: fields.stars.default(5),
  text: fields.text,
  avatar: fields.avatar.optional(),
  published: fields.published.default(false),
  sortOrder: fields.sortOrder.default(0),
});

export const updateTestimonialSchema = z
  .strictObject({
    name: fields.name.optional(),
    city: fields.city.optional(),
    stars: fields.stars.optional(),
    text: fields.text.optional(),
    avatar: fields.avatar.optional(),
    published: fields.published.optional(),
    sortOrder: fields.sortOrder.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Informe ao menos um campo.");

export type CreateTestimonialInput = z.infer<typeof createTestimonialSchema>;
export type UpdateTestimonialInput = z.infer<typeof updateTestimonialSchema>;
