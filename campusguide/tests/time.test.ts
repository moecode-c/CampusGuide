import test from "node:test";
import assert from "node:assert/strict";
import { normalizeClockTime } from "../src/lib/time";

test("already-valid times pass through unchanged", () => {
  assert.equal(normalizeClockTime("09:00"), "09:00");
  assert.equal(normalizeClockTime("23:59"), "23:59");
  assert.equal(normalizeClockTime("00:00"), "00:00");
});

test("single-digit hours and minutes are zero-padded", () => {
  assert.equal(normalizeClockTime("9:00"), "09:00");
  assert.equal(normalizeClockTime("9:5"), "09:05");
});

test("trailing seconds are dropped", () => {
  assert.equal(normalizeClockTime("09:00:00"), "09:00");
  assert.equal(normalizeClockTime("9:30:45"), "09:30");
});

test("surrounding whitespace is tolerated", () => {
  assert.equal(normalizeClockTime("  14:30 "), "14:30");
});

test("out-of-range clock values are rejected rather than rolled over", () => {
  // "99:99" used to reach setHours() and silently shift the event days ahead.
  assert.equal(normalizeClockTime("99:99"), "");
  assert.equal(normalizeClockTime("24:00"), "");
  assert.equal(normalizeClockTime("12:60"), "");
});

test("non-time input yields an empty string", () => {
  for (const bad of ["", "   ", "noon", "9", "9am", "9.30", "-1:00", null, undefined]) {
    assert.equal(normalizeClockTime(bad as any), "", `"${bad}" should be rejected`);
  }
});

test("normalized times compare correctly as strings", () => {
  // The UI compares end <= start lexically, which only holds when zero-padded.
  assert.ok(normalizeClockTime("9:00") < normalizeClockTime("11:00"));
  assert.ok(normalizeClockTime("9:00") > normalizeClockTime("08:59"));
});
