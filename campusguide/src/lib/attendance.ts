/**
 * Attendance maths and the rules for the per-session absence checkboxes.
 *
 * The invariant this file exists to protect: **the number of absences is never
 * stored.** It is always `missedSessions.length`. A stored count that drifts
 * out of step with the ticked boxes is the one bug that could tell a student
 * they are safe when they are not, so there is deliberately no way to represent
 * that state.
 *
 * Session indices are 0-based and always kept sorted, unique, and inside the
 * course's real session count.
 */

/** MIU bars you from the exam past 25% absence. */
export const MAX_ABSENCE_PERCENT = 25;

export const LIMITS = {
  weeks: { min: 1, max: 30 },
  perWeek: { min: 0, max: 14 },
  nameMax: 80,
} as const;

export type SessionKind = "lecture" | "lab";

export type AttendanceCourse = {
  id: string;
  name: string;
  weeks: number;
  lecturesPerWeek: number;
  hasLab: boolean;
  labsPerWeek: number;
  /** Indices of the lecture sessions marked absent. */
  missedLectures: number[];
  /** Indices of the lab sessions marked absent. */
  missedLabs: number[];
};

export function totalSessions(weeks: number, perWeek: number) {
  const w = Math.max(0, Math.floor(weeks || 0));
  const p = Math.max(0, Math.floor(perWeek || 0));
  return w * p;
}

/**
 * How many sessions may be missed before the 25% threshold is crossed.
 *
 * Rounded down: at 10 sessions the allowance is 2, not 2.5. Rounding up would
 * tell a student they can miss a session that in fact bars them.
 */
export function allowedAbsences(total: number) {
  return Math.floor((Math.max(0, total) * MAX_ABSENCE_PERCENT) / 100);
}

/**
 * Cleans a set of session indices: integers only, no duplicates, sorted, and
 * nothing at or beyond `total`.
 *
 * The out-of-range trim is the important part. Shortening a course from 14
 * weeks to 10 leaves ticks on sessions that no longer exist; counting them
 * would inflate the absence total against sessions the student cannot even see
 * to untick.
 */
export function normalizeSessions(indices: unknown, total: number): number[] {
  if (!Array.isArray(indices)) return [];
  const max = Math.max(0, Math.floor(total));

  const clean = new Set<number>();
  for (const raw of indices) {
    // Reject these by type before coercing. `Number(null)`, `Number(false)` and
    // `Number("")` are all 0, so a null landing in stored data would otherwise
    // fabricate an absence at session 1 that the student never recorded.
    if (raw === null || raw === undefined || typeof raw === "boolean") continue;
    if (typeof raw === "string" && raw.trim() === "") continue;

    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    const i = Math.floor(n);
    if (i < 0 || i >= max) continue;
    clean.add(i);
  }

  return [...clean].sort((a, b) => a - b);
}

/** Adds or removes one session index. Returns a new sorted array. */
export function toggleSession(indices: number[], index: number, total: number): number[] {
  const current = normalizeSessions(indices, total);
  if (index < 0 || index >= total) return current;

  return current.includes(index)
    ? current.filter((i) => i !== index)
    : normalizeSessions([...current, index], total);
}

export type KindSummary = {
  total: number;
  missed: number;
  allowed: number;
  /** Never negative — "how many more you may miss". */
  remaining: number;
  /** True once the student is past the threshold and at risk of being barred. */
  barred: boolean;
  percent: number;
};

export function summarize(total: number, missedIndices: number[]): KindSummary {
  const missed = normalizeSessions(missedIndices, total).length;
  const allowed = allowedAbsences(total);

  return {
    total,
    missed,
    allowed,
    remaining: Math.max(0, allowed - missed),
    // Strictly greater: missing exactly the allowance is still within the rule.
    barred: missed > allowed,
    percent: total > 0 ? (missed / total) * 100 : 0,
  };
}

export type CourseSummary = {
  lectures: KindSummary;
  labs: KindSummary | null;
  /** Worst status across both, for the card's overall tone. */
  status: "safe" | "warning" | "barred";
};

export function summarizeCourse(course: AttendanceCourse): CourseSummary {
  const lectureTotal = totalSessions(course.weeks, course.lecturesPerWeek);
  const lectures = summarize(lectureTotal, course.missedLectures);

  const labs = course.hasLab
    ? summarize(totalSessions(course.weeks, course.labsPerWeek), course.missedLabs)
    : null;

  const parts = labs ? [lectures, labs] : [lectures];
  const barred = parts.some((p) => p.barred);
  // "Warning" from the last allowed absence onward — the point at which one
  // more session is the difference between sitting the exam and not.
  const warning = parts.some((p) => !p.barred && p.allowed > 0 && p.remaining <= 1);

  return { lectures, labs, status: barred ? "barred" : warning ? "warning" : "safe" };
}

/**
 * Brings a stored course into a state the rest of the app can trust: clamped
 * numbers, and session sets that match the current session counts.
 */
export function normalizeCourse(raw: Partial<AttendanceCourse> & { id: string; name: string }): AttendanceCourse {
  const clamp = (v: unknown, min: number, max: number) => {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  };

  const weeks = clamp(raw.weeks, LIMITS.weeks.min, LIMITS.weeks.max);
  const lecturesPerWeek = clamp(raw.lecturesPerWeek, LIMITS.perWeek.min, LIMITS.perWeek.max);
  const hasLab = Boolean(raw.hasLab);
  const labsPerWeek = hasLab ? clamp(raw.labsPerWeek, LIMITS.perWeek.min, LIMITS.perWeek.max) : 0;

  return {
    id: raw.id,
    name: String(raw.name ?? "").slice(0, LIMITS.nameMax),
    weeks,
    lecturesPerWeek,
    hasLab,
    labsPerWeek,
    missedLectures: normalizeSessions(raw.missedLectures, totalSessions(weeks, lecturesPerWeek)),
    missedLabs: hasLab ? normalizeSessions(raw.missedLabs, totalSessions(weeks, labsPerWeek)) : [],
  };
}

/** "Week 3 · session 2" for the checkbox label. */
export function sessionLabel(index: number, perWeek: number) {
  if (perWeek <= 0) return `Session ${index + 1}`;
  const week = Math.floor(index / perWeek) + 1;
  const nth = (index % perWeek) + 1;
  return perWeek === 1 ? `Week ${week}` : `Week ${week} · #${nth}`;
}
