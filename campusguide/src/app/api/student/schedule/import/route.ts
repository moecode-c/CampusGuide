import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { Event, EventTypes } from "@/server/models/Event";

import { ensureCampusTimezone } from "@/server/campusTime";

// The importer builds each class time with setHours() in local time; pin the
// process to campus time before any of it runs.
ensureCampusTimezone();

// `\d{2}:\d{2}` alone accepts "99:99", which setHours() would roll over into
// another day and produce events with a negative or absurd duration.
const clockTime = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be HH:MM (24-hour)");

const rowSchema = z.object({
  title: z.string().min(1).max(120).trim(),
  type: z.enum([EventTypes.Lecture, EventTypes.Lab]),
  dayOfWeek: z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]),
  startTime: clockTime,
  endTime: clockTime,
  roomCode: z.string().max(16).optional().transform((v) => (v ? v.trim().toUpperCase() : undefined)),
  professor: z.string().max(100).optional().transform((v) => v?.trim()),
});

const schema = z.object({
  rows: z.array(rowSchema).min(1).max(200),
});

function nextDateForDow(from: Date, dow: string) {
  const map: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const target = map[dow];
  const d = new Date(from);
  const delta = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function withTime(date: Date, hhmm: string) {
  const [hh, mm] = hhmm.split(":").map((n) => Number(n));
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d;
}

export async function POST(req: Request) {
  // Import can be abused; keep it tighter than general endpoints.
  const limited = await enforceRateLimit(req.headers, "student:schedule:import", { points: 10, duration: 60 });
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Additional per-user limiter so shared networks don't block each other.
  const limitedUser = await enforceRateLimit(req.headers, "student:schedule:import:user", {
    points: 20,
    duration: 60,
    identity: session.user.id,
  });
  if (limitedUser) return limitedUser;

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Invalid input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const badRange = parsed.data.rows.find((r) => r.endTime <= r.startTime);
  if (badRange) {
    return new Response(
      JSON.stringify({ error: `"${badRange.title}": end time must be after start time` }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  // Year-round schedule: don't tie imported events to a semester end date.
  // We anchor the series to the next matching weekday starting from "now".
  const baseStart = new Date();

  await connectToDatabase();

  const docs = parsed.data.rows.map((r) => {
    const firstDay = nextDateForDow(baseStart, r.dayOfWeek);
    const start = withTime(firstDay, r.startTime);
    const end = withTime(firstDay, r.endTime);

    return {
      userId: session.user.id,
      title: r.title,
      type: r.type,
      start,
      end,
      roomCode: r.roomCode || undefined,
      professor: r.professor || undefined,
      isRecurring: true,
      rrule: `FREQ=WEEKLY;BYDAY=${r.dayOfWeek}`,
    };
  });

  await Event.insertMany(docs);

  return new Response(JSON.stringify({ ok: true, imported: docs.length }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
