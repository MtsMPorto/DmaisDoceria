import { randomBytes, randomUUID } from "node:crypto";
import { compare, hash, hashSync } from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { Prisma, type CustomerAccount } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/errors.js";
import { login as adminLogin } from "../auth/auth.service.js";
import { findAdminByUsername } from "../auth/auth.repository.js";
import { profileSchema, type ProfileInput } from "./accounts.schema.js";
import { lookupCnpj, lookupZip } from "./accounts.lookup.js";
import { matchesHash, newCode, secretHash } from "./accounts.crypto.js";
import { requireMailConfiguration, sendAccountEmail } from "./accounts.mail.js";

type Tx = Prisma.TransactionClient;
type Purpose = "signup" | "recovery" | "email";
const digest = (value: string) => secretHash(env.jwtSecret, value);
const dummy = hashSync("customer-account-timing-placeholder", 10);
const invalidLogin = () =>
  new AppError(401, "INVALID_CREDENTIALS", "Usuário ou senha incorretos.");
const invalidCode = () =>
  new AppError(
    400,
    "INVALID_CODE",
    "Código inválido ou expirado. Solicite um novo código.",
  );
const emailExists = () =>
  new AppError(409, "EMAIL_EXISTS", "Esse e-mail já está cadastrado.");
const support = () =>
  new AppError(
    409,
    "CUSTOMER_LINK_REQUIRED",
    "Esse cadastro já existe. Entre em contato com suporte@dmaisdoceria.com para conferir o e-mail cadastrado.",
  );

const profileSelect = {
  id: true,
  type: true,
  name: true,
  tradeName: true,
  responsibleName: true,
  document: true,
  phone: true,
  email: true,
  zip: true,
  street: true,
  streetNumber: true,
  complement: true,
  neighborhood: true,
  city: true,
  state: true,
} satisfies Prisma.CustomerSelect;
export async function getProfile(accountId: number) {
  const account = await prisma.customerAccount.findUnique({
    where: { id: accountId },
    select: { email: true, customer: { select: profileSelect } },
  });
  if (!account?.customer) throw invalidLogin();
  return {
    ...account.customer,
    email: account.email,
    document: account.customer.type === "PF" ? null : account.customer.document,
  };
}
function customerData(profile: ProfileInput) {
  return {
    ...profile,
    document: profile.type === "PF" ? null : profile.document,
    tradeName: profile.type === "PJ" ? profile.tradeName || null : null,
    responsibleName: profile.type === "PJ" ? profile.responsibleName : null,
  };
}
async function validateLookups(profile: ProfileInput) {
  await lookupZip(profile.zip);
  if (profile.type === "PJ") await lookupCnpj(profile.document);
}
async function eligibleCustomer(tx: Tx, profile: ProfileInput, email: string) {
  // Never claim a commercial record just by knowing its CNPJ or phone.
  const candidates = await tx.customer.findMany({
    where:
      profile.type === "PJ"
        ? { document: profile.document }
        : { email: { equals: email, mode: "insensitive" } },
    include: { account: { select: { id: true } } },
    take: 2,
  });
  if (candidates.length > 1) throw support();
  let customer = candidates[0];
  if (customer) {
    await tx.$queryRaw`SELECT id FROM public.customers WHERE id = ${customer.id} FOR UPDATE`;
    customer = await tx.customer.findUniqueOrThrow({
      where: { id: customer.id },
      include: { account: { select: { id: true } } },
    });
  }
  if (
    customer &&
    (customer.account ||
      !customer.active ||
      customer.type !== profile.type ||
      customer.email?.trim().toLowerCase() !== email)
  )
    throw support();
  return customer;
}
async function lockAccount(tx: Tx, id: number) {
  await tx.$queryRaw`SELECT id FROM public.customer_accounts WHERE id = ${id} FOR UPDATE`;
}
async function challenge(
  tx: Tx,
  account: CustomerAccount,
  purpose: Purpose,
  email = account.email,
) {
  const previous = await tx.accountChallenge.findUnique({
    where: { accountId_purpose: { accountId: account.id, purpose } },
  });
  if (previous && Date.now() - previous.createdAt.getTime() < 60_000)
    throw new AppError(
      429,
      "CODE_COOLDOWN",
      "Aguarde um minuto antes de solicitar outro código.",
    );
  const id = randomUUID(),
    code = newCode();
  await tx.accountChallenge.deleteMany({
    where: { accountId: account.id, purpose },
  });
  await tx.accountChallenge.create({
    data: {
      id,
      accountId: account.id,
      purpose,
      email,
      codeHash: digest(`${id}:${code}`),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  return { id, code, email };
}
async function deliver(value: { id: string; code: string; email: string }) {
  await sendAccountEmail(
    value.email,
    "Seu código de verificação — D'mais",
    `Seu código é ${value.code}.\n\nEle expira em 10 minutos e só pode ser usado uma vez. Não compartilhe este código.\nSe não solicitou esta operação, ignore esta mensagem.\n\nD'mais Doceria`,
  );
  return { challengeId: value.id };
}
export async function register(
  input: ProfileInput & { email: string; password: string },
) {
  requireMailConfiguration();
  await validateLookups(input);
  const passwordHash = await hash(input.password, 12);
  const profile = profileSchema.parse(
    Object.fromEntries(
      Object.entries(input).filter(
        ([key]) => !["email", "password", "confirmPassword"].includes(key),
      ),
    ),
  );
  const value = await prisma.$transaction(async (tx) => {
    // Serializes registration for the same e-mail, including pending accounts.
    // PostgreSQL returns void for this lock; cast it so Prisma can deserialize it.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.email}))::text`;
    const existing = await tx.customerAccount.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      await lockAccount(tx, existing.id);
      const current = await tx.customerAccount.findUniqueOrThrow({
        where: { id: existing.id },
      });
      if (current.verifiedAt) throw emailExists();
    }
    await eligibleCustomer(tx, profile, input.email);
    const account = existing
      ? await tx.customerAccount.update({
          where: { id: existing.id },
          data: { passwordHash, pendingProfile: profile },
        })
      : await tx.customerAccount.create({
          data: { email: input.email, passwordHash, pendingProfile: profile },
        });
    return challenge(tx, account, "signup");
  });
  return deliver(value);
}
function tokenFor(account: CustomerAccount) {
  return jwt.sign(
    {
      sub: String(account.id),
      role: "customer",
      version: account.sessionVersion,
    },
    env.jwtSecret,
    { algorithm: "HS256", audience: "customer-account", expiresIn: "1d" },
  );
}
export async function login(username: string, password: string) {
  if (await findAdminByUsername(username))
    return {
      ...(await adminLogin({ username, password })),
      role: "admin" as const,
    };
  const account = await prisma.customerAccount.findUnique({
    where: { email: username.toLowerCase() },
  });
  const ok = await compare(password, account?.passwordHash ?? dummy);
  if (!account) throw invalidLogin();
  const result = await prisma.$transaction(async (tx) => {
    await lockAccount(tx, account.id);
    const current = await tx.customerAccount.findUniqueOrThrow({
      where: { id: account.id },
      include: { customer: { select: { active: true } } },
    });
    if (current.lockedUntil && current.lockedUntil.getTime() > Date.now())
      return null;
    if (!ok || current.passwordHash !== account.passwordHash) {
      const attempts = current.failedAttempts + 1;
      await tx.customerAccount.update({
        where: { id: account.id },
        data: {
          failedAttempts: attempts >= 5 ? 0 : attempts,
          lockedUntil:
            attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
        },
      });
      return null;
    }
    if (current.verifiedAt && !current.customer?.active) return null;
    await tx.customerAccount.update({
      where: { id: account.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    return current;
  });
  if (!result) throw invalidLogin();
  if (!result.verifiedAt) {
    requireMailConfiguration();
    const value = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, result.id);
      return challenge(tx, result, "signup");
    });
    return {
      role: "pending" as const,
      ...(await deliver(value)),
      email: result.email,
    };
  }
  return {
    role: "customer" as const,
    token: tokenFor(result),
    profile: await getProfile(result.id),
  };
}
export async function recover(email: string) {
  requireMailConfiguration();
  const account = await prisma.customerAccount.findUnique({
    where: { email },
    include: { customer: { select: { active: true } } },
  });
  if (!account?.verifiedAt || !account.customer?.active)
    return { challengeId: randomUUID() };
  const value = await prisma.$transaction(async (tx) => {
    await lockAccount(tx, account.id);
    return challenge(tx, account, "recovery");
  });
  return deliver(value);
}
export async function resend(challengeId: string, accountId?: number) {
  requireMailConfiguration();
  const previous = await prisma.accountChallenge.findUnique({
    where: { id: challengeId },
  });
  if (
    !previous ||
    (previous.purpose === "email" && previous.accountId !== accountId)
  )
    return { challengeId: randomUUID() };
  const value = await prisma.$transaction(async (tx) => {
    await lockAccount(tx, previous.accountId);
    const current = await tx.accountChallenge.findUnique({
      where: { id: challengeId },
    });
    if (!current) throw invalidCode();
    const account = await tx.customerAccount.findUniqueOrThrow({
      where: { id: previous.accountId },
    });
    if (previous.purpose === "signup" && account.verifiedAt)
      throw invalidCode();
    if (current.purpose !== "email" && current.email !== account.email)
      throw invalidCode();
    return challenge(tx, account, current.purpose as Purpose, current.email);
  });
  return deliver(value);
}
export async function verify(
  challengeId: string,
  code: string,
  accountId?: number,
) {
  // Failed attempts commit instead of being rolled back by an exception.
  const result = await prisma.$transaction(async (tx) => {
    const reference = await tx.accountChallenge.findUnique({
      where: { id: challengeId },
    });
    if (!reference) return null;
    await lockAccount(tx, reference.accountId);
    const row = await tx.accountChallenge.findUnique({
      where: { id: challengeId },
    });
    if (
      !row ||
      row.verifiedAt ||
      row.expiresAt.getTime() <= Date.now() ||
      row.attempts >= 5 ||
      (row.purpose === "email" && row.accountId !== accountId)
    )
      return null;
    if (!matchesHash(row.codeHash, digest(`${row.id}:${code}`))) {
      await tx.accountChallenge.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      return null;
    }
    const account = await tx.customerAccount.findUniqueOrThrow({
      where: { id: row.accountId },
    });
    if (row.purpose === "recovery") {
      const resetToken = randomBytes(32).toString("hex");
      await tx.accountChallenge.update({
        where: { id: row.id },
        data: {
          verifiedAt: new Date(),
          resetHash: digest(resetToken),
          expiresAt: new Date(Date.now() + 10 * 60_000),
        },
      });
      return { purpose: "recovery" as const, resetToken };
    }
    if (row.purpose === "signup") {
      if (account.verifiedAt) return null;
      const profile = profileSchema.parse(account.pendingProfile);
      const existing = await eligibleCustomer(tx, profile, account.email);
      const data = { ...customerData(profile), email: account.email };
      const customer = existing
        ? await tx.customer.update({
            where: { id: existing.id },
            data: {
              ...data,
              ...(profile.type === "PF" ? { document: undefined } : {}),
            },
          })
        : await tx.customer.create({ data: { ...data, code: "" } });
      await tx.customerAccount.update({
        where: { id: account.id },
        data: {
          customerId: customer.id,
          verifiedAt: new Date(),
          pendingProfile: Prisma.DbNull,
          sessionVersion: { increment: 1 },
        },
      });
    } else if (row.purpose === "email") {
      if (await tx.customerAccount.findUnique({ where: { email: row.email } }))
        throw emailExists();
      if (!account.customerId) return null;
      await tx.customerAccount.update({
        where: { id: account.id },
        data: { email: row.email, sessionVersion: { increment: 1 } },
      });
      await tx.customer.update({
        where: { id: account.customerId },
        data: { email: row.email },
      });
    } else return null;
    await tx.accountChallenge.deleteMany({ where: { accountId: account.id } });
    return {
      purpose: row.purpose as "signup" | "email",
      oldEmail: account.email,
    };
  });
  if (!result) throw invalidCode();
  if (result.purpose === "email") {
    await sendAccountEmail(
      result.oldEmail,
      "E-mail da conta alterado — D'mais",
      "O e-mail da sua conta foi alterado. Se não reconhece esta operação, entre em contato com suporte@dmaisdoceria.com.",
    ).catch(() =>
      console.error("Account email-change notification delivery failed"),
    );
  }
  return result.purpose === "recovery"
    ? { purpose: result.purpose, resetToken: result.resetToken }
    : { purpose: result.purpose };
}
export async function resetPassword(resetToken: string, password: string) {
  const passwordHash = await hash(password, 12);
  const ok = await prisma.$transaction(async (tx) => {
    const reference = await tx.accountChallenge.findUnique({
      where: { resetHash: digest(resetToken) },
    });
    if (!reference) return false;
    await lockAccount(tx, reference.accountId);
    const row = await tx.accountChallenge.findUnique({
      where: { id: reference.id },
    });
    if (
      !row ||
      row.purpose !== "recovery" ||
      !row.verifiedAt ||
      row.expiresAt.getTime() <= Date.now() ||
      row.resetHash !== digest(resetToken)
    )
      return false;
    await tx.customerAccount.update({
      where: { id: row.accountId },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    await tx.accountChallenge.deleteMany({
      where: { accountId: row.accountId },
    });
    return true;
  });
  if (!ok) throw invalidCode();
  return { ok: true };
}
export async function updateProfile(accountId: number, profile: ProfileInput) {
  await validateLookups(profile);
  await prisma.$transaction(async (tx) => {
    await lockAccount(tx, accountId);
    const account = await tx.customerAccount.findUniqueOrThrow({
      where: { id: accountId },
      include: { customer: true },
    });
    if (!account.customer?.active) throw invalidLogin();
    // Changing legal identity would break existing orders and must go through support.
    if (
      profile.type !== account.customer.type ||
      (profile.type === "PJ" && profile.document !== account.customer.document)
    )
      throw new AppError(
        409,
        "IDENTITY_CHANGE",
        "Para alterar o tipo de cadastro ou o CNPJ, entre em contato com o suporte.",
      );
    await tx.customer.update({
      where: { id: account.customer.id },
      data: {
        ...customerData(profile),
        ...(profile.type === "PF" ? { document: undefined } : {}),
        email: account.email,
      },
    });
  });
  return getProfile(accountId);
}
export async function requestEmailChange(
  accountId: number,
  email: string,
  password: string,
) {
  requireMailConfiguration();
  const account = await prisma.customerAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  if (!(await compare(password, account.passwordHash)))
    throw new AppError(400, "PASSWORD_INVALID", "Senha atual incorreta.");
  if (await prisma.customerAccount.findUnique({ where: { email } }))
    throw emailExists();
  const value = await prisma.$transaction(async (tx) => {
    await lockAccount(tx, accountId);
    const current = await tx.customerAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    if (current.passwordHash !== account.passwordHash) throw invalidLogin();
    return challenge(tx, current, "email", email);
  });
  return deliver(value);
}
export async function logout(accountId: number) {
  await prisma.customerAccount.update({
    where: { id: accountId },
    data: { sessionVersion: { increment: 1 } },
  });
  return { ok: true };
}
