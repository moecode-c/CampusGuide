import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { Event, EventTypes } from "@/server/models/Event";
import { getSemesterTemplateForYear } from "@/server/data/semesterTemplates";

const rowSchema = z.object({
  title: z.string().min(1).max(120).trim(),
  type: z.enum([EventTypes.Lecture, EventTypes.Lab]),
  dayOfWeek: z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  roomCode: z.string().max(16).optional().transform((v) => (v ? v.trim().toUpperCase() : undefined)),
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
  const limited = await enforceRateLimit(req.headers, "student:schedule:import");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const tpl = await getSemesterTemplateForYear(session.user.academicYear);
  if (!tpl) {
    return new Response(JSON.stringify({ error: "Semester template not configured for your academic year" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  const termStart = new Date(tpl.startDate);
  const termEnd = new Date(tpl.endDate);
  const until = termEnd.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  await connectToDatabase();

  const docs = parsed.data.rows.map((r) => {
    const firstDay = nextDateForDow(termStart, r.dayOfWeek);
    const start = withTime(firstDay, r.startTime);
    const end = withTime(firstDay, r.endTime);

    return {
      userId: session.user.id,
      title: r.title,
      type: r.type,
      start,
      end,
      roomCode: r.roomCode,
      isRecurring: true,
      rrule: `FREQ=WEEKLY;BYDAY=${r.dayOfWeek};UNTIL=${until}`,
    };
  });

  await Event.insertMany(docs);

  return new Response(JSON.stringify({ ok: true, imported: docs.length }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
