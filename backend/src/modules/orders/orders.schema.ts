import { z } from "zod";
import { isValidCnpj, onlyDigits } from "../../shared/utils/document.js";

export const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const UF_SET: ReadonlySet<string> = new Set(UF_LIST);


//aqui tem que cuidar pq tem que ajustar as regra, limite maximo de 9999 é pra fuder
export const MAX_ITEMS = 50;
export const MAX_FLAVORS_PER_ITEM = 30;
export const MAX_QUANTITY = 9999;

const requiredText = (max: number) =>
  z.string().trim().min(1, "Campo obrigatório.").max(max, `Máximo de ${max} caracteres.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .transform((value) => (value ? value : undefined));

const digitsField = z.string().max(30, "Valor muito longo.").transform(onlyDigits);

const customerSchema = z
  .strictObject({
    type: z.enum(["PF", "PJ"], "Tipo de cliente deve ser PF ou PJ."),
    name: requiredText(120),
    document: z.string().max(18).regex(/^[A-Za-z0-9./-]*$/).transform(v => v.replace(/[./-]/g, "").toUpperCase()).default(""),
    phone: digitsField.refine(
      (value) => value.length === 10 || value.length === 11,
      "Telefone deve ter 10 ou 11 dígitos.",
    ),
    zip: digitsField.refine((value) => value.length === 8, "CEP deve ter 8 dígitos."),
    street: requiredText(150),
    streetNumber: requiredText(20),
    complement: optionalText(80),
    neighborhood: requiredText(80),
    city: requiredText(80),
    state: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => UF_SET.has(value), "UF inválida."),
  })
  .superRefine((customer, ctx) => {
    if (customer.type === "PF" && customer.document !== "") {
      ctx.addIssue({ code: "custom", path: ["document"], message: "Pessoa física não deve informar documento." });
    }
    if (customer.type === "PJ" && !isValidCnpj(customer.document)) {
      ctx.addIssue({ code: "custom", path: ["document"], message: "CNPJ inválido." });
    }
  });

const flavorEntrySchema = z.strictObject({
  flavor: z.string().min(1, "Sabor inválido.").max(80, "Máximo de 80 caracteres.").nullable(),
  quantity: z
    .number("Quantidade deve ser um número.")
    .int("Quantidade deve ser um número inteiro.")
    .min(1, "Quantidade mínima é 1.")
    .max(MAX_QUANTITY, `Quantidade máxima é ${MAX_QUANTITY}.`),
});

const itemSchema = z.strictObject({
  productId: z.number("productId deve ser um número.").int().positive().max(2_147_483_647),
  flavors: z
    .array(flavorEntrySchema)
    .min(1, "Informe ao menos uma quantidade.")
    .max(MAX_FLAVORS_PER_ITEM, `Máximo de ${MAX_FLAVORS_PER_ITEM} sabores por item.`),
});

export const createOrderSchema = z.strictObject({
  requestId: z.uuid("requestId deve ser um UUID.").optional(),
  customer: customerSchema,
  items: z
    .array(itemSchema)
    .min(1, "O pedido precisa ter ao menos um item.")
    .max(MAX_ITEMS, `Máximo de ${MAX_ITEMS} itens por pedido.`),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

const dateParam = z.union([z.iso.date(), z.iso.datetime({ offset: true })], "Data inválida.");

export const listOrdersQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["REQUESTED", "CONFIRMED", "CANCELED"]).optional(),
    from: dateParam.optional(),
    to: dateParam.optional(),
    q: z.string().trim().min(1).max(100).optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ["to"],
    message: "A data final deve ser igual ou posterior à inicial.",
  });

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const orderIdParamSchema = z
  .string()
  .regex(/^\d+$/, "Número de pedido inválido.")
  .transform(Number)
  .refine((id) => id > 0 && id <= 2_147_483_647, "Número de pedido inválido.");

export const updateStatusSchema = z.strictObject({
  status: z.enum(["CANCELED"], "Só é possível mudar o status para CANCELED."),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
