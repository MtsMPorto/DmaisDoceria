import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";

process.env.JWT_SECRET = "test-only-admin-session-secret-123456789";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
const { prisma } = await import("../../../src/config/prisma.js");
const { requireAuth } = await import("../../../src/shared/middlewares/auth.js");
const { logout } = await import("../../../src/modules/auth/auth.service.js");

test("revoked sessions cannot reuse an otherwise valid signed token", async (t) => {
  const sid = "11111111-1111-4111-8111-111111111111";
  let revoked = false;
  const originalFind = prisma.adminSession.findFirst;
  const originalUpdate = prisma.adminSession.updateMany;
  t.after(() => { prisma.adminSession.findFirst = originalFind; prisma.adminSession.updateMany = originalUpdate; });
  prisma.adminSession.findFirst = (async ({ where }: any) => {
    assert.equal(where.id, sid);
    assert.equal(where.adminId, 7);
    assert.equal(where.revokedAt, null);
    assert.equal(where.admin.active, true);
    assert.ok(where.expiresAt.gt instanceof Date);
    return revoked ? null : { id: sid };
  }) as typeof originalFind;
  prisma.adminSession.updateMany = (async ({ where, data }: any) => {
    assert.equal(where.id, sid);
    assert.equal(where.adminId, 7);
    assert.ok(data.revokedAt instanceof Date);
    revoked = true;
    return { count: 1 };
  }) as typeof originalUpdate;
  const token = jwt.sign({ sub: "7", role: "admin", sid }, process.env.JWT_SECRET!, { expiresIn: "1h" });
  const req = { headers: { authorization: `Bearer ${token}` } } as Request;
  const res = { locals: {} } as Response;
  let calls = 0;
  await requireAuth(req, res, () => { calls++; });
  assert.equal(calls, 1);
  assert.equal(res.locals.adminSessionId, sid);
  await logout(7, sid);
  await assert.rejects(requireAuth(req, res, () => { calls++; }), /inválida/);
  assert.equal(calls, 1);
});

test("legacy tokens without a session and customer tokens are rejected", async () => {
  for (const payload of [{ sub: "7", role: "admin" }, { sub: "7", role: "customer", sid: "11111111-1111-4111-8111-111111111111" }]) {
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "1h" });
    await assert.rejects(requireAuth(
      { headers: { authorization: `Bearer ${token}` } } as Request,
      { locals: {} } as Response,
      () => assert.fail("must not authorize"),
    ), /inválido/);
  }
});
