export interface RankBar {
  id: string;
  name: string;
  value: number;
}

export function HBarChart({ data, color, valueFmt }: { data: RankBar[]; color: string; valueFmt: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = (Math.max(d.value, 0) / max) * 100;
        const short = d.name.length > 22 ? `${d.name.slice(0, 20)}…` : d.name;
        return (
          <div key={d.id} className="flex items-center gap-2">
            <div className="text-[10px] text-primary font-bold shrink-0 truncate" style={{ width: 140 }} title={d.name}>{short}</div>
            <div className="flex-1 bg-muted/30 rounded-full h-4 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <div className="text-[10px] font-black tabular-nums shrink-0 text-right" style={{ width: 72, color }}>{valueFmt(d.value)}</div>
          </div>
        );
      })}
    </div>
  );
}
