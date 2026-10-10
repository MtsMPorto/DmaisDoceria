import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CreateOrderInput } from "../../../src/modules/orders/orders.schema.js";
import {
  canTransition,
  checkItems,
  mergeItems,
  type CatalogProduct,
} from "../../../src/modules/orders/orders.rules.js";

function product(overrides: Partial<CatalogProduct> & { id: number }): CatalogProduct {
  return {
    name: `Produto ${overrides.id}`,
    brand: "Marca",
    unit: "un",
    minQty: 1,
    stock: 100,
    active: true,
    price: { toString: () => "10.00" },
    flavors: [],
    ...overrides,
  };
}

const chocolate = product({
  id: 1,
  name: "Chocolate",
  minQty: 5,
  flavors: [
    { id: 11, name: "Chocolate Branco" },
    { id: 12, name: "Chocolate Meio Amargo" },
  ],
});
const bala = product({ id: 2, name: "Bala", minQty: 3 });

const catalog = new Map<number, CatalogProduct>([
  [1, chocolate],
  [2, bala],
  [3, product({ id: 3, name: "Inativo", active: false })],
  [4, product({ id: 4, name: "Sem estoque", stock: 0 })],
]);

type Items = CreateOrderInput["items"];

function run(items: Items) {
  return checkItems(mergeItems(items), catalog);
}

describe("mergeItems", () => {
  it("junta o mesmo produto e soma o mesmo sabor", () => {
    const merged = mergeItems([
      { productId: 1, flavors: [{ flavor: "Chocolate Branco", quantity: 2 }] },
      {
        productId: 1,
        flavors: [
          { flavor: "Chocolate Branco", quantity: 3 },
          { flavor: "Chocolate Meio Amargo", quantity: 1 },
        ],
      },
      { productId: 2, flavors: [{ flavor: null, quantity: 4 }] },
    ]);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].flavors.get("Chocolate Branco"), 5);
    assert.equal(merged[0].flavors.get("Chocolate Meio Amargo"), 1);
    assert.equal(merged[1].flavors.get(null), 4);
  });
});

describe("checkItems", () => {
  it("aceita produto com sabores", () => {
    const { problems, lines } = run([
      {
        productId: 1,
        flavors: [
          { flavor: "Chocolate Branco", quantity: 2 },
          { flavor: "Chocolate Meio Amargo", quantity: 5 },
        ],
      },
    ]);
    assert.deepEqual(problems, []);
    assert.equal(lines[0].totalQuantity, 7);
    assert.equal(lines[0].flavors[0].flavor?.id, 11);
  });

  it("aceita produto sem sabores", () => {
    const { problems, lines } = run([{ productId: 2, flavors: [{ flavor: null, quantity: 3 }] }]);
    assert.deepEqual(problems, []);
    assert.equal(lines[0].totalQuantity, 3);
    assert.equal(lines[0].flavors[0].flavor, null);
  });

  it("INVALID_FLAVOR: sabor inexistente (comparação exata)", () => {
    const { problems, lines } = run([
      { productId: 1, flavors: [{ flavor: "chocolate branco", quantity: 9 }] },
    ]);
    assert.equal(problems[0].code, "INVALID_FLAVOR");
    assert.equal(lines.length, 0);
  });

  it("INVALID_FLAVOR: sabor enviado para produto sem sabores", () => {
    const { problems } = run([{ productId: 2, flavors: [{ flavor: "Morango", quantity: 5 }] }]);
    assert.equal(problems[0].code, "INVALID_FLAVOR");
  });

  it("FLAVOR_REQUIRED: produto com sabores sem escolher sabor", () => {
    const { problems } = run([{ productId: 1, flavors: [{ flavor: null, quantity: 6 }] }]);
    assert.equal(problems[0].code, "FLAVOR_REQUIRED");
  });

  it("BELOW_MIN: soma dos sabores abaixo do mínimo", () => {
    const { problems } = run([
      {
        productId: 1,
        flavors: [
          { flavor: "Chocolate Branco", quantity: 2 },
          { flavor: "Chocolate Meio Amargo", quantity: 2 },
        ],
      },
    ]);
    assert.equal(problems[0].code, "BELOW_MIN");
  });

  it("BELOW_MIN usa a soma depois de juntar duplicidades", () => {
    const { problems, lines } = run([
      { productId: 2, flavors: [{ flavor: null, quantity: 1 }] },
      { productId: 2, flavors: [{ flavor: null, quantity: 2 }] },
    ]);
    assert.deepEqual(problems, []);
    assert.equal(lines[0].totalQuantity, 3);
  });

  it("UNAVAILABLE: produto inativo", () => {
    const { problems } = run([{ productId: 3, flavors: [{ flavor: null, quantity: 1 }] }]);
    assert.equal(problems[0].code, "UNAVAILABLE");
  });

  it("UNAVAILABLE: produto inexistente", () => {
    const { problems } = run([{ productId: 999, flavors: [{ flavor: null, quantity: 1 }] }]);
    assert.equal(problems[0].code, "UNAVAILABLE");
  });

  it("OUT_OF_STOCK: estoque zero", () => {
    const { problems } = run([{ productId: 4, flavors: [{ flavor: null, quantity: 1 }] }]);
    assert.equal(problems[0].code, "OUT_OF_STOCK");
  });

  it("OUT_OF_STOCK: quantidade acima do estoque (o banco também recusa)", () => {
    const { problems } = run([{ productId: 2, flavors: [{ flavor: null, quantity: 101 }] }]);
    assert.equal(problems[0].code, "OUT_OF_STOCK");
  });

  it("aceita quantidade igual ao estoque", () => {
    const { problems, lines } = run([{ productId: 2, flavors: [{ flavor: null, quantity: 100 }] }]);
    assert.deepEqual(problems, []);
    assert.equal(lines.length, 1);
  });

  it("lista problemas por item e não aceita nada se houver algum", () => {
    const { problems, lines } = run([
      { productId: 2, flavors: [{ flavor: null, quantity: 3 }] },
      { productId: 3, flavors: [{ flavor: null, quantity: 1 }] },
      { productId: 4, flavors: [{ flavor: null, quantity: 1 }] },
    ]);
    assert.deepEqual(
      problems.map((p) => [p.productId, p.code]),
      [
        [3, "UNAVAILABLE"],
        [4, "OUT_OF_STOCK"],
      ],
    );
    assert.equal(lines.length, 1);
  });
});

describe("canTransition", () => {
  it("permite só REQUESTED→CANCELED", () => {
    assert.equal(canTransition("REQUESTED", "CANCELED"), true);
  });

  it("recusa REQUESTED→CONFIRMED manual e CONFIRMED→CANCELED", () => {
    assert.equal(canTransition("REQUESTED", "CONFIRMED"), false);
    assert.equal(canTransition("CONFIRMED", "CANCELED"), false);
  });

  it("recusa as demais", () => {
    assert.equal(canTransition("CONFIRMED", "CONFIRMED"), false);
    assert.equal(canTransition("CANCELED", "CONFIRMED"), false);
    assert.equal(canTransition("CANCELED", "CANCELED"), false);
    assert.equal(canTransition("CONFIRMED", "REQUESTED"), false);
    assert.equal(canTransition("CANCELED", "REQUESTED"), false);
  });
});
