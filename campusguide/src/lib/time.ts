/**
 * Spreadsheets export times as "9:00", "09:00:00" or "9:5"; the schedule API
 * only accepts zero-padded 24-hour HH:MM. Returns "" for anything unusable so
 * callers can report the offending row instead of sending a bad payload.
 */
export function normalizeClockTime(raw: string | undefined | null): string {
  const m = String(raw ?? "").trim().match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
  if (!m) return "";
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return "";
  if (hh > 23 || mm > 59) return "";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
