import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { createOrderSchema, listOrdersQuerySchema, updateStatusSchema } from "../../../src/modules/orders/orders.schema.js";

z.config(z.locales.pt());

// CPF e CNPJ tirados do cu pq é teste
const VALID_CPF = "12345678909";
const VALID_CNPJ = "12345678000195";

function body(overrides: Record<string, unknown> = {}, customer: Record<string, unknown> = {}) {
  return {
    customer: {
      type: "PF",
      name: "Cliente de Teste",
      document: "123.456.789-09",
      phone: "(51) 98209-2567",
      zip: "90000-000",
      street: "Rua Teste",
      streetNumber: "10",
      neighborhood: "Centro",
      city: "Porto Alegre",
      state: "rs",
      ...customer,
    },
    items: [{ productId: 1, flavors: [{ flavor: null, quantity: 2 }] }],
    ...overrides,
  };
}

describe("createOrderSchema", () => {
  it("aceita pedido válido e normaliza máscaras, UF e complemento vazio", () => {
    const parsed = createOrderSchema.parse(body({}, { complement: "  " }));
    assert.equal(parsed.customer.document, VALID_CPF);
    assert.equal(parsed.customer.phone, "51982092567");
    assert.equal(parsed.customer.zip, "90000000");
    assert.equal(parsed.customer.state, "RS");
    assert.equal(parsed.customer.complement, undefined);
  });

  it("rejeita CPF inválido", () => {
    const result = createOrderSchema.safeParse(body({}, { document: "111.111.111-11" }));
    assert.equal(result.success, false);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    const result = createOrderSchema.safeParse(body({}, { document: "12345678900" }));
    assert.equal(result.success, false);
  });

  it("PJ exige CNPJ válido e rejeita CPF", () => {
    assert.equal(
      createOrderSchema.safeParse(body({}, { type: "PJ", document: VALID_CNPJ })).success,
      true,
    );
    assert.equal(
      createOrderSchema.safeParse(body({}, { type: "PJ", document: VALID_CPF })).success,
      false,
    );
    assert.equal(
      createOrderSchema.safeParse(body({}, { type: "PF", document: VALID_CNPJ })).success,
      false,
    );
  });

  it("rejeita telefone, CEP e UF inválidos", () => {
    assert.equal(createOrderSchema.safeParse(body({}, { phone: "123" })).success, false);
    assert.equal(createOrderSchema.safeParse(body({}, { zip: "123" })).success, false);
    assert.equal(createOrderSchema.safeParse(body({}, { state: "XX" })).success, false);
  });

  it("exige bairro e demais campos obrigatórios", () => {
    for (const field of ["name", "document", "phone", "zip", "street", "streetNumber", "neighborhood", "city", "state"]) {
      const customer = body().customer as Record<string, unknown>;
      delete customer[field];
      const result = createOrderSchema.safeParse({ ...body(), customer });
      assert.equal(result.success, false, `${field} deveria ser obrigatório`);
    }
  });

  it("rejeita campos desconhecidos (raiz, cliente, item e sabor)", () => {
    assert.equal(createOrderSchema.safeParse(body({ extra: 1 })).success, false);
    assert.equal(createOrderSchema.safeParse(body({}, { extra: 1 })).success, false);
    assert.equal(
      createOrderSchema.safeParse(
        body({ items: [{ productId: 1, price: 1, flavors: [{ flavor: null, quantity: 1 }] }] }),
      ).success,
      false,
    );
    assert.equal(
      createOrderSchema.safeParse(
        body({ items: [{ productId: 1, flavors: [{ flavor: null, quantity: 1, name: "x" }] }] }),
      ).success,
      false,
    );
  });

  it("valida limites de itens, sabores e quantidade", () => {
    const item = { productId: 1, flavors: [{ flavor: null, quantity: 1 }] };
    assert.equal(createOrderSchema.safeParse(body({ items: [] })).success, false);
    assert.equal(createOrderSchema.safeParse(body({ items: Array(50).fill(item) })).success, true);
    assert.equal(createOrderSchema.safeParse(body({ items: Array(51).fill(item) })).success, false);

    const manyFlavors = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ flavor: `S${i}`, quantity: 1 }));
    assert.equal(
      createOrderSchema.safeParse(body({ items: [{ productId: 1, flavors: manyFlavors(30) }] })).success,
      true,
    );
    assert.equal(
      createOrderSchema.safeParse(body({ items: [{ productId: 1, flavors: manyFlavors(31) }] })).success,
      false,
    );

    for (const quantity of [0, -1, 1.5, 10000]) {
      assert.equal(
        createOrderSchema.safeParse(
          body({ items: [{ productId: 1, flavors: [{ flavor: null, quantity }] }] }),
        ).success,
        false,
        `quantidade ${quantity}`,
      );
    }
    assert.equal(
      createOrderSchema.safeParse(
        body({ items: [{ productId: 1, flavors: [{ flavor: null, quantity: 9999 }] }] }),
      ).success,
      true,
    );
  });

  it("limita o tamanho dos textos", () => {
    assert.equal(createOrderSchema.safeParse(body({}, { name: "a".repeat(121) })).success, false);
    assert.equal(createOrderSchema.safeParse(body({}, { street: "a".repeat(151) })).success, false);
  });

  it("valida o formato de requestId", () => {
    assert.equal(
      createOrderSchema.safeParse(body({ requestId: "5f1c2f4e-7a3b-4c8e-9d21-0b6a4e8f1a37" })).success,
      true,
    );
    assert.equal(createOrderSchema.safeParse(body({ requestId: "abc" })).success, false);
  });

  it("mensagens de erro saem em português", () => {
    const result = createOrderSchema.safeParse(body({}, { document: "111.111.111-11" }));
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((issue) => issue.message === "CPF inválido."));
    }
  });
});

describe("listOrdersQuerySchema", () => {
  it("aplica padrões", () => {
    const parsed = listOrdersQuerySchema.parse({});
    assert.equal(parsed.page, 1);
    assert.equal(parsed.limit, 20);
  });

  it("limita limit a 100 e valida status e datas", () => {
    assert.equal(listOrdersQuerySchema.safeParse({ limit: "101" }).success, false);
    assert.equal(listOrdersQuerySchema.safeParse({ limit: "100" }).success, true);
    assert.equal(listOrdersQuerySchema.safeParse({ status: "OUTRO" }).success, false);
    assert.equal(listOrdersQuerySchema.safeParse({ from: "2026-13-40" }).success, false);
    assert.equal(
      listOrdersQuerySchema.safeParse({ from: "2026-01-01", to: "2026-01-31" }).success,
      true,
    );
    assert.equal(
      listOrdersQuerySchema.safeParse({ from: "2026-02-01", to: "2026-01-01" }).success,
      false,
    );
  });
});

describe("updateStatusSchema", () => {
  it("aceita só CANCELED", () => {
    assert.equal(updateStatusSchema.safeParse({ status: "CANCELED" }).success, true);
    assert.equal(updateStatusSchema.safeParse({ status: "CONFIRMED" }).success, false);
    assert.equal(updateStatusSchema.safeParse({ status: "REQUESTED" }).success, false);
  });
});
