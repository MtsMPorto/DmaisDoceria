import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidCnpj, isValidCpf, onlyDigits } from "../../../src/shared/utils/document.js";

function generateCpf(base: string): string {
  const w1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const digit = (digits: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = digit(base, w1);
  const d2 = digit(base + d1, w2);
  return `${base}${d1}${d2}`;
}

function generateCnpj(base: string): string {
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digit = (digits: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = digit(base, w1);
  const d2 = digit(base + d1, w2);
  return `${base}${d1}${d2}`;
}

const CPF_BASES = ["123456789", "987654321", "246813579", "100200300", "314159265"];
const CNPJ_BASES = ["123456780001", "987654320001", "246813570001", "112233440001", "314159260001"];

function corrupt(value: string): string {
  const last = Number(value[value.length - 1]);
  return value.slice(0, -1) + String((last + 1) % 10);
}

describe("onlyDigits", () => {
  it("remove máscara", () => {
    assert.equal(onlyDigits("123.456.789-09"), "12345678909");
    assert.equal(onlyDigits("(51) 98209-2567"), "51982092567");
  });
});

describe("isValidCpf", () => {
  for (const base of CPF_BASES) {
    const cpf = generateCpf(base);
    it(`aceita ${cpf} (gerado), com e sem máscara`, () => {
      assert.equal(isValidCpf(cpf), true);
      const masked = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
      assert.equal(isValidCpf(masked), true);
    });
    it(`rejeita ${cpf} com dígito verificador errado`, () => {
      assert.equal(isValidCpf(corrupt(cpf)), false);
    });
  }

  it("rejeita sequências repetidas", () => {
    for (let d = 0; d <= 9; d++) assert.equal(isValidCpf(String(d).repeat(11)), false);
  });

  it("rejeita tamanho errado e texto", () => {
    assert.equal(isValidCpf(""), false);
    assert.equal(isValidCpf("1234567890"), false);
    assert.equal(isValidCpf("123456789012"), false);
    assert.equal(isValidCpf("abc"), false);
  });
});

describe("isValidCnpj", () => {
  for (const base of CNPJ_BASES) {
    const cnpj = generateCnpj(base);
    it(`aceita ${cnpj} (gerado), com e sem máscara`, () => {
      assert.equal(isValidCnpj(cnpj), true);
      const masked = `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
      assert.equal(isValidCnpj(masked), true);
    });
    it(`rejeita ${cnpj} com dígito verificador errado`, () => {
      assert.equal(isValidCnpj(corrupt(cnpj)), false);
    });
  }

  it("rejeita sequências repetidas", () => {
    for (let d = 0; d <= 9; d++) assert.equal(isValidCnpj(String(d).repeat(14)), false);
  });

  it("rejeita tamanho errado e texto", () => {
    assert.equal(isValidCnpj(""), false);
    assert.equal(isValidCnpj("1234567800012"), false);
    assert.equal(isValidCnpj("abc"), false);
  });
});
