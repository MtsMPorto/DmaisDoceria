import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import {
  createCustomerSchema,
  documentProblem,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from "../../../src/modules/customers/customers.schema.js";

z.config(z.locales.pt());

const VALID_CPF = "123.456.789-09";
const VALID_CNPJ = "12.345.678/0001-95";

describe("createCustomerSchema", () => {
  it("aceita PF sem CPF e normaliza telefone", () => {
    const parsed = createCustomerSchema.parse({ type: "PF", name: "Maria", phone: "(51) 98209-2567", document: null });
    assert.equal(parsed.document, null);
    assert.equal(parsed.phone, "51982092567");
  });

  it("documento é opcional (cadastro administrativo)", () => {
    const parsed = createCustomerSchema.parse({ type: "PJ", name: "Doces LTDA", phone: "5133334444" });
    assert.equal(parsed.document, undefined);
  });

  it("valida dígito verificador conforme o tipo", () => {
    assert.equal(createCustomerSchema.safeParse({ type: "PF", name: "A", phone: "5133334444", document: "111.111.111-11" }).success, false);
    assert.equal(createCustomerSchema.safeParse({ type: "PJ", name: "A", phone: "5133334444", document: VALID_CNPJ }).success, true);
    assert.equal(createCustomerSchema.safeParse({ type: "PJ", name: "A", phone: "5133334444", document: VALID_CPF }).success, false);
  });

  it("telefone de 10 a 15 dígitos, CEP com 8, UF válida", () => {
    const ok = { type: "PF", name: "A", phone: "5133334444" } as const;
    assert.equal(createCustomerSchema.safeParse({ ...ok, phone: "12345" }).success, false);
    assert.equal(createCustomerSchema.safeParse({ ...ok, zip: "9000" }).success, false);
    assert.equal(createCustomerSchema.safeParse({ ...ok, zip: "90000-000", state: "rs" }).success, true);
    assert.equal(createCustomerSchema.safeParse({ ...ok, state: "XX" }).success, false);
    assert.equal(createCustomerSchema.safeParse({ ...ok, email: "sem-arroba" }).success, false);
  });

  it("rejeita campos desconhecidos (ex.: code vem do banco)", () => {
    assert.equal(createCustomerSchema.safeParse({ type: "PF", name: "A", phone: "5133334444", code: "CLI-1" }).success, false);
  });
});

describe("updateCustomerSchema / listagem", () => {
  it("permite inativar e exige ao menos um campo", () => {
    assert.equal(updateCustomerSchema.safeParse({ active: false }).success, true);
    assert.equal(updateCustomerSchema.safeParse({}).success, false);
  });

  it("filtros da listagem", () => {
    const parsed = listCustomersQuerySchema.parse({ q: "maria", type: "PF", active: "true", page: "2" });
    assert.equal(parsed.page, 2);
    assert.equal(parsed.limit, 20);
    assert.equal(parsed.active, true);
    assert.equal(listCustomersQuerySchema.safeParse({ limit: "1000" }).success, false);
  });
});

describe("documentProblem", () => {
  it("nulo é aceito; inválido devolve mensagem", () => {
    assert.equal(documentProblem("PF", null), null);
    assert.equal(documentProblem("PF", "12345678909"), "Pessoa física não deve informar documento.");
    assert.equal(documentProblem("PF", "12345678900"), "Pessoa física não deve informar documento.");
    assert.equal(documentProblem("PJ", "12345678000195"), null);
    assert.equal(documentProblem("PJ", "12345678000100"), "CNPJ inválido.");
  });
});
