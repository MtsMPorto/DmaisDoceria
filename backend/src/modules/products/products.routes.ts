import { Router } from "express";
import { requireAuth } from "../../shared/middlewares/auth.js";
import * as controller from "./products.controller.js";

export const publicProductRoutes = Router();
publicProductRoutes.get("/", controller.listPublic);
publicProductRoutes.get("/:id", controller.getPublic);

export const adminProductRoutes = Router();
adminProductRoutes.use(requireAuth);
adminProductRoutes.get("/", controller.listAdmin);
adminProductRoutes.post("/", controller.create);
adminProductRoutes.patch("/:id", controller.update);
adminProductRoutes.post("/:id/stock", controller.adjustStock);
adminProductRoutes.post("/:id/flavors", controller.createFlavor);
adminProductRoutes.patch("/:id/flavors/:flavorId", controller.updateFlavor);
