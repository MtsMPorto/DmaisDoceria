import type { Request, Response } from "express";
import { idParamSchema } from "../../shared/utils/params.js";
import {
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from "./customers.schema.js";
import * as service from "./customers.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.list(listCustomersQuerySchema.parse(req.query)));
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.get(idParamSchema.parse(req.params.id)));
}

export async function history(req: Request, res: Response): Promise<void> {
  res.json(await service.history(idParamSchema.parse(req.params.id)));
}

export async function create(req: Request, res: Response): Promise<void> {
  res.status(201).json(await service.create(createCustomerSchema.parse(req.body)));
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = idParamSchema.parse(req.params.id);
  res.json(await service.update(id, updateCustomerSchema.parse(req.body)));
}
