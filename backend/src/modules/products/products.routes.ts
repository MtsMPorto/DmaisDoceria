import { Router, raw } from "express";
import { uploadProductImage } from "./products.upload.js";
import { createRateLimiter } from "../../shared/middlewares/rateLimit.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import * as controller from "./products.controller.js";

export const publicProductRoutes = Router();
publicProductRoutes.get("/", controller.listPublic);
publicProductRoutes.get("/:id", controller.getPublic);

export const adminProductRoutes = Router();
adminProductRoutes.use(requireAuth);
adminProductRoutes.post("/image", createRateLimiter({ windowMs: 60_000, max: 20 }), raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }), async (req, res) => {
  res.status(201).json(await uploadProductImage(req.body));
});
adminProductRoutes.get("/", controller.listAdmin);
adminProductRoutes.post("/", controller.create);
adminProductRoutes.patch("/:id", controller.update);
adminProductRoutes.post("/:id/stock", controller.adjustStock);
adminProductRoutes.post("/:id/flavors", controller.createFlavor);
adminProductRoutes.patch("/:id/flavors/:flavorId", controller.updateFlavor);

adminProductRoutes.delete("/:id", controller.remove);
