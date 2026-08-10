/**
 * Guards the two things that made the admin signup chart render as an empty box:
 * a sparse series, and percentage bar heights that collapsed to zero.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { barHeight, densifyDays } from "../src/lib/chart";

const anchor = new Date(2026, 7, 10); // 10 Aug 2026, local time

test("a sparse series is expanded to one entry per day, oldest first", () => {
  const days = densifyDays([{ date: "2026-08-10", count: 2 }], 14, anchor);

  assert.equal(days.length, 14, "a fortnight must always draw fourteen columns");
  assert.equal(days[0].date, "2026-07-28");
  assert.equal(days[13].date, "2026-08-10");
  assert.equal(days[13].count, 2, "the day that had signups keeps its count");
  assert.equal(days[12].count, 0, "days the aggregation skipped fill in as zero");
});

test("an empty series still produces a full axis", () => {
  const days = densifyDays([], 14, anchor);

  assert.equal(days.length, 14);
  assert.ok(
    days.every((d) => d.count === 0),
    "no signups means every column is zero, not a missing chart"
  );
});

test("dates outside the window are ignored", () => {
  const days = densifyDays(
    [
      { date: "2026-08-10", count: 1 },
      { date: "2025-01-01", count: 99 },
    ],
    14,
    anchor
  );

  assert.equal(days.length, 14);
  assert.equal(
    days.reduce((sum, d) => sum + d.count, 0),
    1,
    "a stale row must not leak into the total"
  );
});

test("bar heights are real pixels, never zero", () => {
  // The original bug: bars resolved to 0 and only the date labels showed.
  assert.equal(barHeight(2, 2, 132), 132, "the tallest bar fills the chart");
  assert.equal(barHeight(1, 2, 132), 66);
  assert.equal(barHeight(0, 2, 132), 3, "empty days keep a visible sliver");
  assert.ok(barHeight(1, 1000, 132) >= 6, "a tiny share still renders a clickable bar");
});

test("a max of zero cannot produce a division by zero", () => {
  assert.equal(barHeight(0, 0, 132), 3);
  assert.ok(Number.isFinite(barHeight(1, 0, 132)));
});
