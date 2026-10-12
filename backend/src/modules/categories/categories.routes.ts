import { Router } from "express";
import { requireAuth } from "../../shared/middlewares/auth.js";
import * as controller from "./categories.controller.js";

export const publicCategoryRoutes = Router();
publicCategoryRoutes.get("/", controller.listPublic);

export const adminCategoryRoutes = Router();
adminCategoryRoutes.use(requireAuth);
adminCategoryRoutes.get("/", controller.listAdmin);
adminCategoryRoutes.post("/", controller.create);
adminCategoryRoutes.patch("/:id", controller.update);
adminCategoryRoutes.delete("/:id", controller.remove);
