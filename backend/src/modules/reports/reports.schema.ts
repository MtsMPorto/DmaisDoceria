import { z } from "zod";
import { isoDateSchema } from "../../shared/utils/params.js";

const MAX_RANGE_DAYS = 3660;

const rangeShape = {
  from: isoDateSchema,
  to: isoDateSchema,
};

function withinRange(query: { from: string; to: string }): boolean {
  const days = (Date.parse(query.to) - Date.parse(query.from)) / 86_400_000;
  return days >= 0 && days <= MAX_RANGE_DAYS;
}

const rangeMessage = { path: ["to"], message: "Período inválido (a data final deve ser igual ou posterior à inicial)." };

export const summaryQuerySchema = z
  .strictObject({
    ...rangeShape,
    // "1,2,3": vazio = todos os produtos.
    productIds: z
      .string()
      .regex(/^\d+(,\d+)*$/, "Lista de produtos inválida.")
      .transform((value) => [...new Set(value.split(",").map(Number))])
      .refine((ids) => ids.length <= 100, "Produtos demais no filtro.")
      .optional(),
  })
  .refine(withinRange, rangeMessage);

export const exportQuerySchema = z.strictObject(rangeShape).refine(withinRange, rangeMessage);

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
