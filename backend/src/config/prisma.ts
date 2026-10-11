import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

// Na Render, o certificado vem de Secret Files; localmente, da pasta certs.
const certificatePath = process.env.RENDER === "true"
  ? "/etc/secrets/supabase-ca.crt"
  : new URL("../../certs/supabase-ca.crt", import.meta.url);

const adapter = new PrismaPg({
  connectionString: env.databaseUrl,
  ssl: {
    ca: readFileSync(certificatePath, "utf8"),
    rejectUnauthorized: true,
  },
});

export const prisma = new PrismaClient({ adapter });
