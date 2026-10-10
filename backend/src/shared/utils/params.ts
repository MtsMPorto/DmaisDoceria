import { z } from "zod";

// Identificador numérico vindo da URL (/:id).
export const idParamSchema = z
  .string()
  .regex(/^\d+$/, "Identificador inválido.")
  .transform(Number)
  .refine((id) => id > 0 && id <= 2_147_483_647, "Identificador inválido.");

export const pagingShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const isoDateSchema = z.iso.date("Data inválida (use AAAA-MM-DD).");

// Converte "2026-10-01" em Date UTC (as colunas `date` do banco não têm fuso).
export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function adminIdOf(res: { locals: Record<string, unknown> }): number {
  const id = res.locals.adminId;
  if (typeof id !== "number") throw new Error("adminId ausente: rota sem requireAuth.");
  return id;
}
