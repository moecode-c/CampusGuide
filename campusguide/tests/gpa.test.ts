import test from "node:test";
import assert from "node:assert/strict";
import { getGpaPlugin } from "../src/lib/gpa";

const best = getGpaPlugin("midterm-40-best");
const worst = getGpaPlugin("midterm-40-worst");
const midtermOnly = getGpaPlugin("midterm-only");

const s = (subject: string, midtermMark: number, creditHours = 3) => ({ subject, midtermMark, creditHours });

test("getGpaPlugin falls back to midterm-only for an unknown id", () => {
  assert.equal(getGpaPlugin("nope").id, "midterm-only");
  assert.equal(getGpaPlugin("midterm-40-best").id, "midterm-40-best");
});

test("best-case 0-40 boundaries map to the documented letters", () => {
  const cases: Array<[number, string]> = [
    [40, "A"], [34, "A"], [33.9, "A-"], [28, "A-"], [27, "B+"], [24, "B+"],
    [23, "B"], [21, "B"], [20, "B-"], [19, "C+"], [18, "C"], [16, "C-"],
    [13, "D"], [12.9, "F"], [0, "F"],
  ];
  for (const [mark, letter] of cases) {
    assert.equal(best.compute([s("X", mark)]).items[0].letter, letter, `best(${mark})`);
  }
});

test("worst-case 0-40 boundaries map to the documented letters", () => {
  const cases: Array<[number, string]> = [
    [40, "A"], [36, "A"], [35, "A-"], [33, "A-"], [32, "B+"], [29, "B+"],
    [28, "B"], [26, "B"], [25, "B-"], [24, "C+"], [23, "C"], [21, "C-"],
    [15, "D"], [14, "F"],
  ];
  for (const [mark, letter] of cases) {
    assert.equal(worst.compute([s("X", mark)]).items[0].letter, letter, `worst(${mark})`);
  }
});

test("worst-case is never better than best-case for the same mark", () => {
  for (let mark = 0; mark <= 40; mark += 0.5) {
    const b = best.compute([s("X", mark)]).overallGpa;
    const w = worst.compute([s("X", mark)]).overallGpa;
    assert.ok(w <= b, `mark ${mark}: worst ${w} > best ${b}`);
  }
});

test("marks are clamped into 0-40 instead of skewing the GPA", () => {
  assert.equal(best.compute([s("X", 999)]).items[0].midtermMark, 40);
  assert.equal(best.compute([s("X", -50)]).items[0].midtermMark, 0);
  assert.equal(best.compute([s("X", -50)]).items[0].letter, "F");
  assert.equal(best.compute([s("X", Number.NaN)]).items[0].midtermMark, 0);
});

test("GPA is credit-weighted, not a plain average", () => {
  // A (4.0) over 6 credits + F (0.0) over 1 credit => 24/7 = 3.43
  const out = best.compute([s("Heavy", 40, 6), s("Light", 0, 1)]);
  assert.equal(out.overallGpa, 3.43);
});

test("credit hours are clamped to a sane range", () => {
  assert.equal(best.compute([s("X", 40, 9999)]).items[0].creditHours, 10);
  assert.equal(best.compute([s("X", 40, -5)]).items[0].creditHours, 0);
  assert.equal(best.compute([s("X", 40, Number.NaN)]).items[0].creditHours, 3);
});

test("zero total credits yields 0 rather than NaN", () => {
  const out = best.compute([s("X", 40, 0)]);
  assert.equal(out.overallGpa, 0);
  assert.ok(Number.isFinite(out.overallGpa));
});

test("empty and blank-subject inputs are dropped safely", () => {
  assert.deepEqual(best.compute([]), { items: [], overallGpa: 0 });
  assert.equal(best.compute([s("   ", 40)]).items.length, 0);
});

test("subject whitespace is normalized", () => {
  assert.equal(best.compute([s("  Data   Structures  ", 40)]).items[0].subject, "Data Structures");
});

test("the 0-100 plugin would grade every 0-40 mark an F (why the dashboard switched)", () => {
  // Regression guard for the dashboard bug: marks are stored out of 40, and the
  // midterm-only scale needs >= 50 for anything above F.
  assert.equal(midtermOnly.compute([s("X", 40)]).overallGpa, 0);
  assert.equal(midtermOnly.compute([s("X", 90)]).overallGpa, 4);
});

test("the dashboard and estimator agree on the same saved marks", () => {
  const saved = [s("Calculus", 34, 3), s("Physics", 21, 4), s("Programming", 38, 3)];
  const low = Math.min(best.compute(saved).overallGpa, worst.compute(saved).overallGpa);
  const high = Math.max(best.compute(saved).overallGpa, worst.compute(saved).overallGpa);
  assert.ok(low > 0, "a student with strong marks must not read 0.00");
  assert.ok(high >= low);
  assert.ok(high <= 4);
});
