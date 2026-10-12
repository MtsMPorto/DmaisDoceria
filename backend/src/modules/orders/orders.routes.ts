import { requireCustomer } from "../accounts/accounts.middleware.js";
import { Router } from "express";
import { ORDER_CREATE_LIMIT } from "../../config/limits.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { createRateLimiter } from "../../shared/middlewares/rateLimit.js";
import * as orderController from "./orders.controller.js";

const createOrderLimiter = createRateLimiter(ORDER_CREATE_LIMIT);

export const orderRoutes = Router();

// Exige conta de cliente ativa e e-mail verificado.
orderRoutes.post("/", createOrderLimiter, requireCustomer, orderController.create);

// Admin.
orderRoutes.get("/", requireAuth, orderController.list);
orderRoutes.get("/:id", requireAuth, orderController.get);
orderRoutes.patch("/:id/status", requireAuth, orderController.updateStatus);
