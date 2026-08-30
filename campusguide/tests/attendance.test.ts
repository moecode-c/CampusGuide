/**
 * Attendance rules.
 *
 * This is the highest-stakes arithmetic in the app: a wrong answer here tells a
 * student they can safely skip a session that in fact bars them from the exam.
 * The rounding direction, the strict-vs-inclusive threshold, and the pruning of
 * ticks for sessions that no longer exist are all covered deliberately.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ABSENCE_PERCENT,
  allowedAbsences,
  normalizeCourse,
  normalizeSessions,
  sessionLabel,
  summarize,
  summarizeCourse,
  toggleSession,
  totalSessions,
} from "../src/lib/attendance";

// ------------------------------------------------------------ the 25% rule

test("the allowance is 25% of the sessions, rounded down", () => {
  assert.equal(MAX_ABSENCE_PERCENT, 25);
  assert.equal(allowedAbsences(12), 3);
  assert.equal(allowedAbsences(10), 2, "2.5 rounds down to 2, never up");
  assert.equal(allowedAbsences(7), 1, "1.75 rounds down to 1");
  assert.equal(allowedAbsences(3), 0, "0.75 rounds down — no free absences");
  assert.equal(allowedAbsences(0), 0);
});

test("rounding down is what keeps the answer safe", () => {
  // 10 sessions, 25% = 2.5. Telling a student they may miss 3 would be wrong:
  // 3/10 is 30% and bars them.
  const s = summarize(10, [0, 1, 2]);
  assert.equal(s.allowed, 2);
  assert.ok(s.barred, "three of ten is over the line");
});

test("missing exactly the allowance is still allowed", () => {
  const s = summarize(12, [0, 1, 2]);
  assert.equal(s.allowed, 3);
  assert.equal(s.missed, 3);
  assert.equal(s.remaining, 0);
  assert.ok(!s.barred, "at the limit, not past it");
});

test("one more than the allowance bars you", () => {
  const s = summarize(12, [0, 1, 2, 3]);
  assert.ok(s.barred);
  assert.equal(s.remaining, 0, "remaining never goes negative");
});

// ------------------------------------------------- count follows the ticks

test("the count is derived from the ticks, never stored separately", () => {
  assert.equal(summarize(20, []).missed, 0);
  assert.equal(summarize(20, [3]).missed, 1);
  assert.equal(summarize(20, [3, 7, 11]).missed, 3);
});

test("duplicate ticks cannot inflate the count", () => {
  // A double-fire on one checkbox must not count as two absences.
  assert.deepEqual(normalizeSessions([2, 2, 2], 10), [2]);
  assert.equal(summarize(10, [2, 2, 2]).missed, 1);
});

test("ticks are stored sorted and deduplicated", () => {
  assert.deepEqual(normalizeSessions([5, 1, 3, 1], 10), [1, 3, 5]);
});

test("junk values are discarded rather than counted", () => {
  assert.deepEqual(normalizeSessions([1, -1, 2.7, NaN, "3", null, undefined, 99], 10), [1, 2, 3]);
  assert.deepEqual(normalizeSessions("not an array" as unknown, 10), []);
  assert.deepEqual(normalizeSessions(null, 10), []);
});

// --------------------------------------- shrinking a course prunes its ticks

test("ticks beyond the last session are dropped, not silently counted", () => {
  // 14 weeks x 2 = 28 sessions, with week 13 missed. Shortened to 10 weeks the
  // course only has 20 sessions, and a tick at index 25 is unreachable in the
  // UI — leaving it would inflate the total against a session nobody can see.
  assert.deepEqual(normalizeSessions([1, 25], 20), [1]);
  assert.equal(summarize(20, [1, 25]).missed, 1);
});

test("shrinking a course through normalizeCourse prunes both lists", () => {
  const shortened = normalizeCourse({
    id: "c1",
    name: "Physics",
    weeks: 10,
    lecturesPerWeek: 2,
    hasLab: true,
    labsPerWeek: 1,
    missedLectures: [0, 5, 25],
    missedLabs: [0, 14],
  });

  assert.deepEqual(shortened.missedLectures, [0, 5], "index 25 is past 20 sessions");
  assert.deepEqual(shortened.missedLabs, [0], "index 14 is past 10 lab sessions");
});

test("turning labs off clears the lab ticks", () => {
  const c = normalizeCourse({
    id: "c1",
    name: "Maths",
    weeks: 10,
    lecturesPerWeek: 2,
    hasLab: false,
    labsPerWeek: 2,
    missedLabs: [0, 1],
  });
  assert.equal(c.labsPerWeek, 0);
  assert.deepEqual(c.missedLabs, []);
});

test("out-of-range course settings are clamped, not trusted", () => {
  const c = normalizeCourse({
    id: "c1",
    name: "x".repeat(200),
    weeks: 9999,
    lecturesPerWeek: -3,
    hasLab: true,
    labsPerWeek: 999,
  });
  assert.equal(c.weeks, 30);
  assert.equal(c.lecturesPerWeek, 0);
  assert.equal(c.labsPerWeek, 14);
  assert.equal(c.name.length, 80);
});

// ------------------------------------------------------------- toggling

test("toggling adds then removes the same session", () => {
  let ticks: number[] = [];
  ticks = toggleSession(ticks, 4, 20);
  assert.deepEqual(ticks, [4]);
  ticks = toggleSession(ticks, 4, 20);
  assert.deepEqual(ticks, [], "clicking twice leaves no trace");
});

test("toggling keeps the list sorted", () => {
  let ticks: number[] = [];
  for (const i of [9, 2, 5]) ticks = toggleSession(ticks, i, 20);
  assert.deepEqual(ticks, [2, 5, 9]);
});

test("toggling a session that does not exist changes nothing", () => {
  assert.deepEqual(toggleSession([1], 50, 20), [1]);
  assert.deepEqual(toggleSession([1], -1, 20), [1]);
});

// ------------------------------------------------------------- summaries

test("totals are weeks times sessions per week", () => {
  assert.equal(totalSessions(14, 2), 28);
  assert.equal(totalSessions(10, 0), 0);
  assert.equal(totalSessions(0, 3), 0);
});

test("a course with no labs reports no lab summary", () => {
  const s = summarizeCourse({
    id: "c1", name: "Ethics", weeks: 12, lecturesPerWeek: 1,
    hasLab: false, labsPerWeek: 0, missedLectures: [], missedLabs: [],
  });
  assert.equal(s.labs, null);
  assert.equal(s.lectures.total, 12);
});

test("the course status is the worst of lectures and labs", () => {
  const base = { id: "c1", name: "DLD", weeks: 12, lecturesPerWeek: 2, hasLab: true, labsPerWeek: 1 };

  const safe = summarizeCourse({ ...base, missedLectures: [], missedLabs: [] });
  assert.equal(safe.status, "safe");

  // Labs: 12 sessions, allowance 3. Three missed leaves 0 remaining -> warning.
  const warn = summarizeCourse({ ...base, missedLectures: [], missedLabs: [0, 1, 2] });
  assert.equal(warn.status, "warning");

  // Four of twelve labs is over the line, so the whole course reads barred
  // even though the lectures are spotless.
  const barred = summarizeCourse({ ...base, missedLectures: [], missedLabs: [0, 1, 2, 3] });
  assert.equal(barred.status, "barred");
});

test("percentages reflect the ticks", () => {
  assert.equal(summarize(20, [0, 1, 2, 3, 4]).percent, 25);
  assert.equal(summarize(0, []).percent, 0, "no division by zero on an empty course");
});

// ---------------------------------------------------------------- labels

test("session labels name the week they fall in", () => {
  assert.equal(sessionLabel(0, 2), "Week 1 · #1");
  assert.equal(sessionLabel(1, 2), "Week 1 · #2");
  assert.equal(sessionLabel(2, 2), "Week 2 · #1");
  assert.equal(sessionLabel(0, 1), "Week 1", "no #1 suffix when there is one a week");
  assert.equal(sessionLabel(3, 0), "Session 4", "degenerate case still labels something");
});
