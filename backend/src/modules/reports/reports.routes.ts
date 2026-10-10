import { Router } from "express";
import { requireAuth } from "../../shared/middlewares/auth.js";
import * as controller from "./reports.controller.js";

export const adminReportRoutes = Router();
adminReportRoutes.use(requireAuth);
adminReportRoutes.get("/summary", controller.summary);
adminReportRoutes.get("/sales.csv", controller.exportCsv);
