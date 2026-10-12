import { Router } from "express";
import { z } from "zod";
import { createRateLimiter } from "../../shared/middlewares/rateLimit.js";
import { requireCustomer } from "./accounts.middleware.js";
import * as service from "./accounts.service.js";
import * as schema from "./accounts.schema.js";
import { lookupCnpj, lookupZip } from "./accounts.lookup.js";

export const accountRoutes = Router();
const sensitive = createRateLimiter({ windowMs: 15 * 60_000, max: 25 });
const reads = createRateLimiter({ windowMs: 15 * 60_000, max: 150 });
const change = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });
accountRoutes.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
accountRoutes.post("/register", sensitive, async (req, res) =>
  res
    .status(201)
    .json(await service.register(schema.registerSchema.parse(req.body))),
);
accountRoutes.post("/login", sensitive, async (req, res) => {
  const input = schema.loginSchema.parse(req.body);
  res.json(await service.login(input.username, input.password));
});
accountRoutes.post("/recover", sensitive, async (req, res) =>
  res.json(
    await service.recover(schema.emailRequestSchema.parse(req.body).email),
  ),
);
accountRoutes.post("/verify", sensitive, async (req, res) => {
  const input = schema.verifySchema.parse(req.body);
  res.json(await service.verify(input.challengeId, input.code));
});
accountRoutes.post("/resend", sensitive, async (req, res) =>
  res.json(
    await service.resend(
      z.strictObject({ challengeId: z.uuid() }).parse(req.body).challengeId,
    ),
  ),
);
accountRoutes.post("/reset", sensitive, async (req, res) => {
  const input = schema.resetSchema.parse(req.body);
  res.json(await service.resetPassword(input.resetToken, input.password));
});
accountRoutes.get("/lookup/cep/:zip", reads, async (req, res) =>
  res.json(await lookupZip(String(req.params.zip))),
);
accountRoutes.get("/lookup/cnpj/:cnpj", reads, async (req, res) =>
  res.json(await lookupCnpj(String(req.params.cnpj))),
);
accountRoutes.get("/me", reads, requireCustomer, async (_req, res) =>
  res.json(await service.getProfile(res.locals.accountId)),
);
accountRoutes.patch("/me", change, requireCustomer, async (req, res) =>
  res.json(
    await service.updateProfile(
      res.locals.accountId,
      schema.profileSchema.parse(req.body),
    ),
  ),
);
accountRoutes.post("/logout", requireCustomer, async (_req, res) =>
  res.json(await service.logout(res.locals.accountId)),
);
accountRoutes.post("/email", change, requireCustomer, async (req, res) => {
  const input = schema.emailChangeSchema.parse(req.body);
  res.json(
    await service.requestEmailChange(
      res.locals.accountId,
      input.email,
      input.password,
    ),
  );
});
accountRoutes.post(
  "/email/verify",
  sensitive,
  requireCustomer,
  async (req, res) => {
    const input = schema.verifySchema.parse(req.body);
    res.json(
      await service.verify(input.challengeId, input.code, res.locals.accountId),
    );
  },
);
accountRoutes.post(
  "/email/resend",
  sensitive,
  requireCustomer,
  async (req, res) =>
    res.json(
      await service.resend(
        z.strictObject({ challengeId: z.uuid() }).parse(req.body).challengeId,
        res.locals.accountId,
      ),
    ),
);
