import { z } from "zod";
import { moneySchema } from "../../shared/utils/money.js";
import { isoDateSchema, pagingShape } from "../../shared/utils/params.js";

export const PAYMENT_METHODS = [
  "pix",
  "boleto",
  "cartao_credito",
  "cartao_debito",
  "dinheiro",
  "transferencia",
] as const;

const paymentMethod = z.enum(PAYMENT_METHODS, "Forma de pagamento inválida.");
const paymentStatus = z.enum(["PENDING", "PARTIAL", "PAID"], "Situação de pagamento inválida.");

const notes = z
  .string()
  .trim()
  .max(1000, "Máximo de 1000 caracteres.")
  .transform((value) => (value === "" ? null : value))
  .nullable();

// Quantidade como texto "2.5": até 3 casas, maior que zero (item avulso). Produto do catálogo
// exige inteiro (conferido no serviço).
const quantitySchema = z
  .union([z.string(), z.number()], "Quantidade inválida.")
  .transform((value) => (typeof value === "number" ? String(value) : value.trim().replace(",", ".")))
  .refine((value) => /^\d{1,9}(\.\d{1,3})?$/.test(value), "Quantidade com até 3 casas decimais.")
  .refine((value) => Number(value) > 0, "A quantidade deve ser maior que zero.");

export const createSaleSchema = z.strictObject({
  customerId: z.number().int().positive(),
  saleDate: isoDateSchema.optional(),
  paymentMethod: paymentMethod.nullable().optional(),
  notes: notes.optional(),
});

export const updateSaleSchema = z
  .strictObject({
    saleDate: isoDateSchema.optional(),
    discount: moneySchema.optional(),
    deliveryFee: moneySchema.optional(),
    paymentMethod: paymentMethod.nullable().optional(),
    paymentStatus: paymentStatus.optional(),
    paidAmount: moneySchema.optional(),
    notes: notes.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Informe ao menos um campo.");

export const createItemSchema = z
  .strictObject({
    productId: z.number().int().positive().optional(),
    flavorId: z.number().int().positive().nullable().optional(),
    productName: z.string().trim().min(1).max(120).optional(),
    quantity: quantitySchema,
    unitPrice: moneySchema.optional(),
    notes: notes.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.productId === undefined && body.productName === undefined) {
      ctx.addIssue({ code: "custom", path: ["productName"], message: "Informe o produto ou a descrição do item." });
    }
    if (body.productId !== undefined && body.productName !== undefined) {
      ctx.addIssue({ code: "custom", path: ["productName"], message: "Item de produto não leva descrição própria." });
    }
    if (body.productId === undefined && body.unitPrice === undefined) {
      ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "Informe o preço unitário." });
    }
    if (body.productId === undefined && body.flavorId) {
      ctx.addIssue({ code: "custom", path: ["flavorId"], message: "Item avulso não tem sabor." });
    }
  });

export const updateItemSchema = z
  .strictObject({
    flavorId: z.number().int().positive().nullable().optional(),
    productName: z.string().trim().min(1).max(120).optional(),
    quantity: quantitySchema.optional(),
    unitPrice: moneySchema.optional(),
    notes: notes.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Informe ao menos um campo.");

export const listSalesQuerySchema = z
  .strictObject({
    ...pagingShape,
    status: z.enum(["DRAFT", "CONFIRMED", "DELIVERED", "CANCELED"]).optional(),
    customerId: z.coerce.number().int().positive().optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    q: z.string().trim().min(1).max(100).optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ["to"],
    message: "A data final deve ser igual ou posterior à inicial.",
  });

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
