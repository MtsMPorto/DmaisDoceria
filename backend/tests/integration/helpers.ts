import "dotenv/config";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { hash } from "bcryptjs";
import jwt from "jsonwebtoken";

// TESTES DE INTEGRAÇÃO: escrevem no banco. Só rodam com DATABASE_URL_TEST definido e DIFERENTE de
// DATABASE_URL (o banco real). Use um projeto Supabase de testes com o database/supabase/schema.sql.
// Os dados criados ficam no banco de testes (histórico de estoque e vendas é imutável).

const mainUrl = process.env.DATABASE_URL;
const testUrl = process.env.DATABASE_URL_TEST;

if (testUrl && mainUrl && testUrl === mainUrl) {
  throw new Error("DATABASE_URL_TEST é igual a DATABASE_URL: recusando rodar testes que escrevem no banco real.");
}

export const integrationEnabled = Boolean(testUrl) && testUrl !== mainUrl;

export const skipReason = integrationEnabled
  ? undefined
  : "Defina DATABASE_URL_TEST (banco de testes, diferente de DATABASE_URL) para rodar a integração.";

export interface TestContext {
  base: string;
  token: string;
  adminId: number;
  prisma: typeof import("../../src/config/prisma.js").prisma;
  close: () => Promise<void>;
}

export async function startContext(): Promise<TestContext> {
  if (!integrationEnabled || !testUrl) throw new Error(skipReason);

  // Precisa vir ANTES de importar app/prisma: env.ts lê DATABASE_URL na importação.
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = "test";

  const { app } = await import("../../src/app.js");
  const { prisma } = await import("../../src/config/prisma.js");

  const server: Server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const { port } = server.address() as AddressInfo;

  const username = `teste-${Date.now()}`;
  const admin = await prisma.adminUser.create({
    data: { name: "Admin de teste", username, passwordHash: await hash("senha-de-teste-123", 4) },
    select: { id: true },
  });
  const token = jwt.sign({ sub: String(admin.id) }, process.env.JWT_SECRET as string, {
    algorithm: "HS256",
    expiresIn: "10m",
  });

  return {
    base: `http://localhost:${port}`,
    token,
    adminId: admin.id,
    prisma,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await prisma.$disconnect();
    },
  };
}

export async function call<T = unknown>(
  ctx: TestContext,
  method: string,
  path: string,
  body?: unknown,
  auth = true,
): Promise<{ status: number; json: T }> {
  const response = await fetch(`${ctx.base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(auth ? { Authorization: `Bearer ${ctx.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // CSV ou corpo vazio
  }
  return { status: response.status, json: json as T };
}

// CPF válido, único por chamada (para não colidir com o UNIQUE de customers.document).
export function randomCpf(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (const position of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < position; i++) sum += digits[i] * (position + 1 - i);
    const remainder = (sum * 10) % 11;
    digits.push(remainder === 10 ? 0 : remainder);
  }
  return digits.join("");
}
