import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { Event, EventTypes } from "@/server/models/Event";
import { Attendance } from "@/server/models/Attendance";
import { jsonWithEtag, noStoreJson } from "@/server/httpCache";
import { expandOccurrences } from "@/server/calendar/recurrence";

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

  // A course imported for two weekdays is stored as two Event documents that
  // share a series key. Group first, otherwise both the session totals and the
  // (per-key) missed count get added once per document.
  const grouped = new Map<string, { key: string; title: string; type: string; total: number; missed: number }>();

  for (const e of events as any[]) {
    const key = seriesKey(e.title, e.type);
    const count = expandOccurrences(e, windowStart, windowEnd).length;

    const existing = grouped.get(key);
    if (existing) {
      existing.total += count;
      continue;
    }

    grouped.set(key, {
      key,
      title: e.title,
      type: e.type,
      total: count,
      missed: missedByKey.get(key) ?? 0,
    });
  }

  const series = Array.from(grouped.values());
  const totalSessions = series.reduce((sum, s) => sum + s.total, 0);
  const missedSessions = series.reduce((sum, s) => sum + s.missed, 0);

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
