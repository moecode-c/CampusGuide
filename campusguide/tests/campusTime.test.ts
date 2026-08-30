import test from "node:test";
import assert from "node:assert/strict";

/**
 * Guards the DST bug.
 *
 * The server does its weekly-recurrence arithmetic in the process's local
 * timezone. On a UTC host — which is what Vercel runs — a 09:00 Cairo lecture
 * expanded at the right instant until Egypt's DST ended in late October and then
 * rendered an hour early for the rest of term. Nothing errored; the timetable
 * was just wrong.
 *
 * `ensureCampusTimezone()` pins the process on import, so this file pretends to
 * be a UTC host *before* loading the module and then checks the wall-clock time
 * a student in Cairo would actually see. Remove the pin and these fail.
 */

// Set before any import of the calendar code below — this is the condition the
// pin has to overcome. The imports are dynamic for the same reason: a static one
// would be hoisted above this line and the test would prove nothing.
process.env.TZ = "UTC";

const wasUtcBeforeImport = Intl.DateTimeFormat().resolvedOptions().timeZone === "UTC";

const calendar = () => import("../src/server/calendar/recurrence");
const campus = () => import("../src/server/campusTime");

/** How a student sitting in Cairo would actually read the occurrence. */
function cairoClock(d: Date): string {
  return d.toLocaleString("en-GB", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

test("the test really did start out on a UTC host", () => {
  assert.ok(wasUtcBeforeImport, "otherwise this whole file proves nothing");
});

test("importing the calendar code pins the process to campus time", async () => {
  await calendar();
  const { CAMPUS_TIMEZONE, isOnCampusTime } = await campus();

  assert.equal(CAMPUS_TIMEZONE, "Africa/Cairo");
  assert.ok(
    isOnCampusTime(),
    "the process started in UTC and should have been pinned back to campus time"
  );
});

test("a weekly 09:00 class stays at 09:00 across Egypt's autumn DST change", async () => {
  const { expandOccurrences } = await calendar();

  // Egypt leaves EEST (UTC+3) for EET (UTC+2) on the last Thursday of October.
  const occurrences = expandOccurrences(
    {
      start: new Date("2026-09-07T09:00:00+03:00"),
      end: new Date("2026-09-07T10:30:00+03:00"),
      isRecurring: true,
      rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO",
    },
    new Date("2026-09-01T00:00:00Z"),
    new Date("2026-11-30T00:00:00Z")
  );

  assert.ok(occurrences.length >= 10, "expected a term's worth of Mondays");

  const before = occurrences.filter((o) => o.start < new Date("2026-10-29T00:00:00Z"));
  const after = occurrences.filter((o) => o.start > new Date("2026-11-01T00:00:00Z"));
  assert.ok(before.length > 0 && after.length > 0, "the range must straddle the DST change");

  for (const o of occurrences) {
    assert.equal(cairoClock(o.start), "09:00", `occurrence on ${o.start.toISOString()} drifted`);
  }
});

test("a weekly class stays put across the spring DST change too", async () => {
  const { expandOccurrences } = await calendar();

  // Last Friday of April, in the other direction.
  const occurrences = expandOccurrences(
    {
      start: new Date("2026-04-06T14:00:00+02:00"),
      end: new Date("2026-04-06T15:00:00+02:00"),
      isRecurring: true,
      rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO",
    },
    new Date("2026-04-01T00:00:00Z"),
    new Date("2026-05-31T00:00:00Z")
  );

  assert.ok(occurrences.length >= 6, "expected roughly two months of Mondays");
  for (const o of occurrences) {
    assert.equal(cairoClock(o.start), "14:00", `occurrence on ${o.start.toISOString()} drifted`);
  }
});

test("each occurrence keeps the original duration through the change", async () => {
  const { expandOccurrences } = await calendar();

  const occurrences = expandOccurrences(
    {
      start: new Date("2026-10-05T09:00:00+03:00"),
      end: new Date("2026-10-05T10:30:00+03:00"),
      isRecurring: true,
      rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO",
    },
    new Date("2026-10-01T00:00:00Z"),
    new Date("2026-11-30T00:00:00Z")
  );

  assert.ok(occurrences.length > 0);
  for (const o of occurrences) {
    const minutes = (o.end.getTime() - o.start.getTime()) / 60000;
    assert.equal(minutes, 90, `a 90-minute class became ${minutes} minutes`);
  }
});

test("the weekday is preserved across the change, not just the clock time", async () => {
  const { expandOccurrences } = await calendar();

  const occurrences = expandOccurrences(
    {
      start: new Date("2026-10-04T08:00:00+03:00"), // a Sunday, the Egyptian week start
      end: new Date("2026-10-04T09:00:00+03:00"),
      isRecurring: true,
      rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU",
    },
    new Date("2026-10-01T00:00:00Z"),
    new Date("2026-11-30T00:00:00Z")
  );

  assert.ok(occurrences.length >= 6);
  for (const o of occurrences) {
    const weekday = o.start.toLocaleString("en-GB", {
      timeZone: "Africa/Cairo",
      weekday: "long",
    });
    assert.equal(weekday, "Sunday", `occurrence on ${o.start.toISOString()} moved weekday`);
  }
});
