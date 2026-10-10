import { adminIdOf } from "../../shared/utils/params.js";
import type { Request, Response } from "express";
import { loginSchema } from "./auth.schema.js";
import * as authService from "./auth.service.js";

export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  res.json(await authService.login(input));
}

export async function me(_req: Request, res: Response): Promise<void> {
  const admin = await authService.getCurrentAdmin(adminIdOf(res));
  res.json(admin);
}
