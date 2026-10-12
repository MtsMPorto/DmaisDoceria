import { compare, hashSync } from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { LOGIN_LOCK_MS, LOGIN_MAX_FAILED_ATTEMPTS } from "../../config/limits.js";
import { AppError } from "../../shared/utils/errors.js";
import * as repository from "./auth.repository.js";
import type { LoginInput } from "./auth.schema.js";

// Hash descartável: usuário inexistente também gasta o tempo de um bcrypt, para
// a resposta não revelar se o usuário existe.
const DUMMY_HASH = hashSync("senha-descartavel-para-tempo-constante", 10);

const invalidCredentials = () =>
  new AppError(401, "INVALID_CREDENTIALS", "Usuário ou senha incorretos.");

export async function login({ username, password }: LoginInput): Promise<{ token: string }> {
  const admin = await repository.findAdminByUsername(username);
  const now = Date.now();

  const locked = admin?.lockedUntil != null && admin.lockedUntil.getTime() > now;
  const passwordMatches = await compare(password, admin?.passwordHash ?? DUMMY_HASH);

  if (!admin || !admin.active || locked || !passwordMatches) {
    // Senha errada em conta ativa e desbloqueada: conta a tentativa.
    if (admin && admin.active && !locked) {
      const { failedAttempts } = await repository.registerFailedAttempt(admin.id);
      if (failedAttempts >= LOGIN_MAX_FAILED_ATTEMPTS) {
        await repository.lockAdmin(admin.id, new Date(now + LOGIN_LOCK_MS));
      }
    }
    // Mesma resposta em todos os casos (inclusive conta bloqueada).
    throw invalidCredentials();
  }

  await repository.registerSuccessfulLogin(admin.id);

  const token = jwt.sign({ sub: String(admin.id), role: "admin" }, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });
  return { token };
}

export async function getCurrentAdmin(id: number) {
  const admin = await repository.findActiveAdminById(id);
  if (!admin) throw new AppError(401, "UNAUTHORIZED", "Sessão inválida. Entre novamente.");
  return admin;
}
