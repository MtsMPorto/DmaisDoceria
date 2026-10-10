import { AlertTriangle, Minus, TrendingDown, TrendingUp } from "lucide-react";

// `display` já vem formatado; `current`/`previous` (texto numérico) só alimentam a variação.
export function KPICard({ label, display, sub, current, previous, invertTrend = false, warn = false }: {
  label: string;
  display: string;
  sub?: string;
  current?: string | null;
  previous?: string | null;
  invertTrend?: boolean;
  warn?: boolean;
}) {
  const hasCompare = current !== undefined && previous !== undefined;
  const now = current === null || current === undefined ? null : Number(current);
  const before = previous === null || previous === undefined ? null : Number(previous);
  const pct = now !== null && before !== null && before !== 0 ? ((now - before) / Math.abs(before)) * 100 : null;
  const up = pct === null ? true : pct >= 0;
  const good = invertTrend ? !up : up;
  const trendColor = pct === null ? "text-muted-foreground" : good ? "text-green-600" : "text-red-500";
  const TrendIcon = pct === null ? Minus : up ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-border flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[11px] font-semibold leading-tight">{label}</p>
        {warn && <AlertTriangle size={11} className="text-amber-500 shrink-0" />}
      </div>
      <p className="text-primary font-black text-xl leading-tight tabular-nums">{display}</p>
      {sub && <p className="text-muted-foreground text-[10px]">{sub}</p>}
      {hasCompare && (
        pct !== null ? (
          <div className={`flex items-center gap-1 text-[10px] font-bold mt-0.5 ${trendColor}`}>
            <TrendIcon size={10} />
            <span>{pct >= 0 ? "+" : ""}{pct.toFixed(1).replace(".", ",")}% vs anterior</span>
          </div>
        ) : (
          <p className="text-muted-foreground text-[10px] mt-0.5">Sem base de comparação</p>
        )
      )}
    </div>
  );
}
