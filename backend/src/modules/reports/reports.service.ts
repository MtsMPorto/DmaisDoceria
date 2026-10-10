import * as repository from "./reports.repository.js";
import {
  DAILY_MAX_DAYS,
  csvCell,
  daysBetween,
  previousRange,
  rankingItems,
  seriesPoints,
  toKpis,
} from "./reports.math.js";
import type { ExportQuery, SummaryQuery } from "./reports.schema.js";

export async function summary(query: SummaryQuery) {
  const { from, to } = query;
  const productIds = query.productIds ?? [];
  const previous = previousRange(from, to);
  const monthly = daysBetween(from, to) > DAILY_MAX_DAYS;
  // Recebido/pendente não se dividem por produto: só aparecem sem filtro.
  const withPayments = productIds.length === 0;

  const [current, before, currentPayments, previousPayments, seriesRows, rankRows] = await Promise.all([
    repository.kpis(from, to, productIds),
    repository.kpis(previous.from, previous.to, productIds),
    withPayments ? repository.payments(from, to) : Promise.resolve(null),
    withPayments ? repository.payments(previous.from, previous.to) : Promise.resolve(null),
    repository.series(from, to, productIds, monthly),
    repository.ranking(from, to, productIds),
  ]);

  return {
    period: { from, to },
    previousPeriod: previous,
    productFilter: productIds,
    current: toKpis(current, currentPayments),
    previous: toKpis(before, previousPayments),
    granularity: monthly ? "month" : "day",
    series: seriesPoints(seriesRows, from, to, monthly),
    ranking: rankingItems(rankRows),
  };
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmada",
  DELIVERED: "Entregue",
  CANCELED: "Cancelada",
};
const PAYMENT_LABEL: Record<string, string> = { PENDING: "Pendente", PARTIAL: "Parcial", PAID: "Pago" };
const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

const brNumber = (value: { toFixed(digits: number): string }) => value.toFixed(2).replace(".", ",");

export async function exportCsv(query: ExportQuery): Promise<string> {
  const sales = await repository.salesForExport(query.from, query.to);
  const header = [
    "Data",
    "Código",
    "Cliente",
    "Produtos",
    "Desconto (R$)",
    "Faturamento (R$)",
    "Entrega (R$)",
    "Total (R$)",
    "Pgto",
    "Situação Pgto",
    "Situação",
  ];

  const lines = sales.map((sale) => {
    const [year, month, day] = sale.saleDate.toISOString().slice(0, 10).split("-");
    return [
      `${day}/${month}/${year}`,
      sale.code,
      sale.customerName,
      sale.items
        .map((item) => `${item.productName}${item.flavorName ? ` - ${item.flavorName}` : ""} (${item.quantity.toString()}x)`)
        .join(" | "),
      brNumber(sale.discount),
      brNumber(sale.subtotal.minus(sale.discount)),
      brNumber(sale.deliveryFee),
      brNumber(sale.total),
      sale.paymentMethod ? (METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod) : "",
      PAYMENT_LABEL[sale.paymentStatus] ?? sale.paymentStatus,
      STATUS_LABEL[sale.status] ?? sale.status,
    ];
  });

  return `﻿${[header, ...lines].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}
