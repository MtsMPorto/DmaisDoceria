import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import * as authRepository from "../../modules/auth/auth.repository.js";
import { AppError } from "../utils/errors.js";

// Valida o JWT e confere no banco se o administrador ainda está ativo (uma consulta por request).
// O id do administrador sempre vem daqui (res.locals.adminId), nunca do corpo da requisição.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "UNAUTHORIZED", "Autenticação necessária.");
  }

  let adminId: number;
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
    if (typeof payload !== "object" || (payload.role !== undefined && payload.role !== "admin")) throw new Error("Invalid role");
    const sub = typeof payload === "object" ? payload.sub : undefined;
    adminId = Number(sub);
    if (!Number.isInteger(adminId) || adminId <= 0) throw new Error("sub inválido");
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Token inválido ou expirado.");
  }

  const admin = await authRepository.findActiveAdminById(adminId);
  if (!admin) throw new AppError(401, "UNAUTHORIZED", "Sessão inválida. Entre novamente.");

  res.locals.adminId = adminId;
  next();
}
