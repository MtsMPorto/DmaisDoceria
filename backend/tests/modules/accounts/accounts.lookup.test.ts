import assert from "node:assert/strict";
import { after, it, mock } from "node:test";
import {
  lookupZip,
  lookupCnpj,
} from "../../../src/modules/accounts/accounts.lookup.js";
import { AppError } from "../../../src/shared/utils/errors.js";

after(() => mock.restoreAll());
it("consultas distinguem inexistência de indisponibilidade; CEP pode não ter rua", async () => {
  let response = new Response(
    JSON.stringify({
      logradouro: "",
      bairro: "",
      localidade: "Cidade",
      uf: "RS",
    }),
  );
  mock.method(globalThis, "fetch", async () => response.clone());
  assert.deepEqual(await lookupZip("95555000"), {
    street: "",
    neighborhood: "",
    city: "Cidade",
    state: "RS",
  });
  response = new Response(JSON.stringify({ erro: true }));
  await assert.rejects(
    lookupZip("99999999"),
    (e: unknown) => e instanceof AppError && e.code === "INVALID_ZIP",
  );
  response = new Response("offline", { status: 503 });
  await assert.rejects(
    lookupZip("01001000"),
    (e: unknown) => e instanceof AppError && e.code === "LOOKUP_UNAVAILABLE",
  );
  response = new Response("not found", { status: 404 });
  await assert.rejects(
    lookupCnpj("12345678000195"),
    (e: unknown) => e instanceof AppError && e.message === "CNPJ inválido",
  );
  response = new Response("offline", { status: 503 });
  await assert.rejects(
    lookupCnpj("98765432000198"),
    (e: unknown) => e instanceof AppError && e.code === "LOOKUP_UNAVAILABLE",
  );
  await assert.rejects(
    lookupCnpj("12345678000100"),
    (e: unknown) => e instanceof AppError && e.message === "CNPJ inválido",
  );
});
