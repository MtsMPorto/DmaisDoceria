import "./config/zod.js";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { accountRoutes } from "./modules/accounts/accounts.routes.js";
import { adminCategoryRoutes, publicCategoryRoutes } from "./modules/categories/categories.routes.js";
import { adminProductRoutes, publicProductRoutes } from "./modules/products/products.routes.js";
import { adminSettingsRoutes, publicSettingsRoutes } from "./modules/settings/settings.routes.js";
import { adminCustomerRoutes } from "./modules/customers/customers.routes.js";
import { adminReportRoutes } from "./modules/reports/reports.routes.js";
import { adminSaleRoutes } from "./modules/sales/sales.routes.js";
import { adminTestimonialRoutes, publicTestimonialRoutes } from "./modules/testimonials/testimonials.routes.js";
import { orderRoutes } from "./modules/orders/orders.routes.js";
import { PUBLIC_READ_LIMIT } from "./config/limits.js";
import { createRateLimiter } from "./shared/middlewares/rateLimit.js";
import { errorHandler, notFound } from "./shared/middlewares/errorHandler.js";

export const app = express();

app.disable("x-powered-by");
// Render termina a conexão HTTP no proxy imediatamente anterior ao Express.
if (process.env.RENDER === "true") app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.corsOrigins }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/orders", orderRoutes);

const publicReadLimiter = createRateLimiter(PUBLIC_READ_LIMIT);

app.use("/api/settings", publicReadLimiter, publicSettingsRoutes);
app.use("/api/categories", publicReadLimiter, publicCategoryRoutes);
app.use("/api/products", publicReadLimiter, publicProductRoutes);
app.use("/api/testimonials", publicReadLimiter, publicTestimonialRoutes);

app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin/categories", adminCategoryRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin/customers", adminCustomerRoutes);
app.use("/api/admin/sales", adminSaleRoutes);
app.use("/api/admin/reports", adminReportRoutes);
app.use("/api/admin/testimonials", adminTestimonialRoutes);

app.use(notFound);
app.use(errorHandler);
