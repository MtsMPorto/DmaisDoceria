import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/utils/errors.js";

export async function requireCustomer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  let id: number, version: number;
  try {
    if (scheme !== "Bearer" || !token) throw new Error();
    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      audience: "customer-account",
    });
    if (typeof payload !== "object" || payload.role !== "customer")
      throw new Error();
    id = Number(payload.sub);
    version = payload.version;
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isInteger(version))
      throw new Error();
  } catch {
    throw new AppError(
      401,
      "CUSTOMER_UNAUTHORIZED",
      "Entre na sua conta para continuar.",
    );
  }
  const account = await prisma.customerAccount.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (
    !account?.verifiedAt ||
    account.sessionVersion !== version ||
    !account.customer?.active
  )
    throw new AppError(
      401,
      "CUSTOMER_UNAUTHORIZED",
      "Sua sessão expirou. Entre novamente.",
    );
  res.locals.accountId = id;
  res.locals.customer = account.customer;
  next();
}
