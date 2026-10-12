import type { Request, Response } from "express";
import { idParamSchema } from "../../shared/utils/params.js";
import { createCategorySchema, updateCategorySchema } from "./categories.schema.js";
import * as service from "./categories.service.js";

export async function listPublic(_req: Request, res: Response): Promise<void> {
  res.json(await service.listPublic());
}

export async function listAdmin(_req: Request, res: Response): Promise<void> {
  res.json(await service.listAdmin());
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = createCategorySchema.parse(req.body);
  res.status(201).json(await service.create(input));
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = idParamSchema.parse(req.params.id);
  res.json(await service.update(id, updateCategorySchema.parse(req.body)));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.remove(idParamSchema.parse(req.params.id)));
}
