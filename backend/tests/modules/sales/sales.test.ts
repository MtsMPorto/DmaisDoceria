import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { Prisma } from "../../../src/generated/prisma/client.js";
import {
  createItemSchema,
  createSaleSchema,
  updateItemSchema,
  updateSaleSchema,
} from "../../../src/modules/sales/sales.schema.js";
import {
  assertDiscountFits,
  lineSubtotal,
  pendingOf,
  resolvePayment,
} from "../../../src/modules/sales/sales.rules.js";
import { AppError } from "../../../src/shared/utils/errors.js";

z.config(z.locales.pt());

const D = (value: string) => new Prisma.Decimal(value);

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof AppError ? err.code : "OUTRO";
  }
  return undefined;
}

describe("schemas de venda", () => {
  it("criação: só cliente (o administrador vem do JWT, nunca do corpo)", () => {
    assert.equal(createSaleSchema.safeParse({ customerId: 1 }).success, true);
    assert.equal(createSaleSchema.safeParse({ customerId: 1, createdById: 9 }).success, false);
    assert.equal(createSaleSchema.safeParse({ customerId: 1, status: "CONFIRMED" }).success, false);
  });

  it("edição: valores em reais com 2 casas e pagamento válido", () => {
    const parsed = updateSaleSchema.parse({ discount: "5,5", deliveryFee: 10, paymentStatus: "PARTIAL", paidAmount: "20" });
    assert.equal(parsed.discount, "5.50");
    assert.equal(parsed.deliveryFee, "10.00");
    assert.equal(parsed.paidAmount, "20.00");
    assert.equal(updateSaleSchema.safeParse({ paymentMethod: "cheque" }).success, false);
    assert.equal(updateSaleSchema.safeParse({ discount: "-1" }).success, false);
    assert.equal(updateSaleSchema.safeParse({ total: "10" }).success, false);
    assert.equal(updateSaleSchema.safeParse({}).success, false);
  });

  it("item de catálogo: produto, quantidade e preço opcional", () => {
    assert.equal(createItemSchema.safeParse({ productId: 1, quantity: 3 }).success, true);
    assert.equal(createItemSchema.safeParse({ productId: 1, flavorId: 2, quantity: "3", unitPrice: "9,9" }).success, true);
    assert.equal(createItemSchema.safeParse({ productId: 1, productName: "Outro", quantity: 1 }).success, false);
  });

  it("item avulso: descrição e preço obrigatórios, até 3 casas, sem sabor", () => {
    assert.equal(createItemSchema.safeParse({ productName: "Frete extra", quantity: "1.5", unitPrice: "10" }).success, true);
    assert.equal(createItemSchema.safeParse({ productName: "Frete extra", quantity: "1.5" }).success, false);
    assert.equal(createItemSchema.safeParse({ productName: "X", quantity: "1.2345", unitPrice: "1" }).success, false);
    assert.equal(createItemSchema.safeParse({ productName: "X", quantity: "0", unitPrice: "1" }).success, false);
    assert.equal(createItemSchema.safeParse({ productName: "X", flavorId: 3, quantity: 1, unitPrice: "1" }).success, false);
    assert.equal(createItemSchema.safeParse({ quantity: 1, unitPrice: "1" }).success, false);
  });

  it("edição de item exige algum campo", () => {
    assert.equal(updateItemSchema.safeParse({ quantity: "2" }).success, true);
    assert.equal(updateItemSchema.safeParse({}).success, false);
  });
});

describe("resolvePayment", () => {
  const total = D("100.00");
  const pending = { paymentStatus: "PENDING", paidAmount: D("0") };

  it("PENDING zera o valor recebido e recusa valor", () => {
    assert.equal(resolvePayment({ paymentStatus: "PENDING" }, { paymentStatus: "PARTIAL", paidAmount: D("30") }, total).paidAmount.toFixed(2), "0.00");
    assert.equal(code(() => resolvePayment({ paymentStatus: "PENDING", paidAmount: "10.00" }, pending, total)), "PAYMENT_INVALID");
  });

  it("PAID usa o total; recusa valor diferente", () => {
    assert.equal(resolvePayment({ paymentStatus: "PAID" }, pending, total).paidAmount.toFixed(2), "100.00");
    assert.equal(code(() => resolvePayment({ paymentStatus: "PAID", paidAmount: "90.00" }, pending, total)), "PAYMENT_INVALID");
  });

  it("PARTIAL: maior que zero e menor que o total (exclusivos)", () => {
    assert.equal(resolvePayment({ paymentStatus: "PARTIAL", paidAmount: "40.00" }, pending, total).paidAmount.toFixed(2), "40.00");
    assert.equal(code(() => resolvePayment({ paymentStatus: "PARTIAL", paidAmount: "0.00" }, pending, total)), "PAYMENT_INVALID");
    assert.equal(code(() => resolvePayment({ paymentStatus: "PARTIAL", paidAmount: "100.00" }, pending, total)), "PAYMENT_INVALID");
    assert.equal(code(() => resolvePayment({ paymentStatus: "PARTIAL" }, pending, total)), "PAYMENT_INVALID");
  });

  it("total que muda mantém PAID coerente e quebra PARTIAL que passou do total", () => {
    const paid = { paymentStatus: "PAID", paidAmount: D("100") };
    assert.equal(resolvePayment({}, paid, D("120.00")).paidAmount.toFixed(2), "120.00");
    const partial = { paymentStatus: "PARTIAL", paidAmount: D("80") };
    assert.equal(code(() => resolvePayment({}, partial, D("60.00"))), "PAYMENT_INVALID");
  });
});

describe("regras de valores", () => {
  it("lineSubtotal arredonda a 2 casas (meio para cima)", () => {
    assert.equal(lineSubtotal("3", "10.50").toFixed(2), "31.50");
    assert.equal(lineSubtotal("1.5", "0.33").toFixed(2), "0.50");
    assert.equal(lineSubtotal("2.333", "1.00").toFixed(2), "2.33");
  });

  it("desconto não pode superar o subtotal", () => {
    assert.doesNotThrow(() => assertDiscountFits(D("10"), D("10"), "update"));
    assert.equal(code(() => assertDiscountFits(D("10.01"), D("10"), "update")), "DISCOUNT_TOO_HIGH");
    assert.equal(code(() => assertDiscountFits(D("5"), D("4"), "remove")), "DISCOUNT_TOO_HIGH");
  });

  it("pendente só para vendas confirmadas ou entregues (como v_sales_summary)", () => {
    assert.equal(pendingOf("DRAFT", D("100"), D("0")).toFixed(2), "0.00");
    assert.equal(pendingOf("CANCELED", D("100"), D("0")).toFixed(2), "0.00");
    assert.equal(pendingOf("CONFIRMED", D("100"), D("30")).toFixed(2), "70.00");
    assert.equal(pendingOf("DELIVERED", D("100"), D("100")).toFixed(2), "0.00");
  });
});
