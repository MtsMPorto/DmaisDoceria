import type { Request, Response } from "express";
import * as service from "./settings.service.js";

export async function getPublic(_req: Request, res: Response): Promise<void> {
  res.json(await service.getPublicSettings());
}

export async function getAdmin(_req: Request, res: Response): Promise<void> {
  res.json(await service.getAdminSettings());
}
