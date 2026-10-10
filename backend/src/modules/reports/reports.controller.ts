import type { Request, Response } from "express";
import { exportQuerySchema, summaryQuerySchema } from "./reports.schema.js";
import * as service from "./reports.service.js";

export async function summary(req: Request, res: Response): Promise<void> {
  res.json(await service.summary(summaryQuerySchema.parse(req.query)));
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const query = exportQuerySchema.parse(req.query);
  const csv = await service.exportCsv(query);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="dmais_vendas_${query.from}_${query.to}.csv"`);
  res.send(csv);
}
