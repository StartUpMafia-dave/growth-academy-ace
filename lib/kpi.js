/* KPI maths shared by the server (team summaries). The client carries the same rules. */
const KPI_KEYS = ['hours', 'stops', 'presentations', 'closes', 'sales', 'retail', 'cardSales'];

function sumKpis(rows) {
  const t = { hours: 0, stops: 0, presentations: 0, closes: 0, sales: 0, retail: 0, cardSales: 0 };
  for (const r of rows) for (const k of KPI_KEYS) t[k] += (r.kpis && typeof r.kpis[k] === 'number') ? r.kpis[k] : 0;
  return t;
}
function ratios(t) {
  const d = (a, b) => (b > 0 ? a / b : null);
  return {
    stopsPerHour: d(t.stops, t.hours), presPct: d(t.presentations, t.stops), closePct: d(t.closes, t.presentations),
    convPct: d(t.sales, t.closes), retailAvg: d(t.retail, t.sales), ccPct: d(t.cardSales, t.sales), rph: d(t.retail, t.hours)
  };
}
/* light: 'g' | 'a' | 'r' | 'n'. monthOne switches stops to the 3+ mark. */
function light(lights, key, v, monthOne) {
  if (v === null || v === undefined || isNaN(v)) return 'n';
  const tl = lights[key]; if (!tl) return 'n';
  const green = (key === 'stopsPerHour' && monthOne && tl.greenMonthOne) ? tl.greenMonthOne : tl.green;
  if (v >= green) return 'g';
  if (v >= tl.amberMin) return 'a';
  return 'r';
}
/* First metric down the funnel that is not green — the limiting factor. */
function limitingFactor(lights, order, r, monthOne) {
  for (const k of order) { const l = light(lights, k, r[k], monthOne); if (l === 'r' || l === 'a') return k; }
  return null;
}
function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const wk = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return d.getUTCFullYear() + '-W' + String(wk).padStart(2, '0');
}
module.exports = { KPI_KEYS, sumKpis, ratios, light, limitingFactor, isoWeek };
