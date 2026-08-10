export type DayCount = { date: string; count: number };

/**
 * Expands a sparse per-day aggregation into one entry per day, oldest first.
 *
 * Mongo's `$group` only emits days that had rows, so a fortnight with two
 * signups comes back as two points. Charting that directly draws two bars where
 * fourteen belong and makes a quiet week look like a busy one.
 */
export function densifyDays(series: DayCount[], days: number, today = new Date()): DayCount[] {
  const byDate = new Map(series.map((s) => [s.date, s.count]));
  const out: DayCount[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);

    // Local date key, matching the day boundaries the aggregation grouped on.
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: key, count: byDate.get(key) ?? 0 });
  }

  return out;
}

/**
 * Bar height in pixels.
 *
 * Deliberately not a percentage: a percentage height resolves against the
 * parent's height, which is `auto` inside a flex column, so every bar silently
 * collapses to zero. Empty days still get a sliver so the axis reads as a row.
 */
export function barHeight(count: number, max: number, chartHeight: number) {
  if (count <= 0) return 3;
  const scale = Math.max(max, 1);
  return Math.max(6, Math.round((count / scale) * chartHeight));
}
