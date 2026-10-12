import { z } from "zod";
import { UF_LIST } from "../orders/orders.schema.js";
import { isValidCnpj } from "../../shared/utils/document.js";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Campo obrigatório.")
    .max(max, `Máximo de ${max} caracteres.`);
const optional = (max: number) => z.string().trim().max(max).default("");
export const emailSchema = z
  .email("E-mail inválido.")
  .max(150)
  .trim()
  .toLowerCase();
export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(72, "Máximo de 72 caracteres.")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Senha muito longa.",
  );
const humanName = /^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u;
const shape = {
  type: z.enum(["PF", "PJ"]),
  name: text(120),
  tradeName: optional(120),
  responsibleName: optional(120),
  document: z
    .string()
    .max(18)
    .regex(/^[A-Za-z0-9./-]*$/, "CNPJ inválido.")
    .transform((v) => v.replace(/[./-]/g, "").toUpperCase())
    .default(""),
  phone: z
    .string()
    .max(20)
    .regex(/^[\d ()+-]+$/, "Telefone inválido.")
    .transform((v) => v.replace(/\D/g, ""))
    .refine(
      (v) => /^\d{10,11}$/.test(v),
      "Informe telefone com DDD (10 ou 11 dígitos).",
    ),
  zip: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, "CEP deve ter 8 dígitos.")
    .transform((v) => v.replace("-", "")),
  street: text(150),
  streetNumber: text(20),
  complement: optional(80),
  neighborhood: text(80),
  city: text(80),
  state: z.enum(UF_LIST, "UF inválida."),
};
function validateProfile(
  value: {
    type: "PF" | "PJ";
    name: string;
    responsibleName: string;
    document: string;
  },
  ctx: z.RefinementCtx,
) {
  if (value.type === "PF" && !humanName.test(value.name))
    ctx.addIssue({
      code: "custom",
      path: ["name"],
      message: "Informe o nome sem números ou símbolos.",
    });
  if (value.type === "PF" && value.document)
    ctx.addIssue({
      code: "custom",
      path: ["document"],
      message: "Pessoa física não deve informar documento.",
    });
  if (value.type === "PJ") {
    if (!isValidCnpj(value.document))
      ctx.addIssue({
        code: "custom",
        path: ["document"],
        message: "CNPJ inválido",
      });
    if (!humanName.test(value.responsibleName))
      ctx.addIssue({
        code: "custom",
        path: ["responsibleName"],
        message: "Informe o nome completo do proprietário, sem números.",
      });
  }
}
export const profileSchema = z.strictObject(shape).superRefine(validateProfile);
export const registerSchema = z
  .strictObject({
    ...shape,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .superRefine(validateProfile)
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas devem ser iguais.",
  });
export const loginSchema = z.strictObject({
  username: text(150),
  password: z.string().min(1).max(128),
});
export const emailRequestSchema = z.strictObject({ email: emailSchema });
export const verifySchema = z.strictObject({
  challengeId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, "Informe os 6 dígitos."),
});
export const resetSchema = z
  .strictObject({
    resetToken: z.string().regex(/^[a-f0-9]{64}$/),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas devem ser iguais.",
  });
export const emailChangeSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type ProfileInput = z.infer<typeof profileSchema>;
