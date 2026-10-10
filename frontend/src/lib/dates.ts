export type PeriodType = "day" | "week" | "month" | "year" | "custom";

export const MONTH = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function getSPToday(): string {
  return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
}

export function getSPNow(): string {
  return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 19);
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function addDays(iso: string, n: number): string {
  const d = isoToDate(iso); d.setDate(d.getDate() + n); return dateToISO(d);
}

export function addMonths(iso: string, n: number): string {
  const d = isoToDate(iso); d.setMonth(d.getMonth() + n); return dateToISO(d);
}

export function getWeekRange(iso: string) {
  const d = isoToDate(iso);
  const dow = d.getDay(); // 0=Sun
  const fromMon = dow === 0 ? 6 : dow - 1;
  const mon = new Date(d); mon.setDate(d.getDate() - fromMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: dateToISO(mon), end: dateToISO(sun) };
}

export function getMonthRange(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2,"0")}-01`;
  const last = new Date(y, m, 0).getDate();
  return { start, end: `${y}-${String(m).padStart(2,"0")}-${String(last).padStart(2,"0")}` };
}

export function getYearRange(iso: string) {
  const y = iso.slice(0, 4);
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

export function getRange(pt: PeriodType, ref: string, cs: string, ce: string) {
  if (pt === "day") return { start: ref, end: ref };
  if (pt === "week") return getWeekRange(ref);
  if (pt === "month") return getMonthRange(ref);
  if (pt === "year") return getYearRange(ref);
  return { start: cs || ref, end: ce || ref };
}

export function getPrevRange(pt: PeriodType, ref: string, cs: string, ce: string) {
  if (pt === "day") { const p = addDays(ref,-1); return {start:p,end:p}; }
  if (pt === "week") { const {start} = getWeekRange(ref); return getWeekRange(addDays(start,-7)); }
  if (pt === "month") return getMonthRange(addMonths(ref,-1));
  if (pt === "year") { const py=`${parseInt(ref.slice(0,4))-1}${ref.slice(4)}`; return getYearRange(py); }
  if (cs && ce) {
    const dur = Math.round((isoToDate(ce).getTime()-isoToDate(cs).getTime())/86400000)+1;
    return { start: addDays(cs,-dur), end: addDays(cs,-1) };
  }
  return { start:ref, end:ref };
}

export function navRef(pt: PeriodType, ref: string, dir: 1|-1): string {
  if (pt==="day") return addDays(ref,dir);
  if (pt==="week") return addDays(ref,dir*7);
  if (pt==="month") return addMonths(ref,dir);
  if (pt==="year") return `${parseInt(ref.slice(0,4))+dir}${ref.slice(4)}`;
  return ref;
}

export function allDates(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) { out.push(cur); cur = addDays(cur,1); }
  return out;
}

export function periodLabel(pt: PeriodType, ref: string, start: string, end: string): string {
  const [sy,sm,sd] = start.split("-");
  const [ey,em,ed] = end.split("-");
  if (pt==="day") return `${sd}/${sm}/${sy}`;
  if (pt==="week") return `${sd}/${sm} a ${ed}/${em}/${ey}`;
  if (pt==="month") { const [y,m]=ref.split("-"); return `${MONTH[parseInt(m)-1]} ${y}`; }
  if (pt==="year") return ref.slice(0,4);
  return `${sd}/${sm}/${sy} a ${ed}/${em}/${ey}`;
}
