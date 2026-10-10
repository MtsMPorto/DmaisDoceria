import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { call, randomCpf, skipReason, startContext, type TestContext } from "./helpers.js";

// Fluxo completo contra o banco de TESTES: catálogo, saldo, pedido da loja, venda, relatórios.
// Não roda sem DATABASE_URL_TEST (ver helpers.ts).

interface Product { id: number; stock: number; price: string; cost?: string | null; flavors: { id: number; name: string }[] }
interface Sale { id: number; code: string; status: string; total: string; subtotal: string; orderId: number | null; items: { id: number }[] }

describe("integração: catálogo, pedidos, vendas e relatórios", { skip: skipReason }, () => {
  let ctx: TestContext;
  const stamp = Date.now();
  let categoryId: number;
  let product: Product;

  before(async () => {
    ctx = await startContext();
    const category = await call<{ id: number }>(ctx, "POST", "/api/admin/categories", { name: `Cat ${stamp}` });
    assert.equal(category.status, 201);
    categoryId = category.json.id;
  });

  after(async () => {
    await ctx?.close();
  });

  it("cria produto com saldo inicial atribuído ao administrador (movimento OPENING)", async () => {
    const created = await call<Product>(ctx, "POST", "/api/admin/products", {
      name: `Bala ${stamp}`, brand: "Fini", categoryId, price: "10,00", cost: "4,00", unit: "pct",
      minQty: 2, initialStock: 10, flavors: ["Uva", "Morango"],
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.stock, 10);
    product = created.json;

    const movements = await ctx.prisma.stockMovement.findMany({ where: { productId: product.id } });
    assert.equal(movements.length, 1);
    assert.equal(movements[0].kind, "OPENING");
    assert.equal(movements[0].createdById, ctx.adminId);
  });

  it("PATCH rejeita stock; ajuste só por adjust_stock, com motivo", async () => {
    assert.equal((await call(ctx, "PATCH", `/api/admin/products/${product.id}`, { stock: 99 })).status, 400);

    const up = await call<{ stock: number }>(ctx, "POST", `/api/admin/products/${product.id}/stock`, { delta: 5, reason: "Reposição de teste" });
    assert.equal(up.status, 200);
    assert.equal(up.json.stock, 15);

    assert.equal((await call(ctx, "POST", `/api/admin/products/${product.id}/stock`, { delta: -500, reason: "Perda" })).status, 422);
    assert.equal((await call(ctx, "POST", `/api/admin/products/${product.id}/stock`, { delta: 1 })).status, 400);
  });

  it("rota pública não expõe custo nem produtos inativos", async () => {
    const list = await call<Record<string, unknown>[]>(ctx, "GET", "/api/products", undefined, false);
    assert.equal(list.status, 200);
    const found = list.json.find((row) => row.id === product.id);
    assert.ok(found);
    assert.equal("cost" in found, false);

    await call(ctx, "PATCH", `/api/admin/products/${product.id}`, { active: false });
    const hidden = await call<{ id: number }[]>(ctx, "GET", "/api/products", undefined, false);
    assert.equal(hidden.json.some((row) => row.id === product.id), false);
    await call(ctx, "PATCH", `/api/admin/products/${product.id}`, { active: true });
  });

  let orderId: number;
  const requestId = crypto.randomUUID();
  const customer = {
    type: "PF", name: "Cliente Teste", document: randomCpf(), phone: "51982092567", zip: "90000000",
    street: "Rua A", streetNumber: "10", neighborhood: "Centro", city: "Porto Alegre", state: "RS",
  };

  it("pedido da loja: dados oficiais, idempotência por requestId, mínimo e estoque", async () => {
    const first = await call<{ id: number; items: { unitPrice: string; productName: string }[] }>(
      ctx, "POST", "/api/orders", {
        requestId, customer,
        items: [{ productId: product.id, flavors: [{ flavor: "Uva", quantity: 3 }, { flavor: "Morango", quantity: 2 }] }],
      }, false,
    );
    assert.equal(first.status, 201);
    assert.equal(first.json.items[0].unitPrice, "10.00");
    orderId = first.json.id;

    const again = await call<{ id: number }>(ctx, "POST", "/api/orders", {
      requestId, customer, items: [{ productId: product.id, flavors: [{ flavor: "Uva", quantity: 5 }] }],
    }, false);
    assert.equal(again.status, 200);
    assert.equal(again.json.id, orderId);

    const below = await call(ctx, "POST", "/api/orders", {
      customer, items: [{ productId: product.id, flavors: [{ flavor: "Uva", quantity: 1 }] }],
    }, false);
    assert.equal(below.status, 422);

    const above = await call(ctx, "POST", "/api/orders", {
      customer, items: [{ productId: product.id, flavors: [{ flavor: "Uva", quantity: 9999 }] }],
    }, false);
    assert.equal(above.status, 422);

    // Pedido não baixa nem reserva estoque.
    const row = await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id }, select: { stock: true } });
    assert.equal(row.stock, 15);
  });

  let saleId: number;

  it("venda a partir do pedido: confirmar baixa estoque; cancelar devolve uma única vez", async () => {
    const created = await call<Sale>(ctx, "POST", `/api/admin/sales/from-order/${orderId}`);
    assert.equal(created.status, 201);
    assert.equal(created.json.status, "DRAFT");
    assert.equal(created.json.orderId, orderId);
    saleId = created.json.id;

    assert.equal((await call(ctx, "POST", `/api/admin/sales/from-order/${orderId}`)).status, 409);

    const confirmed = await call<Sale>(ctx, "POST", `/api/admin/sales/${saleId}/confirm`);
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.json.status, "CONFIRMED");
    assert.equal((await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 10);
    assert.equal((await ctx.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "CONFIRMED");

    // Pedido com venda confirmada não cancela (regra do banco -> 409).
    assert.equal((await call(ctx, "PATCH", `/api/orders/${orderId}/status`, { status: "CANCELED" })).status, 409);
    // Pedido só aceita CANCELED.
    assert.equal((await call(ctx, "PATCH", `/api/orders/${orderId}/status`, { status: "CONFIRMED" })).status, 400);

    const canceled = await call<Sale>(ctx, "POST", `/api/admin/sales/${saleId}/cancel`);
    assert.equal(canceled.json.status, "CANCELED");
    assert.equal((await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 15);

    const again = await call(ctx, "POST", `/api/admin/sales/${saleId}/cancel`);
    assert.equal(again.status, 200);
    assert.equal((await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 15);
  });

  it("venda entregue não cancela; relatório usa subtotal - desconto das entregues", async () => {
    const customerRow = await ctx.prisma.customer.findUniqueOrThrow({ where: { document: customer.document } });
    const sale = await call<Sale>(ctx, "POST", "/api/admin/sales", { customerId: customerRow.id });
    assert.equal(sale.status, 201);

    const withItem = await call<Sale>(ctx, "POST", `/api/admin/sales/${sale.json.id}/items`, {
      productId: product.id, flavorId: product.flavors[0].id, quantity: 4,
    });
    assert.equal(withItem.status, 201);
    assert.equal(withItem.json.subtotal, "40.00");

    // Desconto acima do subtotal -> 422; abaixo -> ok.
    assert.equal((await call(ctx, "PATCH", `/api/admin/sales/${sale.json.id}`, { discount: "50" })).status, 422);
    const discounted = await call<Sale>(ctx, "PATCH", `/api/admin/sales/${sale.json.id}`, { discount: "5", deliveryFee: "3" });
    assert.equal(discounted.json.total, "38.00");

    assert.equal((await call(ctx, "POST", `/api/admin/sales/${sale.json.id}/confirm`)).status, 200);
    // Itens são imutáveis depois de confirmar.
    assert.equal((await call(ctx, "POST", `/api/admin/sales/${sale.json.id}/items`, { productName: "Avulso", quantity: 1, unitPrice: "1" })).status, 409);

    assert.equal((await call(ctx, "POST", `/api/admin/sales/${sale.json.id}/deliver`)).status, 200);
    assert.equal((await call(ctx, "POST", `/api/admin/sales/${sale.json.id}/cancel`)).status, 409);

    const today = new Date().toISOString().slice(0, 10);
    const report = await call<{ current: { revenue: string; cost: string | null; grossProfit: string | null } }>(
      ctx, "GET", `/api/admin/reports/summary?from=${today}&to=${today}&productIds=${product.id}`,
    );
    assert.equal(report.status, 200);
    assert.equal(report.json.current.revenue, "35.00"); // 40,00 - 5,00 (sem frete)
    assert.equal(report.json.current.cost, "16.00"); // 4 x 4,00
    assert.equal(report.json.current.grossProfit, "19.00");
  });

  it("clientes: documento único (409) e inativação em vez de exclusão", async () => {
    const document = randomCpf();
    const body = { type: "PF", name: "Duplicado", phone: "51999999999", document };
    assert.equal((await call(ctx, "POST", "/api/admin/customers", body)).status, 201);
    assert.equal((await call(ctx, "POST", "/api/admin/customers", body)).status, 409);

    const row = await ctx.prisma.customer.findUniqueOrThrow({ where: { document } });
    const inactive = await call<{ active: boolean }>(ctx, "PATCH", `/api/admin/customers/${row.id}`, { active: false });
    assert.equal(inactive.json.active, false);
  });

  it("rotas administrativas exigem token válido e admin ativo", async () => {
    assert.equal((await call(ctx, "GET", "/api/admin/products", undefined, false)).status, 401);

    await ctx.prisma.adminUser.update({ where: { id: ctx.adminId }, data: { active: false } });
    assert.equal((await call(ctx, "GET", "/api/admin/products")).status, 401);
    await ctx.prisma.adminUser.update({ where: { id: ctx.adminId }, data: { active: true } });
  });
});
