import assert from "node:assert/strict";
import { after, it } from "node:test";
import { hashSync, compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { secretHash } from "../../../src/modules/accounts/accounts.crypto.js";

// Blindagem: mesmo uma chamada não simulada só poderia tentar localhost:9.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:9/test";
process.env.JWT_SECRET = "test-only-secret-never-used-in-production-000000";
process.env.RESEND_API_KEY = "test-only-key";
process.env.ACCOUNT_EMAIL_FROM = "Teste <test@example.com>";
const { prisma } = await import("../../../src/config/prisma.js");
const service =
  await import("../../../src/modules/accounts/accounts.service.js");
const { requireAuth } = await import("../../../src/shared/middlewares/auth.js");
const { requireCustomer } =
  await import("../../../src/modules/accounts/accounts.middleware.js");
const restores: Array<() => void> = [];
function replaceMethod(object: object, key: string, replacement: unknown) {
  const target = object as Record<string, unknown>;
  const previous = target[key];
  target[key] = replacement;
  assert.equal(target[key], replacement);
  restores.push(() => {
    target[key] = previous;
  });
}
after(async () => {
  restores.reverse().forEach((restore) => restore());
  await prisma.$disconnect();
});

it("sessões: cliente não vira admin; códigos expiram, têm limite e não podem ser reutilizados", async () => {
  const key = process.env.JWT_SECRET!;
  const customer = {
    id: 1,
    type: "PF",
    name: "Maria Silva",
    active: true,
    email: "maria@example.com",
    document: null,
    phone: "51999998888",
    zip: "01001000",
    street: "Rua",
    streetNumber: "1",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
  };
  const account = {
    id: 1,
    email: customer.email,
    passwordHash: hashSync("old-password", 4),
    customerId: 1,
    customer,
    verifiedAt: new Date(),
    sessionVersion: 0,
    failedAttempts: 0,
    lockedUntil: null as Date | null,
  };
  type Challenge = {
    id: string;
    accountId: number;
    purpose: string;
    email: string;
    codeHash: string;
    attempts: number;
    expiresAt: Date;
    verifiedAt: Date | null;
    resetHash: string | null;
  };
  let row: Challenge | null = null;
  const makeRow = (purpose = "recovery"): Challenge => ({
    id: "93c0fbec-4ce5-4b7e-914c-fabec7a5a50c",
    accountId: 1,
    purpose,
    email: account.email,
    codeHash: secretHash(key, "93c0fbec-4ce5-4b7e-914c-fabec7a5a50c:000123"),
    attempts: 0,
    expiresAt: new Date(Date.now() + 60_000),
    verifiedAt: null,
    resetHash: null,
  });
  replaceMethod(prisma.adminUser, "findUnique", async () => null);
  replaceMethod(
    prisma.customerAccount,
    "findUnique",
    async () => account as never,
  );
  const applyAccount = (data: Record<string, unknown>) => {
    if (typeof data.passwordHash === "string")
      account.passwordHash = data.passwordHash;
    if (typeof data.email === "string") account.email = data.email;
    if (data.sessionVersion) account.sessionVersion++;
    if (typeof data.failedAttempts === "number")
      account.failedAttempts = data.failedAttempts;
    if ("lockedUntil" in data)
      account.lockedUntil = data.lockedUntil as Date | null;
    return account;
  };
  const tx = {
    $queryRaw: async () => [],
    customerAccount: {
      findUniqueOrThrow: async () => account,
      findUnique: async () => null,
      update: async ({ data }: { data: Record<string, unknown> }) =>
        applyAccount(data),
    },
    accountChallenge: {
      findUnique: async ({
        where,
      }: {
        where: { id?: string; resetHash?: string };
      }) =>
        row &&
        (!where.id || row.id === where.id) &&
        (!where.resetHash || row.resetHash === where.resetHash)
          ? row
          : null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        assert.ok(row);
        if (data.attempts) row.attempts++;
        if (data.verifiedAt) row.verifiedAt = data.verifiedAt as Date;
        if (data.resetHash) row.resetHash = data.resetHash as string;
        if (data.expiresAt) row.expiresAt = data.expiresAt as Date;
        return row;
      },
      deleteMany: async () => {
        row = null;
        return { count: 1 };
      },
    },
    customer: { update: async () => customer },
  };
  replaceMethod(prisma, "$transaction", (async (callback: unknown) =>
    (callback as (db: typeof tx) => Promise<unknown>)(tx)) as never);
  replaceMethod(prisma.customerAccount, "update", (async ({
    data,
  }: {
    data: Record<string, unknown>;
  }) => applyAccount(data)) as never);
  let queries = 0;
  replaceMethod(prisma.adminUser, "findFirst", async () => {
    queries++;
    return { id: 1, name: "Admin", username: "admin" } as never;
  });
  const request = (token: string) =>
    ({ headers: { authorization: `Bearer ${token}` } }) as Request;
  const response = { locals: {} } as Response;
  const customerToken = jwt.sign(
    { sub: "1", role: "customer", version: 0 },
    key,
    { audience: "customer-account", expiresIn: "1d" },
  );
  await assert.rejects(
    requireAuth(request(customerToken), response, (() => {}) as NextFunction),
    /Token/,
  );
  assert.equal(
    queries,
    0,
    "cliente deve ser rejeitado antes de consultar admin de mesmo id",
  );
  const adminToken = jwt.sign({ sub: "1", role: "admin" }, key, {
    expiresIn: "1d",
  });
  await assert.rejects(
    requireCustomer(request(adminToken), response, (() => {}) as NextFunction),
  );
  let next = false;
  await requireCustomer(request(customerToken), response, (() => {
    next = true;
  }) as NextFunction);
  assert.equal(next, true);

  row = makeRow();
  row.expiresAt = new Date(0);
  await assert.rejects(service.verify(row.id, "000123"), /Código inválido/);
  row = makeRow();
  const id = row.id;
  for (let i = 0; i < 5; i++)
    await assert.rejects(service.verify(id, "999999"), /Código inválido/);
  assert.equal(row.attempts, 5);
  await assert.rejects(service.verify(id, "000123"), /Código inválido/);
  row = makeRow();
  const result = await service.verify(id, "000123");
  assert.equal(result.purpose, "recovery");
  assert.ok("resetToken" in result && result.resetToken);
  assert.equal("code" in result, false);
  assert.notEqual(row.resetHash, result.resetToken);
  await assert.rejects(service.verify(id, "000123"), /Código inválido/);
  await service.resetPassword(result.resetToken!, "new-password");
  assert.equal(await compare("new-password", account.passwordHash), true);
  assert.equal(account.sessionVersion, 1);
  assert.equal(row, null);
  await assert.rejects(
    service.resetPassword(result.resetToken!, "other-password"),
    /Código inválido/,
  );
  await assert.rejects(
    requireCustomer(
      request(customerToken),
      response,
      (() => {}) as NextFunction,
    ),
    /sessão expirou/,
  );
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      service.login(account.email, "wrong-password"),
      /incorretos/,
    );
  assert.ok(account.lockedUntil && account.lockedUntil.getTime() > Date.now());
  await assert.rejects(
    service.login(account.email, "new-password"),
    /incorretos/,
  );
  account.lockedUntil = null;
  const login = await service.login(account.email, "new-password");
  assert.equal(login.role, "customer");
  assert.ok("token" in login);
  row = makeRow("email");
  row.email = "novo@example.com";
  await assert.rejects(service.verify(id, "000123", 2), /Código inválido/);
  assert.equal(account.email, "maria@example.com");
});

it("cadastro: envia código só pelo e-mail, não libera acesso antes de verificar e protege ficha existente", async () => {
  // Simulação das operações de persistência para testar o fluxo do serviço sem rede.
  // O arquivo accounts.database.test.ts cobre separadamente o SQL real.
  type Row = Record<string, any>;
  let account: Row | null = null,
    challenge: Row | null = null,
    customer: Row | null = null;
  let candidates: Row[] = [];
  let sentCode = "",
    deliveries = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    if (String(input).includes("viacep"))
      return new Response(
        JSON.stringify({
          logradouro: "Rua",
          bairro: "Centro",
          localidade: "São Paulo",
          uf: "SP",
        }),
      );
    if (String(input).includes("brasilapi"))
      return new Response(
        JSON.stringify({
          cnpj: "12345678000195",
          razao_social: "Empresa 123",
          nome_fantasia: "",
        }),
      );
    assert.equal(String(input), "https://api.resend.com/emails");
    const payload = JSON.parse(String(options?.body));
    sentCode = /código é (\d{6})/.exec(payload.text)![1];
    deliveries++;
    return new Response(JSON.stringify({ id: "test-email-id" }));
  };
  restores.push(() => {
    globalThis.fetch = originalFetch;
  });
  const accountModel = {
    findUnique: async () => account,
    findUniqueOrThrow: async () => {
      assert.ok(account);
      return account;
    },
    create: async ({ data }: { data: Row }) =>
      (account = {
        ...data,
        id: 1,
        verifiedAt: null,
        customerId: null,
        sessionVersion: 0,
        failedAttempts: 0,
        lockedUntil: null,
      }),
    update: async ({ data }: { data: Row }) => {
      assert.ok(account);
      const version = account.sessionVersion;
      Object.assign(account, data);
      if (data.sessionVersion) account.sessionVersion = version + 1;
      account.customer = customer;
      return account;
    },
  };
  const tx = {
    $queryRaw: async () => [],
    customerAccount: accountModel,
    customer: {
      findMany: async () => candidates,
      findUniqueOrThrow: async () => candidates[0],
      create: async ({ data }: { data: Row }) =>
        (customer = { ...data, id: 10, active: true }),
      update: async ({ data }: { data: Row }) =>
        (customer = { ...candidates[0], ...data }),
    },
    accountChallenge: {
      findUnique: async ({ where }: { where: Row }) =>
        where.id && challenge?.id !== where.id ? null : challenge,
      create: async ({ data }: { data: Row }) =>
        (challenge = {
          ...data,
          attempts: 0,
          createdAt: new Date(),
          verifiedAt: null,
        }),
      deleteMany: async () => {
        challenge = null;
        return { count: 1 };
      },
      update: async ({ data }: { data: Row }) => {
        assert.ok(challenge);
        Object.assign(challenge, data);
        return challenge;
      },
    },
  };
  replaceMethod(prisma, "$transaction", async (callback: unknown) =>
    (callback as (db: typeof tx) => Promise<unknown>)(tx),
  );
  replaceMethod(prisma.customerAccount, "findUnique", accountModel.findUnique);
  const input = {
    type: "PF" as const,
    name: "Maria Silva",
    tradeName: "",
    responsibleName: "",
    document: "",
    phone: "51999998888",
    email: "maria@example.com",
    zip: "01001000",
    street: "Rua",
    streetNumber: "1",
    complement: "",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP" as const,
    password: "test-password",
  };
  const registered = await service.register(input);
  assert.deepEqual(Object.keys(registered), ["challengeId"]);
  assert.equal(deliveries, 1);
  assert.match(sentCode, /^\d{6}$/);
  assert.equal((account as Row | null)?.verifiedAt, null);
  assert.equal(
    customer,
    null,
    "cliente comercial só deve ser criado após confirmação",
  );
  assert.notEqual((challenge as Row | null)?.codeHash, sentCode);
  const verified = await service.verify(registered.challengeId, sentCode);
  assert.deepEqual(verified, { purpose: "signup" });
  assert.ok((account as Row | null)?.verifiedAt);
  assert.equal((customer as Row | null)?.document, null);
  await assert.rejects(
    service.verify(registered.challengeId, sentCode),
    /Código inválido/,
  );
  await assert.rejects(service.register(input), /já está cadastrado/);
  const login = await service.login(input.email, input.password);
  assert.equal(login.role, "customer");
  account = null;
  challenge = null;
  customer = null;
  candidates = [
    {
      id: 7,
      type: "PJ",
      active: true,
      document: "12345678000195",
      email: "outro@example.com",
      account: null,
    },
  ];
  const pj = {
    ...input,
    type: "PJ" as const,
    name: "Empresa 123",
    document: "12345678000195",
    responsibleName: "Maria Silva",
  };
  await assert.rejects(service.register(pj), /suporte@dmaisdoceria.com/);
  assert.equal(
    deliveries,
    1,
    "não pode enviar código para tomar ficha de outro e-mail",
  );
  candidates[0].email = input.email;
  const linked = await service.register(pj);
  await service.verify(linked.challengeId, sentCode);
  assert.equal(
    (account as Row | null)?.customerId,
    7,
    "deve reutilizar a ficha comercial verificada",
  );
});
