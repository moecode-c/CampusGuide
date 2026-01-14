import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { Event, EventTypes } from "@/server/models/Event";
import { Attendance } from "@/server/models/Attendance";
import { jsonWithEtag, noStoreJson } from "@/server/httpCache";

function seriesKey(title: string, type: string) {
  return `${type}:${title.trim().toLowerCase()}`;
}

function dayCodeToNumber(code: string) {
  const map: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  return map[code] ?? null;
}

function parseByDays(rrule: string | null | undefined, fallbackStart: Date) {
  const body = String(rrule ?? "").trim().toUpperCase().replace(/^RRULE:/, "");
  const m = body.match(/(^|;)BYDAY=([A-Z,]+)/);
  const codes = m?.[2]?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const dows = codes.map(dayCodeToNumber).filter((n): n is number => typeof n === "number");
  if (dows.length) return Array.from(new Set(dows));
  return [fallbackStart.getDay()];
}

function dateOnlyLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function maxDate(a: Date, b: Date) {
  return a.getTime() >= b.getTime() ? a : b;
}

function nextDowOnOrAfterLocal(fromDate: Date, dow: number) {
  const d = dateOnlyLocal(fromDate);
  const delta = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

const patchSchema = z.object({
  key: z.string().min(1).max(200),
  missedCount: z.number().int().min(0).max(999),
});

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:attendance:get");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();

  // Semester templates removed: compute attendance over a rolling year window.
  const now = new Date();
  const windowStart = now;
  const windowEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const maxAbsencePercent = 25;

  const events = await Event.find({
    userId: session.user.id,
    type: { $in: [EventTypes.Lecture, EventTypes.Lab] },
  }).lean();

  const attendance = await Attendance.find({ userId: session.user.id }).lean();
  const missedByKey = new Map(attendance.map((a: any) => [a.key, a.missedCount]));

  const series: Array<{ key: string; title: string; type: string; total: number; missed: number }> = [];

  let totalSessions = 0;
  let missedSessions = 0;

  for (const e of events as any[]) {
    const key = seriesKey(e.title, e.type);
    const missed = missedByKey.get(key) ?? 0;

    let count = 0;
    if (e.isRecurring && e.rrule) {
      const startBase = new Date(e.start);
      const endBase = new Date(e.end);
      const durationMs = endBase.getTime() - startBase.getTime();

      const bydays = parseByDays(e.rrule, startBase);
      const hh = startBase.getHours();
      const mm = startBase.getMinutes();

      const seriesStartDay = dateOnlyLocal(startBase);
      const searchFrom = maxDate(seriesStartDay, dateOnlyLocal(windowStart));

      for (const dow of bydays) {
        let day = nextDowOnOrAfterLocal(searchFrom, dow);
        while (day.getTime() < windowEnd.getTime()) {
          const startOcc = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm, 0, 0);
          if (startOcc.getTime() < startBase.getTime()) {
            day.setDate(day.getDate() + 7);
            continue;
          }
          const endOcc = new Date(startOcc.getTime() + durationMs);
          if (endOcc > windowStart && startOcc < windowEnd) count += 1;
          day.setDate(day.getDate() + 7);
        }
      }
    } else {
      const d = new Date(e.start);
      if (d >= windowStart && d <= windowEnd) count = 1;
    }

    totalSessions += count;
    missedSessions += missed;

    series.push({ key, title: e.title, type: e.type, total: count, missed });
  }

  const allowedAbsences = Math.floor((totalSessions * maxAbsencePercent) / 100);
  const remainingAllowed = Math.max(allowedAbsences - missedSessions, 0);

  const status = missedSessions > allowedAbsences ? "risk" : missedSessions > Math.floor(allowedAbsences * 0.6) ? "warning" : "safe";

  return jsonWithEtag(
    req,
    {
      summary: {
        totalSessions,
        missedSessions,
        allowedAbsences,
        remainingAllowed,
        status,
        maxAbsencePercent,
      },
      series: series.sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title)),
    },
    { cacheControl: "private, max-age=30, stale-while-revalidate=300" }
  );
}

export async function PATCH(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:attendance:patch");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  await Attendance.updateOne(
    { userId: session.user.id, key: parsed.data.key },
    { $set: { missedCount: parsed.data.missedCount } },
    { upsert: true }
  );

  return noStoreJson({ ok: true }, 200);
}
