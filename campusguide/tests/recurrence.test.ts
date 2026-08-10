import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_OCCURRENCES_PER_SERIES,
  expandOccurrences,
  parseByDays,
  nextDowOnOrAfterLocal,
} from "../src/server/calendar/recurrence";

/** Local-time Date builder so these assertions don't depend on the machine's TZ. */
function at(y: number, m: number, d: number, hh = 0, mm = 0) {
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

const weekly = (start: Date, end: Date, byday: string) => ({
  start,
  end,
  isRecurring: true,
  rrule: `FREQ=WEEKLY;BYDAY=${byday}`,
});

test("parseByDays reads BYDAY codes, with or without the RRULE prefix", () => {
  assert.deepEqual(parseByDays("FREQ=WEEKLY;BYDAY=MO,WE", at(2026, 1, 5)), [1, 3]);
  assert.deepEqual(parseByDays("RRULE:FREQ=WEEKLY;BYDAY=SA", at(2026, 1, 5)), [6]);
  assert.deepEqual(parseByDays("freq=weekly;byday=tu", at(2026, 1, 5)), [2]);
});

test("parseByDays de-duplicates repeated codes", () => {
  assert.deepEqual(parseByDays("FREQ=WEEKLY;BYDAY=MO,MO,WE", at(2026, 1, 5)), [1, 3]);
});

test("parseByDays falls back to the start date's weekday", () => {
  // 2026-01-05 is a Monday.
  assert.deepEqual(parseByDays("FREQ=WEEKLY", at(2026, 1, 5)), [1]);
  assert.deepEqual(parseByDays(null, at(2026, 1, 5)), [1]);
  assert.deepEqual(parseByDays("FREQ=WEEKLY;BYDAY=XX", at(2026, 1, 5)), [1]);
});

test("nextDowOnOrAfterLocal returns the same day when it already matches", () => {
  const monday = at(2026, 1, 5);
  assert.equal(nextDowOnOrAfterLocal(monday, 1).getTime(), monday.getTime());
  assert.equal(nextDowOnOrAfterLocal(monday, 3).getTime(), at(2026, 1, 7).getTime());
  assert.equal(nextDowOnOrAfterLocal(monday, 0).getTime(), at(2026, 1, 11).getTime());
});

test("a one-off event yields exactly one occurrence when it overlaps the range", () => {
  const e = { start: at(2026, 3, 10, 9, 0), end: at(2026, 3, 10, 11, 0), isRecurring: false };
  const got = expandOccurrences(e, at(2026, 3, 1), at(2026, 3, 31));
  assert.equal(got.length, 1);
  assert.equal(got[0].start.getTime(), at(2026, 3, 10, 9, 0).getTime());
});

test("a one-off event outside the range yields nothing", () => {
  const e = { start: at(2026, 5, 10, 9, 0), end: at(2026, 5, 10, 11, 0), isRecurring: false };
  assert.equal(expandOccurrences(e, at(2026, 3, 1), at(2026, 3, 31)).length, 0);
});

test("an event straddling the range start is still included", () => {
  const e = { start: at(2026, 3, 1, 8, 0), end: at(2026, 3, 1, 12, 0), isRecurring: false };
  const got = expandOccurrences(e, at(2026, 3, 1, 10, 0), at(2026, 3, 2));
  assert.equal(got.length, 1);
});

test("isRecurring without an rrule is treated as a one-off", () => {
  const e = { start: at(2026, 3, 10, 9, 0), end: at(2026, 3, 10, 11, 0), isRecurring: true, rrule: null };
  assert.equal(expandOccurrences(e, at(2026, 3, 1), at(2026, 4, 1)).length, 1);
});

test("a weekly series produces one occurrence per week", () => {
  // 2026-01-05 is a Monday; four Mondays fall in January from the 5th.
  const e = weekly(at(2026, 1, 5, 9, 0), at(2026, 1, 5, 11, 0), "MO");
  const got = expandOccurrences(e, at(2026, 1, 1), at(2026, 2, 1));
  assert.deepEqual(
    got.map((o) => o.start.getDate()),
    [5, 12, 19, 26]
  );
  for (const o of got) {
    assert.equal(o.start.getHours(), 9);
    assert.equal(o.end.getTime() - o.start.getTime(), 2 * 60 * 60 * 1000);
  }
});

test("a multi-day BYDAY series is expanded on every listed weekday, sorted", () => {
  const e = weekly(at(2026, 1, 5, 9, 0), at(2026, 1, 5, 10, 0), "MO,WE");
  const got = expandOccurrences(e, at(2026, 1, 1), at(2026, 1, 20));
  assert.deepEqual(
    got.map((o) => `${o.start.getMonth() + 1}/${o.start.getDate()}`),
    ["1/5", "1/7", "1/12", "1/14", "1/19"]
  );
  const times = got.map((o) => o.start.getTime());
  assert.deepEqual(times, [...times].sort((a, b) => a - b), "occurrences must be sorted");
});

test("occurrences before the series start date are skipped", () => {
  // Series starts 2026-02-02; asking from January must not back-fill January.
  const e = weekly(at(2026, 2, 2, 9, 0), at(2026, 2, 2, 10, 0), "MO");
  const got = expandOccurrences(e, at(2026, 1, 1), at(2026, 3, 1));
  assert.ok(got.every((o) => o.start >= at(2026, 2, 2)));
  assert.equal(got[0].start.getTime(), at(2026, 2, 2, 9, 0).getTime());
});

test("a series is still found long after its anchor date (the dashboard bug)", () => {
  // The old dashboard query used `start >= now`, so a series anchored months ago
  // vanished from "Up Next" entirely.
  const e = weekly(at(2026, 1, 5, 9, 0), at(2026, 1, 5, 10, 0), "MO");
  const got = expandOccurrences(e, at(2026, 6, 1), at(2026, 6, 8));
  assert.equal(got.length, 1);
  assert.equal(got[0].start.getTime(), at(2026, 6, 1, 9, 0).getTime());
});

test("an absurd range is capped instead of expanding forever", () => {
  const e = weekly(at(2020, 1, 6, 9, 0), at(2020, 1, 6, 10, 0), "MO");
  const got = expandOccurrences(e, at(2020, 1, 1), at(9999, 12, 31));
  assert.equal(got.length, MAX_OCCURRENCES_PER_SERIES);
});

test("the cap applies across multi-day series too", () => {
  const e = weekly(at(2020, 1, 6, 9, 0), at(2020, 1, 6, 10, 0), "MO,TU,WE,TH,FR");
  const got = expandOccurrences(e, at(2020, 1, 1), at(9999, 12, 31));
  assert.ok(got.length <= MAX_OCCURRENCES_PER_SERIES * 5);
  assert.ok(got.length > 0);
});

test("an empty range yields nothing rather than looping", () => {
  const e = weekly(at(2026, 1, 5, 9, 0), at(2026, 1, 5, 10, 0), "MO");
  assert.equal(expandOccurrences(e, at(2026, 3, 1), at(2026, 3, 1)).length, 0);
});

test("invalid dates yield nothing instead of throwing", () => {
  const e = { start: "not-a-date", end: "also-bad", isRecurring: false };
  assert.equal(expandOccurrences(e, at(2026, 1, 1), at(2026, 2, 1)).length, 0);
});

test("weekly occurrences keep their wall-clock time across a DST boundary", () => {
  // US DST starts 2026-03-08. A 09:00 class must stay at 09:00 local either side.
  const e = weekly(at(2026, 3, 2, 9, 0), at(2026, 3, 2, 10, 0), "MO");
  const got = expandOccurrences(e, at(2026, 3, 1), at(2026, 3, 31));
  assert.ok(got.length >= 4);
  for (const o of got) assert.equal(o.start.getHours(), 9);
});

test("a zero-length event still expands without negative durations", () => {
  const e = weekly(at(2026, 1, 5, 9, 0), at(2026, 1, 5, 9, 0), "MO");
  const got = expandOccurrences(e, at(2026, 1, 1), at(2026, 1, 20));
  for (const o of got) assert.ok(o.end.getTime() >= o.start.getTime());
});
