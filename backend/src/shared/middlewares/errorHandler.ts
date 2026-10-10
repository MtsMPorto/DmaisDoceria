import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../../config/env.js";
import { mapDatabaseError } from "../utils/databaseErrors.js";
import { AppError } from "../utils/errors.js";

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function send(res: Response, status: number, error: ErrorBody["error"]): void {
  const body: ErrorBody = { error };
  res.status(status).json(body);
}

function bodyParserError(err: unknown): { status: number; code: string; message: string } | null {
  if (typeof err !== "object" || err === null || !("type" in err)) return null;
  if (err.type === "entity.too.large") {
    return { status: 413, code: "PAYLOAD_TOO_LARGE", message: "Corpo da requisição grande demais." };
  }
  if (err.type === "entity.parse.failed" || err.type === "encoding.unsupported") {
    return { status: 400, code: "INVALID_JSON", message: "Corpo da requisição inválido." };
  }
  return null;
}

export function notFound(_req: Request, res: Response): void {
  send(res, 404, { code: "NOT_FOUND", message: "Rota não encontrada." });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    send(res, err.status, {
      code: err.code,
      message: err.message,
      ...(err.details === undefined ? {} : { details: err.details }),
    });
    return;
  }

  if (err instanceof ZodError) {
    send(res, 400, {
      code: "VALIDATION_ERROR",
      message: "Dados inválidos.",
      details: err.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
    return;
  }

  // Regras do banco (triggers e CHECKs) viram 409/422 em vez de 500.
  const databaseRule = mapDatabaseError(err);
  if (databaseRule) {
    send(res, databaseRule.status, { code: databaseRule.code, message: databaseRule.message });
    return;
  }

  const parsed = bodyParserError(err);
  if (parsed) {
    send(res, parsed.status, { code: parsed.code, message: parsed.message });
    return;
  }

  // Nunca registra corpo da requisição nem dados do cliente. Mensagens de erro do
  // Prisma podem conter valores enviados, então só aparecem em desenvolvimento.
  if (env.nodeEnv === "development") {
    console.error(err);
    const message = err instanceof Error ? err.message : "Erro interno.";
    send(res, 500, { code: "INTERNAL_ERROR", message });
    return;
  }

  console.error(`Erro interno: ${err instanceof Error ? err.name : "desconhecido"}`);
  send(res, 500, { code: "INTERNAL_ERROR", message: "Erro interno do servidor." });
}
