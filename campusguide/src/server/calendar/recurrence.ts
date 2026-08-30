import { ensureCampusTimezone } from "@/server/campusTime";

/**
 * Weekly (BYDAY) recurrence expansion shared by the calendar, map, attendance
 * and dashboard routes, which previously each carried their own copy.
 *
 * Every calculation below is in the process's local timezone, which is only
 * correct while that is campus time — see server/campusTime.ts for what goes
 * wrong on a UTC host when Egypt's DST ends.
 */

ensureCampusTimezone();

export type RecurringEventLike = {
  start: Date | string;
  end: Date | string;
  isRecurring?: boolean | null;
  rrule?: string | null;
};

export type Occurrence = { start: Date; end: Date };

// A malicious/buggy caller can ask for a range of years. Each series would then
// expand to tens of thousands of occurrences per weekday, so cap the work.
export const MAX_OCCURRENCES_PER_SERIES = 500;

const DAY_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export function dayCodeToNumber(code: string): number | null {
  return DAY_CODES[code] ?? null;
}

export function parseByDays(rrule: string | null | undefined, fallbackStart: Date): number[] {
  const body = String(rrule ?? "").trim().toUpperCase().replace(/^RRULE:/, "");
  const m = body.match(/(^|;)BYDAY=([A-Z,]+)/);
  const codes = m?.[2]?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const dows = codes.map(dayCodeToNumber).filter((n): n is number => typeof n === "number");
  if (dows.length) return Array.from(new Set(dows));
  return [fallbackStart.getDay()];
}

export function dateOnlyLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

export function nextDowOnOrAfterLocal(fromDate: Date, dow: number): Date {
  const d = dateOnlyLocal(fromDate);
  const delta = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/**
 * Expands a weekly series into the occurrences overlapping [rangeStart, rangeEnd),
 * sorted by start. Non-recurring events yield at most their single occurrence.
 */
export function expandOccurrences(
  event: RecurringEventLike,
  rangeStart: Date,
  rangeEnd: Date
): Occurrence[] {
  const startBase = new Date(event.start);
  const endBase = new Date(event.end);
  if (!Number.isFinite(startBase.getTime()) || !Number.isFinite(endBase.getTime())) return [];

  const durationMs = Math.max(0, endBase.getTime() - startBase.getTime());

  if (!event.isRecurring || !event.rrule) {
    return endBase > rangeStart && startBase < rangeEnd ? [{ start: startBase, end: endBase }] : [];
  }

  const bydays = parseByDays(event.rrule, startBase);
  const hh = startBase.getHours();
  const mm = startBase.getMinutes();

  const searchFrom = maxDate(dateOnlyLocal(startBase), dateOnlyLocal(rangeStart));

  const out: Occurrence[] = [];
  for (const dow of bydays) {
    const day = nextDowOnOrAfterLocal(searchFrom, dow);
    while (day.getTime() < rangeEnd.getTime() && out.length < MAX_OCCURRENCES_PER_SERIES) {
      const startOcc = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm, 0, 0);
      day.setDate(day.getDate() + 7);

      if (startOcc.getTime() < startBase.getTime()) continue;

      const endOcc = new Date(startOcc.getTime() + durationMs);
      if (endOcc > rangeStart && startOcc < rangeEnd) out.push({ start: startOcc, end: endOcc });
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
