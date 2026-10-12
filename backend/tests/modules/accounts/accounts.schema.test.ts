import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  profileSchema,
  registerSchema,
  resetSchema,
  verifySchema,
} from "../../../src/modules/accounts/accounts.schema.js";
import { isValidCnpj } from "../../../src/shared/utils/document.js";
import {
  matchesHash,
  newCode,
  secretHash,
} from "../../../src/modules/accounts/accounts.crypto.js";

const profile = {
  type: "PF",
  name: "João D'Ávila",
  phone: "(51) 99999-8888",
  zip: "01001-000",
  street: "Praça da Sé",
  streetNumber: "10",
  neighborhood: "Sé",
  city: "São Paulo",
  state: "SP",
};
const registration = {
  ...profile,
  email: "cliente@example.com",
  password: "Senha-teste-123",
  confirmPassword: "Senha-teste-123",
};
describe("cadastro de clientes", () => {
  it("PF não recebe CPF e exige bairro", () => {
    const value = registerSchema.parse(registration);
    assert.equal(value.document, "");
    assert.equal(value.phone, "51999998888");
    assert.equal(value.zip, "01001000");
    assert.equal(
      registerSchema.safeParse({ ...registration, document: "12345678909" })
        .success,
      false,
    );
    assert.equal(
      registerSchema.safeParse({ ...registration, neighborhood: "" }).success,
      false,
    );
  });
  it("rejeita números em nomes humanos, letras no CEP/telefone e campos desconhecidos", () => {
    for (const change of [
      { name: "João 123" },
      { zip: "0100a000" },
      { phone: "51999998888abc" },
      { admin: true },
      { name: "a".repeat(121) },
    ])
      assert.equal(
        registerSchema.safeParse({ ...registration, ...change }).success,
        false,
      );
  });
  it("PJ aceita números comerciais e fantasia/complemento opcionais", () => {
    const value = registerSchema.parse({
      ...registration,
      type: "PJ",
      name: "Doces 123 Ltda",
      document: "12.345.678/0001-95",
      responsibleName: "Maria Silva",
    });
    assert.equal(value.tradeName, "");
    assert.equal(value.complement, "");
    assert.equal(value.document, "12345678000195");
    assert.equal(
      registerSchema.safeParse({ ...value, responsibleName: "Maria 5" })
        .success,
      false,
    );
    assert.equal(
      registerSchema.safeParse({ ...value, document: "12345678000100" })
        .success,
      false,
    );
  });
  it("valida CNPJ alfanumérico conforme cálculo da Receita", () => {
    assert.equal(isValidCnpj("12.ABC.345/01DE-35"), true);
    assert.equal(isValidCnpj("12.ABC.345/01DE-34"), false);
  });
  it("confirma as senhas e impede truncamento silencioso do bcrypt", () => {
    assert.equal(
      registerSchema.safeParse({
        ...registration,
        confirmPassword: "outra senha",
      }).success,
      false,
    );
    assert.equal(
      registerSchema.safeParse({
        ...registration,
        password: "á".repeat(40),
        confirmPassword: "á".repeat(40),
      }).success,
      false,
    );
    assert.equal(
      resetSchema.safeParse({
        resetToken: "a".repeat(64),
        password: "nova-senha",
        confirmPassword: "diferente",
      }).success,
      false,
    );
  });
  it("edição não aceita e-mail nem privilégios; código tem 6 números", () => {
    assert.equal(
      profileSchema.safeParse({ ...profile, email: "novo@example.com" })
        .success,
      false,
    );
    assert.equal(
      profileSchema.safeParse({ ...profile, role: "admin" }).success,
      false,
    );
    assert.equal(
      verifySchema.safeParse({
        challengeId: "93c0fbec-4ce5-4b7e-914c-fabec7a5a50c",
        code: "000123",
      }).success,
      true,
    );
    assert.equal(
      verifySchema.safeParse({
        challengeId: "93c0fbec-4ce5-4b7e-914c-fabec7a5a50c",
        code: "12a456",
      }).success,
      false,
    );
  });
});
describe("códigos de confirmação", () => {
  it("gera seis dígitos e vincula hash ao desafio/segredo", () => {
    for (let i = 0; i < 30; i++) assert.match(newCode(), /^\d{6}$/);
    const hash = secretHash("secret", "challenge:000123");
    assert.equal(
      matchesHash(hash, secretHash("secret", "challenge:000123")),
      true,
    );
    assert.equal(
      matchesHash(hash, secretHash("secret", "other:000123")),
      false,
    );
    assert.equal(
      matchesHash(hash, secretHash("different", "challenge:000123")),
      false,
    );
    assert.equal(matchesHash(hash, ""), false);
  });
});
