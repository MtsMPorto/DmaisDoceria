import { Router } from "express";
import { ORDER_CREATE_LIMIT } from "../../config/limits.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { createRateLimiter } from "../../shared/middlewares/rateLimit.js";
import * as orderController from "./orders.controller.js";

const createOrderLimiter = createRateLimiter(ORDER_CREATE_LIMIT);

export const orderRoutes = Router();

// Pública: o cliente não tem conta.
orderRoutes.post("/", createOrderLimiter, orderController.create);

// Admin.
orderRoutes.get("/", requireAuth, orderController.list);
orderRoutes.get("/:id", requireAuth, orderController.get);
orderRoutes.patch("/:id/status", requireAuth, orderController.updateStatus);
