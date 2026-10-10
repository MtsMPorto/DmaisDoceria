import { useState } from "react";

export interface BarPoint {
  label: string;
  value: number;
}

export function VBarChart({ data, color, valueFmt }: {
  data: BarPoint[];
  color: string;
  valueFmt: (v: number) => string;
}) {
  const [hov, setHov] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const showEvery = data.length <= 12 ? 1 : data.length <= 31 ? 5 : 1;
  const yTicks = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className="select-none">
      <div className="flex" style={{ height: 200 }}>
        <div className="flex flex-col justify-between text-[9px] text-muted-foreground text-right pr-2 pb-5 pt-0.5 shrink-0" style={{ width: 54 }}>
          {yTicks.map((t) => <span key={t}>{valueFmt(max * t)}</span>)}
        </div>
        <div className="flex-1 relative border-b border-l border-border/20 overflow-hidden">
          {[0.25, 0.5, 0.75].map((t) => (
            <div key={t} className="absolute left-0 right-0 border-t border-border/20" style={{ bottom: `${t * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-px px-1">
            {data.map((d, i) => {
              const pct = Math.max((d.value / max) * 100, d.value > 0 ? 0.5 : 0);
              return (
                <div key={d.label + i} className="flex-1 flex flex-col items-center justify-end h-full relative"
                  onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
                  {hov === i && (
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-white border border-border rounded-xl px-2.5 py-1.5 text-xs shadow-xl z-10 whitespace-nowrap pointer-events-none">
                      <p className="text-muted-foreground text-[10px]">{d.label}</p>
                      <p className="font-black tabular-nums" style={{ color }}>{valueFmt(d.value)}</p>
                    </div>
                  )}
                  <div className="w-full rounded-t-sm" style={{ height: `${pct}%`, backgroundColor: color, maxWidth: 40, margin: "0 auto" }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex text-[9px] text-muted-foreground" style={{ paddingLeft: 54 }}>
        {data.map((d, i) => (
          <div key={d.label + i} className="flex-1 text-center truncate px-px pt-1">{i % showEvery === 0 ? d.label : ""}</div>
        ))}
      </div>
    </div>
  );
}
