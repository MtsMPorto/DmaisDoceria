import type { Request, Response } from "express";
import { adminIdOf, idParamSchema } from "../../shared/utils/params.js";
import {
  createItemSchema,
  createSaleSchema,
  listSalesQuerySchema,
  updateItemSchema,
  updateSaleSchema,
} from "./sales.schema.js";
import * as service from "./sales.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.list(listSalesQuerySchema.parse(req.query)));
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.get(idParamSchema.parse(req.params.id)));
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = createSaleSchema.parse(req.body);
  res.status(201).json(await service.create(adminIdOf(res), input));
}

export async function createFromOrder(req: Request, res: Response): Promise<void> {
  const orderId = idParamSchema.parse(req.params.orderId);
  res.status(201).json(await service.createFromOrder(adminIdOf(res), orderId));
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = idParamSchema.parse(req.params.id);
  res.json(await service.update(id, updateSaleSchema.parse(req.body)));
}

export async function confirm(req: Request, res: Response): Promise<void> {
  res.json(await service.confirm(idParamSchema.parse(req.params.id)));
}

export async function cancel(req: Request, res: Response): Promise<void> {
  res.json(await service.cancel(idParamSchema.parse(req.params.id)));
}

export async function deliver(req: Request, res: Response): Promise<void> {
  res.json(await service.deliver(idParamSchema.parse(req.params.id)));
}

export async function addItem(req: Request, res: Response): Promise<void> {
  const id = idParamSchema.parse(req.params.id);
  res.status(201).json(await service.addItem(id, createItemSchema.parse(req.body)));
}

export async function updateItem(req: Request, res: Response): Promise<void> {
  const id = idParamSchema.parse(req.params.id);
  const itemId = idParamSchema.parse(req.params.itemId);
  res.json(await service.updateItem(id, itemId, updateItemSchema.parse(req.body)));
}

export async function removeItem(req: Request, res: Response): Promise<void> {
  const id = idParamSchema.parse(req.params.id);
  const itemId = idParamSchema.parse(req.params.itemId);
  res.json(await service.removeItem(id, itemId));
}
