import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import {
  csvCell,
  daysBetween,
  previousRange,
  rankingItems,
  seriesPoints,
  toKpis,
} from "../../../src/modules/reports/reports.math.js";
import { exportQuerySchema, summaryQuerySchema } from "../../../src/modules/reports/reports.schema.js";

z.config(z.locales.pt());

describe("período anterior", () => {
  it("mesma duração, imediatamente antes", () => {
    assert.deepEqual(previousRange("2026-10-01", "2026-10-31"), { from: "2026-08-31", to: "2026-09-30" });
    assert.deepEqual(previousRange("2026-10-10", "2026-10-10"), { from: "2026-10-09", to: "2026-10-09" });
    assert.equal(daysBetween("2026-10-01", "2026-10-31"), 31);
  });
});

describe("toKpis", () => {
  const complete = { saleCount: 2, units: "10", revenue: "200.00", costComplete: true, cost: "120.00" };

  it("calcula lucro, margem e ticket com custo completo", () => {
    const kpis = toKpis(complete, { received: "150.00", pending: "50.00" });
    assert.equal(kpis.revenue, "200.00");
    assert.equal(kpis.cost, "120.00");
    assert.equal(kpis.grossProfit, "80.00");
    assert.equal(kpis.grossMargin, "40.0");
    assert.equal(kpis.averageTicket, "100.00");
    assert.equal(kpis.costIncomplete, false);
    assert.equal(kpis.received, "150.00");
  });

  it("custo incompleto: lucro e margem INDISPONÍVEIS (nunca lucro com custo zero)", () => {
    const kpis = toKpis({ ...complete, costComplete: false, cost: "50.00" }, null);
    assert.equal(kpis.cost, null);
    assert.equal(kpis.grossProfit, null);
    assert.equal(kpis.grossMargin, null);
    assert.equal(kpis.costIncomplete, true);
    assert.equal(kpis.received, null);
  });

  it("sem vendas: zeros e sem ticket", () => {
    const kpis = toKpis({ saleCount: 0, units: "0", revenue: "0.00", costComplete: true, cost: null }, null);
    assert.equal(kpis.grossProfit, "0.00");
    assert.equal(kpis.averageTicket, null);
    assert.equal(kpis.costIncomplete, false);
    assert.equal(kpis.grossMargin, null);
  });
});

describe("séries e ranking", () => {
  it("preenche dias sem venda com zero", () => {
    const points = seriesPoints(
      [{ bucket: "2026-10-02", revenue: "50.00", units: "3", costComplete: true, cost: "20.00" }],
      "2026-10-01",
      "2026-10-03",
      false,
    );
    assert.deepEqual(points.map((p) => p.key), ["2026-10-01", "2026-10-02", "2026-10-03"]);
    assert.equal(points[0].revenue, "0.00");
    assert.equal(points[1].profit, "30.00");
  });

  it("série mensal cobre todos os meses do intervalo", () => {
    const points = seriesPoints([], "2026-01-15", "2026-04-02", true);
    assert.deepEqual(points.map((p) => p.key), ["2026-01", "2026-02", "2026-03", "2026-04"]);
  });

  it("ponto com item sem custo tem lucro nulo", () => {
    const [point] = seriesPoints(
      [{ bucket: "2026-10-01", revenue: "50.00", units: "3", costComplete: false, cost: "5.00" }],
      "2026-10-01",
      "2026-10-01",
      false,
    );
    assert.equal(point.profit, null);
  });

  it("ranking: lucro e margem só com custo completo", () => {
    const [a, b] = rankingItems([
      { productId: 1, name: "A", brand: "X", qty: "5", revenue: "100.00", costComplete: true, cost: "60.00" },
      { productId: 2, name: "B", brand: null, qty: "1", revenue: "10.00", costComplete: false, cost: "3.00" },
    ]);
    assert.equal(a.grossProfit, "40.00");
    assert.equal(a.grossMargin, "40.0");
    assert.equal(b.grossProfit, null);
    assert.equal(b.cost, null);
  });
});

describe("CSV e consultas", () => {
  it("neutraliza fórmulas e escapa aspas", () => {
    assert.equal(csvCell("=SOMA(A1)"), "\"'=SOMA(A1)\"");
    assert.equal(csvCell("+55"), "\"'+55\"");
    assert.equal(csvCell("Ele disse \"oi\""), "\"Ele disse \"\"oi\"\"\"");
    assert.equal(csvCell("Maria"), "\"Maria\"");
  });

  it("valida período e lista de produtos", () => {
    const ok = summaryQuerySchema.parse({ from: "2026-10-01", to: "2026-10-31", productIds: "1,2,2" });
    assert.deepEqual(ok.productIds, [1, 2]);
    assert.equal(summaryQuerySchema.safeParse({ from: "2026-10-31", to: "2026-10-01" }).success, false);
    assert.equal(summaryQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-31", productIds: "1;DROP" }).success, false);
    assert.equal(exportQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-31" }).success, true);
    assert.equal(exportQuerySchema.safeParse({ from: "01/10/2026", to: "2026-10-31" }).success, false);
  });
});
