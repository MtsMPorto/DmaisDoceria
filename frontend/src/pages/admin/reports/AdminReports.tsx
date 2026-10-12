import { useMemo, useState } from "react";
import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, Filter, ShoppingBag, X,
} from "lucide-react";
import { HBarChart } from "@/components/admin/reports/HBarChart";
import { KPICard } from "@/components/admin/reports/KPICard";
import { VBarChart } from "@/components/admin/reports/VBarChart";
import { SaleModal } from "@/components/admin/sales/SaleModal";
import { AsyncBoundary } from "@/components/ui/AsyncState";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_STYLES, SALE_STATUS_LABELS, SALE_STATUS_STYLES } from "@/config/labels";
import { useAsync } from "@/hooks/useAsync";
import { MONTH, getRange, getSPToday, navRef, periodLabel, type PeriodType } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { brl, percent } from "@/lib/money";
import { errorMessage } from "@/services/api";
import { adminApi } from "@/services/endpoints";

type ChartMetric = "revenue" | "profit" | "units";
type RankMetric = "qty" | "revenue" | "profit";
const PRIMARY = "#27408A";
const ACCENT = "#F97316";
const GREEN = "#16a34a";
const DETAIL_PER_PAGE = 15;

function bucketLabel(key: string): string {
  if (key.length === 7) return `${MONTH[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`;
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

export default function AdminReports() {
  const products = useAsync(() => adminApi.products(), []);

  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [refDate, setRefDate] = useState(getSPToday());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("revenue");
  const [rankMetric, setRankMetric] = useState<RankMetric>("revenue");
  const [productFilterOpen, setProductFilterOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [viewSaleId, setViewSaleId] = useState<number | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [exportError, setExportError] = useState("");

  const range = useMemo(() => getRange(periodType, refDate, customStart, customEnd), [periodType, refDate, customStart, customEnd]);
  const rangeValid = range.start <= range.end;
  const label = periodLabel(periodType, refDate, range.start, range.end);
  const filterKey = selectedProductIds.join(",");

  const summary = useAsync(
    () => adminApi.reportSummary({ from: range.start, to: range.end, productIds: selectedProductIds }),
    [range.start, range.end, filterKey],
  );
  const sales = useAsync(
    () => adminApi.sales({ from: range.start, to: range.end, page: detailPage, limit: DETAIL_PER_PAGE }),
    [range.start, range.end, detailPage],
  );

  const data = summary.data;
  const current = data?.current;
  const previous = data?.previous;
  const paymentLimited = selectedProductIds.length > 0;

  const productList = (products.data ?? []).filter((product) => product.active || selectedProductIds.includes(product.id));
  const filteredProducts = productList.filter((product) =>
    !productSearch || product.name.toLowerCase().includes(productSearch.toLowerCase()) || product.brand.toLowerCase().includes(productSearch.toLowerCase()),
  );

  function toggleProduct(id: number) {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
    setDetailPage(1);
  }

  const chartData = (data?.series ?? []).map((point) => ({
    label: bucketLabel(point.key),
    value: Number(chartMetric === "revenue" ? point.revenue : chartMetric === "profit" ? (point.profit ?? 0) : point.units),
  }));
  const chartColor = chartMetric === "revenue" ? PRIMARY : chartMetric === "profit" ? GREEN : ACCENT;
  const rankColor = rankMetric === "revenue" ? PRIMARY : rankMetric === "profit" ? GREEN : ACCENT;
  const ranking = data?.ranking ?? [];
  const rankBars = ranking.slice(0, 10).map((row) => ({
    id: `${row.productId ?? "avulso"}-${row.name}`,
    name: row.name,
    value: Number(rankMetric === "qty" ? row.qty : rankMetric === "profit" ? (row.grossProfit ?? 0) : row.revenue),
  }));

  const yAxisFmt = (value: number) => {
    if (chartMetric === "units") return `${Math.round(value)}`;
    if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
    return `R$${value.toFixed(0)}`;
  };

  const hasSales = (current?.saleCount ?? 0) > 0;
  const totalPages = Math.max(1, Math.ceil((sales.data?.total ?? 0) / DETAIL_PER_PAGE));

  const PERIOD_TABS: { key: PeriodType; label: string }[] = [
    { key: "day", label: "Dia" }, { key: "week", label: "Semana" }, { key: "month", label: "Mês" },
    { key: "year", label: "Ano" }, { key: "custom", label: "Período" },
  ];

  async function exportCsv() {
    setExportError("");
    try {
      const csv = await adminApi.salesCsv({ from: range.start, to: range.end });
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `dmais_vendas_${range.start}_${range.end}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      {/* FILTROS */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border space-y-3">
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl">
          {PERIOD_TABS.map(({ key, label: tabLabel }) => (
            <button key={key} onClick={() => { setPeriodType(key); setDetailPage(1); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${periodType === key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary"}`}>
              {tabLabel}
            </button>
          ))}
        </div>

        {periodType !== "custom" ? (
          <div className="flex items-center gap-2">
            <button onClick={() => { setRefDate(navRef(periodType, refDate, -1)); setDetailPage(1); }}
              className="w-8 h-8 rounded-xl bg-muted hover:bg-muted/60 flex items-center justify-center" aria-label="Período anterior">
              <ChevronLeft size={16} className="text-primary" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-primary font-black text-sm">{label}</p>
              {periodType !== "day" && <p className="text-muted-foreground text-[10px]">{formatDate(range.start)} a {formatDate(range.end)}</p>}
            </div>
            <button onClick={() => { setRefDate(navRef(periodType, refDate, 1)); setDetailPage(1); }}
              className="w-8 h-8 rounded-xl bg-muted hover:bg-muted/60 flex items-center justify-center" aria-label="Próximo período">
              <ChevronRight size={16} className="text-primary" />
            </button>
            {periodType === "day" && (
              <input type="date" value={refDate} onChange={(e) => { if (e.target.value) { setRefDate(e.target.value); setDetailPage(1); } }}
                className="border border-border rounded-xl px-3 py-1.5 text-xs outline-none focus:border-primary" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">De
              <input type="date" value={customStart} onChange={(e) => { setCustomStart(e.target.value); setDetailPage(1); }}
                className="border border-border rounded-xl px-3 py-1.5 text-xs outline-none focus:border-primary" /></label>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">Até
              <input type="date" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); setDetailPage(1); }}
                className="border border-border rounded-xl px-3 py-1.5 text-xs outline-none focus:border-primary" /></label>
            {!rangeValid && <span className="text-red-500 text-xs font-bold">A data final deve ser igual ou posterior à inicial.</span>}
          </div>
        )}

        {/* Filtro de produtos */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button onClick={() => setProductFilterOpen((open) => !open)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${selectedProductIds.length > 0 ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              <Filter size={13} />
              {selectedProductIds.length === 0 ? "Todos os produtos" : `${selectedProductIds.length} produto${selectedProductIds.length !== 1 ? "s" : ""} selecionado${selectedProductIds.length !== 1 ? "s" : ""}`}
              <ChevronDown size={13} className={productFilterOpen ? "rotate-180" : ""} />
            </button>
            {productFilterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProductFilterOpen(false)} />
                <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-border rounded-2xl shadow-xl w-72 max-h-64 flex flex-col overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <input type="text" placeholder="Buscar produto..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-border rounded-lg outline-none focus:border-primary" />
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {filteredProducts.map((product) => (
                      <button key={product.id} onClick={() => toggleProduct(product.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left ${selectedProductIds.includes(product.id) ? "bg-primary/10" : "hover:bg-muted/40"}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedProductIds.includes(product.id) ? "bg-primary border-primary" : "border-border"}`}>
                          {selectedProductIds.includes(product.id) && <Check size={10} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{product.name}</p>
                          <p className="text-[10px] text-muted-foreground">{product.brand}</p>
                        </div>
                      </button>
                    ))}
                    {filteredProducts.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Nenhum encontrado</p>}
                  </div>
                </div>
              </>
            )}
          </div>
          {selectedProductIds.length > 0 && (
            <button onClick={() => { setSelectedProductIds([]); setDetailPage(1); }}
              className="text-xs text-muted-foreground hover:text-red-500 font-semibold flex items-center gap-1"><X size={12} /> Limpar filtro</button>
          )}
        </div>
      </div>

      {/* KPIs, gráfico e ranking */}
      <AsyncBoundary loading={summary.loading} error={summary.error} onRetry={summary.reload} hasData={data !== null}>
        {data && current && previous && (
          <>
            <div>
              <p className="text-primary font-black text-sm">Indicadores — {label}</p>
              <p className="text-muted-foreground text-xs">
                Faturamento e lucro: vendas <strong>entregues</strong>, por data da venda.
                {current.costIncomplete && (
                  <span className="ml-2 text-amber-600 font-bold inline-flex items-center gap-1">
                    <AlertTriangle size={11} /> Há itens sem custo cadastrado: custo e lucro indisponíveis
                  </span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KPICard label="Faturamento" display={brl(current.revenue)} sub="subtotal − desconto (entregues)" current={current.revenue} previous={previous.revenue} />
              <KPICard label="Custo dos Produtos" display={current.cost === null ? "indisponível" : brl(current.cost)}
                sub={current.costIncomplete ? "custos incompletos" : "vendas entregues"} warn={current.costIncomplete} />
              <KPICard label="Lucro Bruto" display={current.grossProfit === null ? "indisponível" : brl(current.grossProfit)}
                sub={current.costIncomplete ? "cálculo incompleto" : "faturamento − custo"}
                current={current.grossProfit} previous={previous.grossProfit} warn={current.costIncomplete} />
              <KPICard label="Margem Bruta" display={percent(current.grossMargin)}
                sub={current.grossMargin === null ? (current.costIncomplete ? "custos incompletos" : "sem vendas") : "lucro / faturamento"}
                warn={current.costIncomplete} />
              <KPICard label="Valor Recebido" display={paymentLimited ? "—" : brl(current.received)}
                sub={paymentLimited ? "filtro de produto ativo" : "vendas confirmadas e entregues"}
                current={paymentLimited ? undefined : current.received} previous={paymentLimited ? undefined : previous.received} warn={paymentLimited} />
              <KPICard label="Valor Pendente" display={paymentLimited ? "—" : brl(current.pending)}
                sub={paymentLimited ? "filtro de produto ativo" : "a receber (pending_amount)"}
                current={paymentLimited ? undefined : current.pending} previous={paymentLimited ? undefined : previous.pending} invertTrend warn={paymentLimited} />
              <KPICard label="Qtd. de Vendas" display={String(current.saleCount)} sub="entregues" current={String(current.saleCount)} previous={String(previous.saleCount)} />
              <KPICard label="Unidades Vendidas" display={String(Number(current.units))} sub="entregues" current={current.units} previous={previous.units} />
              <KPICard label="Ticket Médio" display={current.averageTicket === null ? "—" : brl(current.averageTicket)} sub="faturamento / vendas"
                current={current.averageTicket} previous={previous.averageTicket} />
            </div>

            {paymentLimited && (
              <p className="text-[11px] text-muted-foreground bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-2">
                <AlertTriangle size={11} className="inline mr-1 text-amber-500" />
                Valor recebido e pendente não estão disponíveis com filtro de produto: os pagamentos são registrados por venda, não por item.
              </p>
            )}

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <p className="text-primary font-black text-sm">Evolução no Período</p>
                  <p className="text-muted-foreground text-xs">{label} · por {data.granularity === "month" ? "mês" : "dia"}</p>
                </div>
                <div className="flex gap-1 bg-muted/30 p-0.5 rounded-lg">
                  {([["revenue", "Faturamento"], ["profit", "Lucro"], ["units", "Unidades"]] as [ChartMetric, string][]).map(([key, text]) => (
                    <button key={key} onClick={() => setChartMetric(key)}
                      className={`px-3 py-1 rounded-md text-xs font-bold ${chartMetric === key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary"}`}>{text}</button>
                  ))}
                </div>
              </div>
              {chartMetric === "profit" && current.costIncomplete && (
                <p className="text-amber-600 text-xs font-bold flex items-center gap-1 mb-3">
                  <AlertTriangle size={12} /> Pontos com itens sem custo aparecem sem lucro (indisponível)
                </p>
              )}
              {!hasSales ? (
                <div className="text-center py-16 text-muted-foreground">
                  <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-bold text-sm">Nenhuma venda entregue neste período</p>
                </div>
              ) : (
                <VBarChart key={`${chartMetric}-${range.start}-${range.end}-${filterKey}`} data={chartData} color={chartColor}
                  valueFmt={yAxisFmt} />
              )}
            </div>

            {hasSales && ranking.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-border">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <p className="text-primary font-black text-sm">Ranking de Produtos</p>
                    <p className="text-muted-foreground text-xs">Top {rankBars.length} no período · vendas entregues</p>
                  </div>
                  <div className="flex gap-1 bg-muted/30 p-0.5 rounded-lg">
                    {([["revenue", "Faturamento"], ["qty", "Unidades"], ["profit", "Lucro"]] as [RankMetric, string][]).map(([key, text]) => (
                      <button key={key} onClick={() => setRankMetric(key)}
                        className={`px-3 py-1 rounded-md text-xs font-bold ${rankMetric === key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary"}`}>{text}</button>
                    ))}
                  </div>
                </div>
                <HBarChart data={rankBars} color={rankColor}
                  valueFmt={rankMetric === "qty" ? (v) => `${v} un.` : (v) => brl(v)} />

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-bold text-[10px] uppercase tracking-wide">
                        <th className="text-left py-2 pr-3">Produto</th>
                        <th className="text-right py-2 px-2">Qtd.</th>
                        <th className="text-right py-2 px-2">Faturamento</th>
                        <th className="text-right py-2 px-2">Custo</th>
                        <th className="text-right py-2 px-2">Lucro</th>
                        <th className="text-right py-2 pl-2">Margem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((row, index) => (
                        <tr key={`${row.productId ?? "avulso"}-${row.name}`} className={`border-b border-border/40 last:border-0 ${index % 2 === 0 ? "" : "bg-muted/10"}`}>
                          <td className="py-1.5 pr-3">
                            <p className="font-bold text-primary">{row.name}</p>
                            <p className="text-muted-foreground text-[10px]">{row.brand ?? (row.productId ? "" : "item avulso")}</p>
                          </td>
                          <td className="text-right py-1.5 px-2 font-bold tabular-nums">{Number(row.qty)}</td>
                          <td className="text-right py-1.5 px-2 font-bold text-primary tabular-nums">{brl(row.revenue)}</td>
                          <td className="text-right py-1.5 px-2 tabular-nums">{row.cost === null ? "indisp." : brl(row.cost)}</td>
                          <td className="text-right py-1.5 px-2 font-bold tabular-nums">{row.grossProfit === null ? "indisp." : brl(row.grossProfit)}</td>
                          <td className="text-right py-1.5 pl-2 font-bold tabular-nums">{percent(row.grossMargin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </AsyncBoundary>

      {/* Vendas do período */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-primary font-black text-sm">Vendas no Período</p>
            <p className="text-muted-foreground text-xs">{sales.data?.total ?? 0} venda(s), todas as situações</p>
          </div>
          <button onClick={() => void exportCsv()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary">
            <Download size={13} /> CSV
          </button>
        </div>
        {exportError && <p className="text-red-600 text-xs font-semibold px-4 py-2">{exportError}</p>}

        <AsyncBoundary loading={sales.loading} error={sales.error} onRetry={sales.reload} hasData={sales.data !== null}>
          {(sales.data?.items.length ?? 0) === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-sm">Nenhuma venda neste período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold text-[10px] uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5">Data</th>
                    <th className="text-left px-3 py-2.5">Código</th>
                    <th className="text-left px-3 py-2.5">Cliente</th>
                    <th className="text-right px-3 py-2.5">Total</th>
                    <th className="text-center px-3 py-2.5">Pgto</th>
                    <th className="text-center px-3 py-2.5">Situação</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sales.data?.items.map((sale) => (
                    <tr key={sale.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-bold text-primary whitespace-nowrap">{formatDate(sale.saleDate)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground font-mono">{sale.code}</td>
                      <td className="px-3 py-2.5 font-bold truncate max-w-[160px]">{sale.customerName}</td>
                      <td className="px-3 py-2.5 text-right font-black text-primary tabular-nums whitespace-nowrap">{brl(sale.total)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${PAYMENT_STATUS_STYLES[sale.paymentStatus]}`}>{PAYMENT_STATUS_LABELS[sale.paymentStatus]}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${SALE_STATUS_STYLES[sale.status]}`}>{SALE_STATUS_LABELS[sale.status]}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setViewSaleId(sale.id)} className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center" aria-label="Ver venda">
                          <Eye size={13} className="text-primary" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">Página {detailPage} de {totalPages}</p>
              <div className="flex gap-1">
                <button onClick={() => setDetailPage((p) => Math.max(1, p - 1))} disabled={detailPage === 1}
                  className="w-7 h-7 rounded-lg bg-muted disabled:opacity-40 flex items-center justify-center"><ChevronLeft size={14} /></button>
                <button onClick={() => setDetailPage((p) => Math.min(totalPages, p + 1))} disabled={detailPage >= totalPages}
                  className="w-7 h-7 rounded-lg bg-muted disabled:opacity-40 flex items-center justify-center"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </AsyncBoundary>
      </div>

      {viewSaleId !== null && (
        <SaleModal saleId={viewSaleId} onClose={() => setViewSaleId(null)} onChanged={() => { sales.reload(); summary.reload(); }} />
      )}
    </div>
  );
}
