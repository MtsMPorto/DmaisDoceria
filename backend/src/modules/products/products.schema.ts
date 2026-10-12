import { z } from "zod";
import { moneySchema } from "../../shared/utils/money.js";

const text = (max: number) =>
  z.string().trim().min(1, "Campo obrigatório.").max(max, `Máximo de ${max} caracteres.`);

// Texto opcional: "" vira null (limpa o campo).
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const imageUrl = z
  .string()
  .trim()
  .max(500, "Máximo de 500 caracteres.")
  .refine((value) => value === "" || /^https?:\/\//i.test(value), "Use um endereço http(s).")
  .transform((value) => (value === "" ? null : value))
  .nullable();

const fields = {
  name: text(120),
  brand: text(80),
  description: nullableText(1000),
  imageUrl,
  categoryId: z.number().int().positive(),
  price: moneySchema,
  cost: moneySchema.nullable(),
  unit: text(40),
  unitDescription: nullableText(120),
  minQty: z.number().int().min(1).max(9999),
  bestSeller: z.boolean(),
  featured: z.boolean(),
  stars: z.number().int().min(1).max(5),
  active: z.boolean(),
};

const flavorName = text(60);

export const createProductSchema = z.strictObject({
  name: fields.name,
  brand: fields.brand,
  description: fields.description.optional(),
  imageUrl: fields.imageUrl.optional(),
  categoryId: fields.categoryId,
  price: fields.price,
  cost: fields.cost.optional(),
  unit: fields.unit,
  unitDescription: fields.unitDescription.optional(),
  minQty: fields.minQty.default(1),
  bestSeller: fields.bestSeller.default(false),
  featured: fields.featured.default(false),
  stars: fields.stars.default(5),
  active: fields.active.default(true),
  // Saldo inicial: só no cadastro. Depois disso, o saldo muda apenas por ajuste.
  initialStock: z.number().int().min(0).max(1_000_000).default(0),
  flavors: z
    .array(flavorName)
    .max(50, "Máximo de 50 sabores.")
    .default([])
    .refine(
      (list) => new Set(list.map((name) => name.toLowerCase())).size === list.length,
      "Há sabores repetidos.",
    ),
});

// strictObject: qualquer chave desconhecida (inclusive `stock`) é rejeitada com 400.
export const updateProductSchema = z
  .strictObject({
    name: fields.name.optional(),
    brand: fields.brand.optional(),
    description: fields.description.optional(),
    imageUrl: fields.imageUrl.optional(),
    categoryId: fields.categoryId.optional(),
    price: fields.price.optional(),
    cost: fields.cost.optional(),
    unit: fields.unit.optional(),
    unitDescription: fields.unitDescription.optional(),
    minQty: fields.minQty.optional(),
    bestSeller: fields.bestSeller.optional(),
    featured: fields.featured.optional(),
    stars: fields.stars.optional(),
    active: fields.active.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Informe ao menos um campo.");

export const adjustStockSchema = z.strictObject({
  delta: z
    .number("Informe a variação.")
    .int("A variação deve ser um número inteiro.")
    .min(-1_000_000)
    .max(1_000_000)
    .refine((value) => value !== 0, "A variação não pode ser zero."),
  reason: z.string().trim().min(3, "Informe o motivo.").max(200, "Máximo de 200 caracteres."),
});

export const createFlavorSchema = z.strictObject({ name: flavorName });

export const updateFlavorSchema = z
  .strictObject({ name: flavorName.optional(), active: z.boolean().optional() })
  .refine((body) => Object.keys(body).length > 0, "Informe ao menos um campo.");

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type UpdateFlavorInput = z.infer<typeof updateFlavorSchema>;
