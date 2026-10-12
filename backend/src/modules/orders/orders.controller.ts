import type { Request, Response } from "express";
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  updateStatusSchema,
} from "./orders.schema.js";
import * as orderService from "./orders.service.js";

export async function create(req: Request, res: Response): Promise<void> {
  const customer = res.locals.customer;
  const input = createOrderSchema.parse({ ...req.body, customer: {
    type: customer.type, name: customer.name, document: customer.type === "PJ" ? customer.document : "",
    phone: customer.phone, zip: customer.zip, street: customer.street, streetNumber: customer.streetNumber,
    complement: customer.complement || undefined, neighborhood: customer.neighborhood, city: customer.city, state: customer.state,
  }});
  const { created, order } = await orderService.createOrder(input, customer.id);
  res.status(created ? 201 : 200).json(order);
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = listOrdersQuerySchema.parse(req.query);
  res.json(await orderService.listOrders(query));
}

export async function get(req: Request, res: Response): Promise<void> {
  const id = orderIdParamSchema.parse(req.params.id);
  res.json(await orderService.getOrder(id));
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const id = orderIdParamSchema.parse(req.params.id);
  const { status } = updateStatusSchema.parse(req.body);
  res.json(await orderService.updateOrderStatus(id, status));
}
