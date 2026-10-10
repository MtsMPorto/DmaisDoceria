import { Router } from "express";
import { LOGIN_LIMIT } from "../../config/limits.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { createRateLimiter } from "../../shared/middlewares/rateLimit.js";
import * as authController from "./auth.controller.js";

const loginLimiter = createRateLimiter(LOGIN_LIMIT);

export const authRoutes = Router();

authRoutes.post("/login", loginLimiter, authController.login);
authRoutes.get("/me", requireAuth, authController.me);
