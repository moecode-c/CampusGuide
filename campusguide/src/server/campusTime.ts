/**
 * Pins the server process to campus time.
 *
 * Every piece of date arithmetic on the server — weekly recurrence, the schedule
 * importer, the event editor's setHours() — works in the process's *local*
 * timezone. That is correct only while local time is campus time.
 *
 * On a machine in Cairo it is. On Vercel, which runs UTC, it is not: Egypt keeps
 * DST (EEST, UTC+3) from late April to late October and EET (UTC+2) the rest of
 * the year, while UTC never shifts. A weekly 09:00 lecture created in September
 * would expand at the right instant until the DST change and then render an hour
 * early for the whole second half of term — silently, with no error anywhere.
 *
 * Rather than rewrite four modules' worth of local-time arithmetic to be
 * zone-explicit, the process is pinned to the one timezone the whole app is
 * written for. CampusGuide serves a single campus in a single city; there is no
 * second timezone for this to be wrong about.
 *
 * Assigning `process.env.TZ` invalidates Node's cached zone, so this takes
 * effect immediately as long as it runs before the first date calculation —
 * which is why it is called on import by the modules that do them.
 */

export const CAMPUS_TIMEZONE = "Africa/Cairo";

let applied = false;

/** Idempotent; safe to call from every module that needs it. */
export function ensureCampusTimezone(): void {
  if (applied) return;
  applied = true;

  try {
    if (currentTimezone() === CAMPUS_TIMEZONE) return;

    process.env.TZ = CAMPUS_TIMEZONE;

    if (currentTimezone() !== CAMPUS_TIMEZONE) {
      // Loud, because the symptom is a timetable that is quietly an hour out
      // for half the year rather than anything that looks like a failure.
      console.error(
        `[campusTime] could not pin the process to ${CAMPUS_TIMEZONE} ` +
          `(still ${currentTimezone()}). Recurring classes will drift by an hour ` +
          `across Egypt's DST change. Set TZ=${CAMPUS_TIMEZONE} on the host.`
      );
    }
  } catch (err) {
    console.error("[campusTime] failed to set the process timezone", err);
  }
}

function currentTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Whether the process is running on campus time. Used by the tests and the guard above. */
export function isOnCampusTime(): boolean {
  return currentTimezone() === CAMPUS_TIMEZONE;
}
