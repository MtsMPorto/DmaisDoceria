import { Router } from "express";
import { requireAuth } from "../../shared/middlewares/auth.js";
import * as controller from "./testimonials.controller.js";

export const publicTestimonialRoutes = Router();
publicTestimonialRoutes.get("/", controller.listPublic);

// Sem DELETE: "despublicar" esconde o depoimento da loja.
export const adminTestimonialRoutes = Router();
adminTestimonialRoutes.use(requireAuth);
adminTestimonialRoutes.get("/", controller.listAdmin);
adminTestimonialRoutes.post("/", controller.create);
adminTestimonialRoutes.patch("/:id", controller.update);
