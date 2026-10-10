import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import {
  adjustStockSchema,
  createFlavorSchema,
  createProductSchema,
  updateFlavorSchema,
  updateProductSchema,
} from "../../../src/modules/products/products.schema.js";
import { moneySchema } from "../../../src/shared/utils/money.js";

z.config(z.locales.pt());

const base = { name: "Bala", brand: "Fini", categoryId: 1, price: "10,5", unit: "pct 500g" };

describe("moneySchema", () => {
  it("normaliza para 2 casas e aceita vírgula", () => {
    assert.equal(moneySchema.parse("10,5"), "10.50");
    assert.equal(moneySchema.parse(7), "7.00");
    assert.equal(moneySchema.parse("0.99"), "0.99");
    assert.equal(moneySchema.parse(" 12.34 "), "12.34");
  });

  it("rejeita mais de 2 casas, negativo, texto e ponto flutuante impreciso", () => {
    for (const value of ["1.234", "-1", "abc", "", 0.1 + 0.2, "123456789", "1e3"]) {
      assert.equal(moneySchema.safeParse(value).success, false, String(value));
    }
  });
});

describe("createProductSchema", () => {
  it("aplica padrões (mínimo 1, 5 estrelas, ativo, saldo 0, sem sabores)", () => {
    const parsed = createProductSchema.parse(base);
    assert.equal(parsed.price, "10.50");
    assert.equal(parsed.minQty, 1);
    assert.equal(parsed.stars, 5);
    assert.equal(parsed.active, true);
    assert.equal(parsed.initialStock, 0);
    assert.deepEqual(parsed.flavors, []);
  });

  it("aceita saldo inicial e sabores, e limpa texto vazio", () => {
    const parsed = createProductSchema.parse({
      ...base,
      initialStock: 12,
      flavors: ["Morango", "Uva"],
      description: "  ",
      imageUrl: "",
      cost: "4,2",
    });
    assert.equal(parsed.initialStock, 12);
    assert.deepEqual(parsed.flavors, ["Morango", "Uva"]);
    assert.equal(parsed.description, null);
    assert.equal(parsed.imageUrl, null);
    assert.equal(parsed.cost, "4.20");
  });

  it("rejeita sabores repetidos, saldo negativo, estrelas fora de 1..5 e URL não http(s)", () => {
    assert.equal(createProductSchema.safeParse({ ...base, flavors: ["Uva", "uva"] }).success, false);
    assert.equal(createProductSchema.safeParse({ ...base, initialStock: -1 }).success, false);
    assert.equal(createProductSchema.safeParse({ ...base, stars: 6 }).success, false);
    assert.equal(createProductSchema.safeParse({ ...base, imageUrl: "javascript:alert(1)" }).success, false);
    assert.equal(createProductSchema.safeParse({ ...base, minQty: 0 }).success, false);
  });

  it("rejeita campos desconhecidos (modo strict)", () => {
    assert.equal(createProductSchema.safeParse({ ...base, stock: 5 }).success, false);
  });
});

describe("updateProductSchema", () => {
  it("REJEITA stock: o saldo nunca muda por edição", () => {
    const result = updateProductSchema.safeParse({ stock: 99 });
    assert.equal(result.success, false);
    assert.equal(updateProductSchema.safeParse({ name: "X", stock: 99 }).success, false);
  });

  it("aceita atualização parcial e exige ao menos um campo", () => {
    assert.equal(updateProductSchema.safeParse({ active: false }).success, true);
    assert.equal(updateProductSchema.safeParse({}).success, false);
  });

  it("aceita limpar custo e descrição (null)", () => {
    const parsed = updateProductSchema.parse({ cost: null, description: "" });
    assert.equal(parsed.cost, null);
    assert.equal(parsed.description, null);
  });
});

describe("adjustStockSchema", () => {
  it("exige variação inteira diferente de zero e motivo", () => {
    assert.equal(adjustStockSchema.safeParse({ delta: 5, reason: "Reposição" }).success, true);
    assert.equal(adjustStockSchema.safeParse({ delta: -3, reason: "Perda" }).success, true);
    assert.equal(adjustStockSchema.safeParse({ delta: 0, reason: "Nada" }).success, false);
    assert.equal(adjustStockSchema.safeParse({ delta: 1.5, reason: "Meio" }).success, false);
    assert.equal(adjustStockSchema.safeParse({ delta: 5 }).success, false);
    assert.equal(adjustStockSchema.safeParse({ delta: 5, reason: "  " }).success, false);
  });

  it("não aceita o id do administrador no corpo", () => {
    assert.equal(adjustStockSchema.safeParse({ delta: 5, reason: "Reposição", adminId: 1 }).success, false);
  });
});

describe("sabores", () => {
  it("criação exige nome; edição exige algum campo", () => {
    assert.equal(createFlavorSchema.safeParse({ name: "Uva" }).success, true);
    assert.equal(createFlavorSchema.safeParse({ name: "" }).success, false);
    assert.equal(updateFlavorSchema.safeParse({ active: false }).success, true);
    assert.equal(updateFlavorSchema.safeParse({}).success, false);
  });
});
