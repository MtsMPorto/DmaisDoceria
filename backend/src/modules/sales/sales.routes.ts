import { Router } from "express";
import { requireAuth } from "../../shared/middlewares/auth.js";
import * as controller from "./sales.controller.js";

// Vendas nunca são apagadas: rascunho ou confirmada cancelam; entregue não cancela.
// DELETE existe só para remover itens de uma venda em rascunho.
export const adminSaleRoutes = Router();
adminSaleRoutes.use(requireAuth);

adminSaleRoutes.get("/", controller.list);
adminSaleRoutes.post("/", controller.create);
adminSaleRoutes.post("/from-order/:orderId", controller.createFromOrder);
adminSaleRoutes.get("/:id", controller.get);
adminSaleRoutes.patch("/:id", controller.update);

adminSaleRoutes.post("/:id/confirm", controller.confirm);
adminSaleRoutes.post("/:id/cancel", controller.cancel);
adminSaleRoutes.post("/:id/deliver", controller.deliver);

adminSaleRoutes.post("/:id/items", controller.addItem);
adminSaleRoutes.patch("/:id/items/:itemId", controller.updateItem);
adminSaleRoutes.delete("/:id/items/:itemId", controller.removeItem);
