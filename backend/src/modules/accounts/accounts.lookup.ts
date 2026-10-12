import { z } from "zod";
import { AppError } from "../../shared/utils/errors.js";
import { isValidCnpj } from "../../shared/utils/document.js";

const cache = new Map<string, { until: number; value: unknown }>();
async function lookup(url: string, key: string, invalidMessage: string) {
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (response.status === 404)
      throw new AppError(422, "LOOKUP_INVALID", invalidMessage);
    if (!response.ok) throw new Error("Unavailable");
    const value: unknown = await response.json();
    if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + 3600_000, value });
    return value;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      "LOOKUP_UNAVAILABLE",
      "Consulta indisponível. Tente novamente em instantes.",
    );
  }
}
export async function lookupZip(zip: string) {
  if (!/^\d{8}$/.test(zip))
    throw new AppError(422, "INVALID_ZIP", "CEP inválido.");
  const value = await lookup(
    `https://viacep.com.br/ws/${zip}/json/`,
    `zip:${zip}`,
    "CEP não encontrado.",
  );
  const result = z
    .object({
      erro: z.union([z.boolean(), z.string()]).optional(),
      logradouro: z.string().optional(),
      bairro: z.string().optional(),
      localidade: z.string().optional(),
      uf: z.string().optional(),
    })
    .safeParse(value);
  if (!result.success)
    throw new AppError(
      503,
      "LOOKUP_UNAVAILABLE",
      "Consulta de CEP indisponível.",
    );
  if (result.data.erro)
    throw new AppError(422, "INVALID_ZIP", "CEP não encontrado.");
  if (!result.data.localidade || !result.data.uf)
    throw new AppError(
      503,
      "LOOKUP_UNAVAILABLE",
      "Consulta de CEP indisponível.",
    );
  return {
    street: result.data.logradouro || "",
    neighborhood: result.data.bairro || "",
    city: result.data.localidade,
    state: result.data.uf,
  };
}
export async function lookupCnpj(document: string) {
  if (!isValidCnpj(document))
    throw new AppError(422, "INVALID_CNPJ", "CNPJ inválido");
  const value = await lookup(
    `https://brasilapi.com.br/api/cnpj/v1/${document}`,
    `cnpj:${document}`,
    "CNPJ inválido",
  );
  const result = z
    .object({
      cnpj: z.union([z.string(), z.number()]),
      razao_social: z.string(),
      nome_fantasia: z.string().nullable().optional(),
    })
    .safeParse(value);
  if (
    !result.success ||
    String(result.data.cnpj).replace(/[./-]/g, "") !== document
  )
    throw new AppError(
      503,
      "LOOKUP_UNAVAILABLE",
      "Consulta de CNPJ indisponível. Tente novamente.",
    );
  return {
    name: result.data.razao_social,
    tradeName: result.data.nome_fantasia || "",
  };
}
