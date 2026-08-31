/**
 * The CSV importer is the one place a student can create a hundred events in a
 * single click, so a silently mis-parsed column is expensive to undo. These
 * cover the shapes real timetable exports arrive in.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  SCHEDULE_CSV_MAX_ROWS,
  SCHEDULE_CSV_TEMPLATE,
  parseScheduleCsv,
} from "../src/lib/scheduleCsv";

function ok(result: ReturnType<typeof parseScheduleCsv>) {
  assert.ok(result.ok, result.ok ? "" : `expected success, got: ${result.error}`);
  return result;
}

test("the documented template imports cleanly", () => {
  const result = ok(parseScheduleCsv(SCHEDULE_CSV_TEMPLATE));
  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.rows[0], {
    title: "Data Structures",
    type: "lecture",
    dayOfWeek: "SA",
    startTime: "09:00",
    endTime: "10:30",
    roomCode: "204",
    professor: "Dr. Ahmed Hassan",
  });
  assert.equal(result.rows[1].type, "lab");
});

test("optional columns may be missing entirely", () => {
  const result = ok(parseScheduleCsv("title,type,dayOfWeek,startTime,endTime\nCalculus,lecture,MO,08:00,09:30\n"));
  assert.equal(result.rows[0].roomCode, undefined);
  assert.equal(result.rows[0].professor, undefined);
});

test("spreadsheet header spellings are understood", () => {
  const result = ok(parseScheduleCsv("Course,Day,Start,End,Room,Doctor\nPhysics,Tuesday,9:00,10:30,rc1-115,Dr Sara\n"));
  assert.deepEqual(result.rows[0], {
    title: "Physics",
    type: "lecture",
    dayOfWeek: "TU",
    startTime: "09:00",
    endTime: "10:30",
    roomCode: "RC1-115",
    professor: "Dr Sara",
  });
});

test("day names are accepted in the forms people write them", () => {
  for (const [written, expected] of [["mon", "MO"], ["Wednesday", "WE"], ["th", "TH"], ["SAT", "SA"]] as const) {
    const result = ok(parseScheduleCsv(`title,dayOfWeek,startTime,endTime\nX,${written},08:00,09:00\n`));
    assert.equal(result.rows[0].dayOfWeek, expected, `"${written}" should mean ${expected}`);
  }
});

test("a day that cannot be read is reported instead of defaulting to Monday", () => {
  const result = parseScheduleCsv("title,dayOfWeek,startTime,endTime\nCalculus,Yawm,08:00,09:00\n");
  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), /Calculus/);
  assert.match(String(result.ok === false && result.error), /not a day/i);
});

test("blank spacer rows are skipped, not counted as errors", () => {
  const result = ok(parseScheduleCsv("title,dayOfWeek,startTime,endTime\nCalculus,MO,08:00,09:00\n,,,\nPhysics,TU,10:00,11:00\n"));
  assert.equal(result.rows.length, 2);
});

test("a UTF-8 BOM from Excel does not break the first header", () => {
  const result = ok(parseScheduleCsv("\uFEFFtitle,dayOfWeek,startTime,endTime\nCalculus,MO,08:00,09:00\n"));
  assert.equal(result.rows[0].title, "Calculus");
});

test("required columns are named when they are missing", () => {
  const result = parseScheduleCsv("title,startTime\nCalculus,08:00\n");
  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), /dayOfWeek/);
  assert.match(String(result.ok === false && result.error), /endTime/);
});

test("times are validated the same way the API validates them", () => {
  for (const [start, end] of [["99:99", "10:00"], ["noon", "13:00"], ["", "09:00"]]) {
    const result = parseScheduleCsv(`title,dayOfWeek,startTime,endTime\nX,MO,${start},${end}\n`);
    assert.equal(result.ok, false, `"${start}" should be rejected`);
    assert.match(String(result.ok === false && result.error), /HH:MM/);
  }
});

test("an end time that is not after the start is rejected", () => {
  const result = parseScheduleCsv("title,dayOfWeek,startTime,endTime\nCalculus,MO,11:00,09:00\n");
  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), /after the start/i);
});

test("the row number in an error matches the spreadsheet row", () => {
  const result = parseScheduleCsv("title,dayOfWeek,startTime,endTime\nA,MO,08:00,09:00\nB,MO,11:00,09:00\n");
  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), /^Row 3\b/);
});

test("a file with no usable rows is refused", () => {
  assert.equal(parseScheduleCsv("").ok, false);
  assert.equal(parseScheduleCsv("title,dayOfWeek,startTime,endTime\n").ok, false);
});

test("imports larger than the API's cap are refused before they are sent", () => {
  const body = Array.from({ length: SCHEDULE_CSV_MAX_ROWS + 1 }, (_, i) => `Course ${i},MO,08:00,09:00`).join("\n");
  const result = parseScheduleCsv(`title,dayOfWeek,startTime,endTime\n${body}\n`);
  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), new RegExp(String(SCHEDULE_CSV_MAX_ROWS)));
});
