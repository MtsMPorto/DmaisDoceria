import { z } from "zod";
import { isValidCnpj, onlyDigits } from "../../shared/utils/document.js";
import { pagingShape } from "../../shared/utils/params.js";
import { UF_LIST } from "../orders/orders.schema.js";

const UF_SET: ReadonlySet<string> = new Set(UF_LIST);

const requiredText = (max: number) =>
  z.string().trim().min(1, "Campo obrigatório.").max(max, `Máximo de ${max} caracteres.`);

// Texto opcional: "" vira null (limpa o campo).
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const digits = z.string().max(30, "Valor muito longo.").transform(onlyDigits);

const document = z.string().max(18).regex(/^[A-Za-z0-9./-]*$/).transform(v => v.replace(/[./-]/g, "").toUpperCase()).transform((value) => (value === "" ? null : value)).nullable();

const phone = digits.refine(
  (value) => value.length >= 10 && value.length <= 15,
  "Telefone deve ter de 10 a 15 dígitos.",
);

const zip = digits
  .refine((value) => value === "" || value.length === 8, "CEP deve ter 8 dígitos.")
  .transform((value) => (value === "" ? null : value))
  .nullable();

const state = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => value === "" || UF_SET.has(value), "UF inválida.")
  .transform((value) => (value === "" ? null : value))
  .nullable();

const email = z
  .string()
  .trim()
  .max(150, "Máximo de 150 caracteres.")
  .refine((value) => value === "" || z.email().safeParse(value).success, "E-mail inválido.")
  .transform((value) => (value === "" ? null : value))
  .nullable();

const type = z.enum(["PF", "PJ"], "Tipo deve ser PF ou PJ.");

// Não coletar CPF. CNPJ numérico ou alfanumérico, com dígitos verificadores.
export function documentProblem(customerType: "PF" | "PJ", value: string | null): string | null {
  if (value === null) return null;
  if (customerType === "PF") return "Pessoa física não deve informar documento.";
  return isValidCnpj(value) ? null : "CNPJ inválido.";
}

const fields = {
  name: requiredText(120),
  tradeName: optionalText(120),
  responsibleName: optionalText(120),
  document,
  phone,
  email,
  notes: optionalText(1000),
  zip,
  street: optionalText(150),
  streetNumber: optionalText(20),
  complement: optionalText(80),
  neighborhood: optionalText(80),
  city: optionalText(80),
  state,
};

export const createCustomerSchema = z
  .strictObject({
    type,
    name: fields.name,
    tradeName: fields.tradeName.optional(),
    responsibleName: fields.responsibleName.optional(),
    document: fields.document.optional(),
    phone: fields.phone,
    email: fields.email.optional(),
    notes: fields.notes.optional(),
    zip: fields.zip.optional(),
    street: fields.street.optional(),
    streetNumber: fields.streetNumber.optional(),
    complement: fields.complement.optional(),
    neighborhood: fields.neighborhood.optional(),
    city: fields.city.optional(),
    state: fields.state.optional(),
  })
  .superRefine((body, ctx) => {
    const problem = documentProblem(body.type, body.document ?? null);
    if (problem) ctx.addIssue({ code: "custom", path: ["document"], message: problem });
  });

export const updateCustomerSchema = z
  .strictObject({
    type: type.optional(),
    name: fields.name.optional(),
    tradeName: fields.tradeName.optional(),
    responsibleName: fields.responsibleName.optional(),
    document: fields.document.optional(),
    phone: fields.phone.optional(),
    email: fields.email.optional(),
    notes: fields.notes.optional(),
    zip: fields.zip.optional(),
    street: fields.street.optional(),
    streetNumber: fields.streetNumber.optional(),
    complement: fields.complement.optional(),
    neighborhood: fields.neighborhood.optional(),
    city: fields.city.optional(),
    state: fields.state.optional(),
    active: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Informe ao menos um campo.");

export const listCustomersQuerySchema = z.strictObject({
  ...pagingShape,
  q: z.string().trim().min(1).max(100).optional(),
  type: type.optional(),
  active: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
