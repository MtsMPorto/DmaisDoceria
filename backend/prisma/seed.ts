import { hash } from "bcryptjs";
import { prisma } from "../src/config/prisma.js";

// Cria só o primeiro admin. As credenciais vêm do ambiente: nunca ficam no código.
// Categorias e configurações já são inseridas pelo database/supabase/schema.sql
// (categories.name é UNIQUE) e estoque só muda via confirm_sale, cancel_sale e adjust_stock.

async function seedAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrador";

  if (!username || !password) {
    throw new Error("Defina ADMIN_USERNAME e ADMIN_PASSWORD no .env para criar o primeiro admin.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD deve ter ao menos 12 caracteres.");
  }

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin "${username}" já existe; a senha NÃO foi alterada.`);
    return;
  }

  await prisma.adminUser.create({
    data: { name, username, passwordHash: await hash(password, 12) },
  });
  console.log(`Admin "${username}" criado.`);
}

async function main(): Promise<void> {
  await seedAdmin();
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : "Falha no seed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
