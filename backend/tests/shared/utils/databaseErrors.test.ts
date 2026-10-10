import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapDatabaseError } from "../../../src/shared/utils/databaseErrors.js";

// Formato do PrismaClientKnownRequestError P2039 (Prisma 7 + adapter-pg), montado à mão.
function prismaError(originalCode: string, originalMessage: string) {
  return Object.assign(new Error(`Database error. Code: \`${originalCode}\`. Message: \`${originalMessage}\``), {
    code: "P2039",
    meta: {
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: { kind: "postgres", originalCode, originalMessage, code: originalCode, message: originalMessage },
      },
    },
  });
}

describe("mapDatabaseError", () => {
  it("regra de estoque/mínimo (P0001) vira 422 com a mensagem do banco", () => {
    const result = mapDatabaseError(prismaError("P0001", "Quantidade fora do mínimo/estoque para o produto 3."));
    assert.deepEqual(result, {
      status: 422,
      code: "DATABASE_RULE_VIOLATION",
      message: "Quantidade fora do mínimo/estoque para o produto 3.",
    });
  });

  it("conflito de estado (P0001) vira 409", () => {
    for (const message of [
      "Transição de pedido inválida.",
      "Cancele primeiro a venda vinculada.",
      "Somente pedidos em REQUESTED podem receber itens.",
      "Histórico imutável: registre cancelamento ou uma nova operação.",
    ]) {
      const result = mapDatabaseError(prismaError("P0001", message));
      assert.equal(result?.status, 409, message);
      assert.equal(result?.code, "DATABASE_CONFLICT");
    }
  });

  it("CHECK (23514) vira 422 sem expor o texto do banco", () => {
    const result = mapDatabaseError(prismaError("23514", 'new row violates check constraint "orders_phone_check"'));
    assert.equal(result?.status, 422);
    assert.doesNotMatch(result?.message ?? "", /orders_phone_check/);
  });

  it("entende o erro do adapter sem conversão (cause direto)", () => {
    const err = { name: "DriverAdapterError", cause: { kind: "postgres", originalCode: "P0001", originalMessage: "Pedido vazio." } };
    assert.equal(mapDatabaseError(err)?.status, 422);
  });

  it("entende só o texto da mensagem (P2039 / P2010)", () => {
    const err = Object.assign(new Error("Database error. Code: `P0001`. Message: `Pedido vazio.`"), { code: "P2039" });
    assert.equal(mapDatabaseError(err)?.message, "Pedido vazio.");
  });

  it("ignora outros erros (continuam 500)", () => {
    assert.equal(mapDatabaseError(new Error("boom")), null);
    assert.equal(mapDatabaseError(prismaError("57014", "canceling statement due to statement timeout")), null);
    assert.equal(mapDatabaseError(null), null);
    assert.equal(mapDatabaseError({ code: "P2025", meta: {} }), null);
  });

  it("P2002 (UNIQUE) vira 409 com mensagem do campo quando conhecido", () => {
    const err = {
      code: "P2002",
      meta: { driverAdapterError: { cause: { kind: "UniqueConstraintViolation", constraint: { index: "categories_name_key" } } } },
    };
    assert.deepEqual(mapDatabaseError(err), {
      status: 409,
      code: "DATABASE_CONFLICT",
      message: "Já existe uma categoria com este nome.",
    });
    assert.equal(mapDatabaseError({ code: "P2002", meta: {} })?.status, 409);
  });

  it("P2003 (chave estrangeira/RESTRICT) vira 409", () => {
    assert.equal(mapDatabaseError({ code: "P2003", meta: {} })?.status, 409);
  });
});
