import { z } from "zod";

// Dinheiro trafega como texto "12.50" (numeric(10,2) no banco), sem ponto flutuante.
const MONEY_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

function normalize(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

export const moneySchema = z
  .union([z.string(), z.number()], "Valor inválido.")
  .transform((value) => (typeof value === "number" ? String(value) : value.trim().replace(",", ".")))
  .refine((value) => MONEY_PATTERN.test(value), "Informe um valor em reais com até 2 casas decimais.")
  .transform(normalize);

interface DecimalLike {
  toFixed(digits: number): string;
}

export function money(value: DecimalLike): string;
export function money(value: DecimalLike | null): string | null;
export function money(value: DecimalLike | null): string | null {
  return value === null ? null : value.toFixed(2);
}
