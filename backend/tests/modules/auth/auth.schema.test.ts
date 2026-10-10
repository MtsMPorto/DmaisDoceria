import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginSchema } from "../../../src/modules/auth/auth.schema.js";

describe("loginSchema", () => {
  it("aceita usuário e senha e apara espaços do usuário", () => {
    const parsed = loginSchema.parse({ username: "  admin  ", password: "senha" });
    assert.equal(parsed.username, "admin");
    assert.equal(parsed.password, "senha");
  });

  it("não altera a senha (espaços fazem parte dela)", () => {
    assert.equal(loginSchema.parse({ username: "a", password: " x " }).password, " x ");
  });

  it("rejeita campos vazios, ausentes e desconhecidos", () => {
    assert.equal(loginSchema.safeParse({ username: "", password: "x" }).success, false);
    assert.equal(loginSchema.safeParse({ username: "a", password: "" }).success, false);
    assert.equal(loginSchema.safeParse({ username: "a" }).success, false);
    assert.equal(loginSchema.safeParse({ username: "a", password: "x", role: "admin" }).success, false);
  });

  it("limita o tamanho", () => {
    assert.equal(loginSchema.safeParse({ username: "a".repeat(51), password: "x" }).success, false);
    assert.equal(loginSchema.safeParse({ username: "a", password: "x".repeat(201) }).success, false);
  });
});
