import type { Request, Response } from "express";
import { adminIdOf, idParamSchema } from "../../shared/utils/params.js";
import {
  adjustStockSchema,
  createFlavorSchema,
  createProductSchema,
  updateFlavorSchema,
  updateProductSchema,
} from "./products.schema.js";
import * as service from "./products.service.js";

export async function listPublic(_req: Request, res: Response): Promise<void> {
  res.json(await service.listPublic());
}

export async function getPublic(req: Request, res: Response): Promise<void> {
  res.json(await service.getPublic(idParamSchema.parse(req.params.id)));
}

export async function listAdmin(_req: Request, res: Response): Promise<void> {
  res.json(await service.listAdmin());
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = createProductSchema.parse(req.body);
  res.status(201).json(await service.create(adminIdOf(res), input));
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = idParamSchema.parse(req.params.id);
  res.json(await service.update(id, updateProductSchema.parse(req.body)));
}

export async function adjustStock(req: Request, res: Response): Promise<void> {
  const id = idParamSchema.parse(req.params.id);
  const { delta, reason } = adjustStockSchema.parse(req.body);
  res.json(await service.adjustStock(adminIdOf(res), id, delta, reason));
}

export async function createFlavor(req: Request, res: Response): Promise<void> {
  const productId = idParamSchema.parse(req.params.id);
  const { name } = createFlavorSchema.parse(req.body);
  res.status(201).json(await service.createFlavor(productId, name));
}

export async function updateFlavor(req: Request, res: Response): Promise<void> {
  const productId = idParamSchema.parse(req.params.id);
  const flavorId = idParamSchema.parse(req.params.flavorId);
  res.json(await service.updateFlavor(productId, flavorId, updateFlavorSchema.parse(req.body)));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.remove(idParamSchema.parse(req.params.id)));
}
