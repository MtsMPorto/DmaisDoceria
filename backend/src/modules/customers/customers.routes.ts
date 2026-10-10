import { Router } from "express";
import { requireAuth } from "../../shared/middlewares/auth.js";
import * as controller from "./customers.controller.js";

// Clientes nunca são apagados: PATCH { active: false } inativa.
export const adminCustomerRoutes = Router();
adminCustomerRoutes.use(requireAuth);
adminCustomerRoutes.get("/", controller.list);
adminCustomerRoutes.post("/", controller.create);
adminCustomerRoutes.get("/:id", controller.get);
adminCustomerRoutes.get("/:id/sales", controller.history);
adminCustomerRoutes.patch("/:id", controller.update);
