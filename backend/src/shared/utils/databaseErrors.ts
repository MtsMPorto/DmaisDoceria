// Traduz erros levantados pelo banco (triggers e CHECKs do database/supabase/schema.sql).
//
// Como chegam ao código (Prisma 7 + @prisma/adapter-pg): o adapter converte o erro do `pg`
// em DriverAdapterError { kind: "postgres", originalCode, originalMessage }. Para SQLSTATEs que
// ele não conhece (P0001 de RAISE EXCEPTION, 23514 de CHECK) o cliente lança um
// PrismaClientKnownRequestError com code "P2039" ("Database error. Code: `P0001`. Message: `...`")
// e meta.driverAdapterError.cause. Consultas cruas usam "P2010". Os formatos abaixo cobrem ainda o
// erro do adapter sem conversão e, por último, o texto da mensagem.
//
// Violações de UNIQUE (23505) e de chave estrangeira/RESTRICT (23503, 23001) são convertidas pelo
// adapter e chegam como PrismaClientKnownRequestError P2002 e P2003, com a restrição em
// meta.driverAdapterError.cause.constraint ({ index } ou { fields }).

export interface DatabaseRuleError {
  status: 409 | 422;
  code: "DATABASE_CONFLICT" | "DATABASE_RULE_VIOLATION";
  message: string;
}

interface RawDatabaseError {
  sqlState: string;
  message: string;
}

const RAISE_EXCEPTION = "P0001";
const UNIQUE_MESSAGES: Record<string, string> = {
  categories_name_key: "Já existe uma categoria com este nome.",
  product_flavors_product_id_name_key: "Este produto já tem um sabor com este nome.",
  customers_document_key: "Já existe um cliente com este documento.",
  customers_code_key: "Código de cliente já existente.",
  orders_request_id_key: "Este pedido já foi registrado.",
  sales_order_id_key: "Este pedido já tem uma venda vinculada.",
  admin_users_username_key: "Este usuário já existe.",
  settings_key_key: "Esta configuração já existe.",
};
const CHECK_VIOLATION = "23514";

// Mensagens do banco que descrevem um conflito de estado (409). As demais regras são 422.
const CONFLICT_PATTERN =
  /transição|cancele|imutáve|somente pedidos em requested|rascunho|cancelado|pedido deve iniciar/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function fromCause(cause: unknown): RawDatabaseError | null {
  const record = asRecord(cause);
  if (!record) return null;

  const sqlState = record.originalCode ?? (record.kind === "postgres" ? record.code : undefined);
  const message = record.originalMessage ?? (record.kind === "postgres" ? record.message : undefined);
  if (typeof sqlState === "string" && typeof message === "string") return { sqlState, message };
  return null;
}

function extract(err: unknown): RawDatabaseError | null {
  const record = asRecord(err);
  if (!record) return null;

  const adapterError = asRecord(asRecord(record.meta)?.driverAdapterError);
  const fromMeta = fromCause(adapterError?.cause);
  if (fromMeta) return fromMeta;

  const direct = fromCause(record.cause);
  if (direct) return direct;

  if ((record.code === "P2039" || record.code === "P2010") && typeof record.message === "string") {
    const match = /Code: `([^`]+)`\. Message: `([\s\S]*)`/.exec(record.message);
    if (match) return { sqlState: match[1], message: match[2] };
  }
  return null;
}

function constraintOf(err: unknown): string | null {
  const adapterError = asRecord(asRecord(asRecord(err)?.meta)?.driverAdapterError);
  const constraint = asRecord(asRecord(adapterError?.cause)?.constraint);
  if (typeof constraint?.index === "string") return constraint.index;
  return null;
}

export function mapDatabaseError(err: unknown): DatabaseRuleError | null {
  const prismaCode = asRecord(err)?.code;

  if (prismaCode === "P2002") {
    const index = constraintOf(err);
    return {
      status: 409,
      code: "DATABASE_CONFLICT",
      message: (index && UNIQUE_MESSAGES[index]) || "Já existe um registro com estes dados.",
    };
  }

  if (prismaCode === "P2003") {
    return {
      status: 409,
      code: "DATABASE_CONFLICT",
      message:
        "Este registro está ligado a outros dados ou a referência informada não existe. Inative em vez de apagar.",
    };
  }

  const raw = extract(err);
  if (!raw) return null;

  if (raw.sqlState === RAISE_EXCEPTION) {
    // Texto escrito de propósito no SQL (RAISE EXCEPTION), sem dados do cliente.
    const message = raw.message.trim() || "A operação viola uma regra do banco de dados.";
    return CONFLICT_PATTERN.test(message)
      ? { status: 409, code: "DATABASE_CONFLICT", message }
      : { status: 422, code: "DATABASE_RULE_VIOLATION", message };
  }

  if (raw.sqlState === CHECK_VIOLATION) {
    return {
      status: 422,
      code: "DATABASE_RULE_VIOLATION",
      message: "Algum valor informado não atende às regras do banco de dados.",
    };
  }

  return null;
}
