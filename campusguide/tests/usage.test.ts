import test from "node:test";
import assert from "node:assert/strict";
import {
  STALENESS,
  STALENESS_LABELS,
  downloadsLabel,
  openedShare,
  openedShareLabel,
  staleness,
} from "../src/lib/usage";

const NOW = new Date("2026-08-30T12:00:00.000Z");

function daysBefore(days: number) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

test("a file with no recorded download is never-opened, not merely stale", () => {
  assert.equal(staleness(null, NOW), STALENESS.Never);
});

test("staleness buckets by how long ago the last download was", () => {
  assert.equal(staleness(daysBefore(0), NOW), STALENESS.Recent);
  assert.equal(staleness(daysBefore(6), NOW), STALENESS.Recent);
  assert.equal(staleness(daysBefore(30), NOW), STALENESS.Quiet);
  assert.equal(staleness(daysBefore(120), NOW), STALENESS.Stale);
});

test("the bucket boundaries fall on the documented side", () => {
  assert.equal(staleness(daysBefore(7), NOW), STALENESS.Recent, "7 days is still this week");
  assert.equal(staleness(daysBefore(7.1), NOW), STALENESS.Quiet);
  assert.equal(staleness(daysBefore(90), NOW), STALENESS.Quiet, "90 days is not yet stale");
  assert.equal(staleness(daysBefore(90.1), NOW), STALENESS.Stale);
});

test("an unparseable timestamp is treated as never opened rather than crashing the page", () => {
  assert.equal(staleness("not a date", NOW), STALENESS.Never);
  assert.equal(staleness("", NOW), STALENESS.Never);
});

test("every bucket has a label, so no badge can render blank", () => {
  for (const value of Object.values(STALENESS)) {
    assert.ok(STALENESS_LABELS[value], `${value} has no label`);
  }
});

test("opened share is a whole percent and never divides by zero", () => {
  assert.equal(openedShare(0, 0), 0, "an empty drive is 0%, not NaN");
  assert.equal(openedShare(213, 426), 50);
  assert.equal(openedShare(426, 426), 100);
  assert.equal(openedShare(1, 3), 33);
});

test("a share that rounds to zero is shown as <1%, not 0%", () => {
  // The normal case for the first week: a few downloads against 426 files.
  assert.equal(openedShareLabel(1, 426), "<1%");
  assert.equal(openedShareLabel(0, 426), "0%", "genuinely nothing opened stays 0%");
  assert.equal(openedShareLabel(0, 0), "0%", "an empty drive stays 0%");
  assert.equal(openedShareLabel(213, 426), "50%");
});

test("the download count reads correctly at one", () => {
  assert.equal(downloadsLabel(0), "0 downloads");
  assert.equal(downloadsLabel(1), "1 download");
  assert.equal(downloadsLabel(426), "426 downloads");
});
