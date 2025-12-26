import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { Event, EventTypes } from "@/server/models/Event";
import { Attendance } from "@/server/models/Attendance";
import { getSemesterTemplateForYear } from "@/server/data/semesterTemplates";
import { RRule } from "rrule";

function inExcluded(date: Date, ranges: Array<{ start: Date; end: Date }>) {
  return ranges.some((r) => date >= r.start && date <= r.end);
}

function seriesKey(title: string, type: string) {
  return `${type}:${title.trim().toLowerCase()}`;
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

  const tpl = await getSemesterTemplateForYear(session.user.academicYear);
  if (!tpl) {
    return new Response(JSON.stringify({ error: "Semester template not configured for your academic year" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  const termStart = new Date(tpl.startDate);
  const termEnd = new Date(tpl.endDate);
  const excluded = (tpl.excludedRanges ?? []).map((r: any) => ({ start: new Date(r.start), end: new Date(r.end) }));

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
      const dtstart = new Date(e.start);
      const parsed = RRule.fromString(e.rrule);
      const rule = new RRule({ ...parsed.origOptions, dtstart });
      const between = rule.between(termStart, termEnd, true);
      count = between.filter((d) => !inExcluded(d, excluded)).length;
    } else {
      const d = new Date(e.start);
      if (d >= termStart && d <= termEnd && !inExcluded(d, excluded)) count = 1;
    }

    totalSessions += count;
    missedSessions += missed;

    series.push({ key, title: e.title, type: e.type, total: count, missed });
  }

  const allowedAbsences = Math.floor((totalSessions * (tpl.maxAbsencePercent ?? 25)) / 100);
  const remainingAllowed = Math.max(allowedAbsences - missedSessions, 0);

  const status = missedSessions > allowedAbsences ? "risk" : missedSessions > Math.floor(allowedAbsences * 0.6) ? "warning" : "safe";

  return new Response(
    JSON.stringify({
      summary: {
        totalSessions,
        missedSessions,
        allowedAbsences,
        remainingAllowed,
        status,
        maxAbsencePercent: tpl.maxAbsencePercent ?? 25,
      },
      series: series.sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title)),
    }),
    { status: 200, headers: { "content-type": "application/json" } }
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

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
