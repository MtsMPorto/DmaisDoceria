import { Router } from "express";
import { requireAuth } from "../../shared/middlewares/auth.js";
import * as controller from "./settings.controller.js";

export const publicSettingsRoutes = Router();
publicSettingsRoutes.get("/", controller.getPublic);

export const adminSettingsRoutes = Router();
adminSettingsRoutes.get("/", requireAuth, controller.getAdmin);
