import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { Event, EventTypes } from "@/server/models/Event";
import { getSemesterTemplateForYear } from "@/server/data/semesterTemplates";
import { RRule } from "rrule";
import { computeExdatesForRule } from "@/server/calendar/exdates";

const isoDate = z.string().datetime();

const baseSchema = z.object({
  title: z.string().min(1).max(120).transform((v) => v.trim()),
  type: z.enum([EventTypes.Lecture, EventTypes.Lab, EventTypes.Midterm, EventTypes.Assignment]),
  start: isoDate,
  end: isoDate,
  roomCode: z.string().max(16).optional().transform((v) => (v ? v.trim().toUpperCase() : undefined)),
  building: z.string().max(8).optional().transform((v) => (v ? v.trim().toUpperCase() : undefined)),
  isRecurring: z.boolean().optional().default(false),
  rrule: z.string().max(500).optional(),
});

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:events:get");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();

  const items = await Event.find({ userId: session.user.id }).sort({ start: 1 }).lean();
  const tpl = await getSemesterTemplateForYear(session.user.academicYear);
  const excluded = (tpl?.excludedRanges ?? []).map((r: any) => ({ start: new Date(r.start), end: new Date(r.end) }));

  const events = items.map((e: any) => {
    const common = {
      id: String(e._id),
      title: e.title,
      extendedProps: {
        type: e.type,
        roomCode: e.roomCode ?? null,
        building: e.building ?? null,
        isRecurring: Boolean(e.isRecurring),
      },
    };

    if (e.isRecurring && e.rrule) {
      const dtstart = new Date(e.start);
      const dtend = new Date(e.end);
      const durationMs = dtend.getTime() - dtstart.getTime();

      // Stored string is an RRULE string (without DTSTART). We attach dtstart.
      const parsed = RRule.fromString(e.rrule);
      const options = { ...parsed.origOptions, dtstart };
      const rule = new RRule(options);
      const exdate = computeExdatesForRule({ rrule: rule, dtstart, excludedRanges: excluded });

      return {
        ...common,
        rrule: {
          ...options,
          dtstart: dtstart.toISOString(),
        },
        duration: { milliseconds: durationMs },
        exdate,
      };
    }

    return { ...common, start: new Date(e.start).toISOString(), end: new Date(e.end).toISOString() };
  });

  return new Response(JSON.stringify({ events, template: tpl ? { startDate: tpl.startDate, endDate: tpl.endDate, excludedRanges: tpl.excludedRanges, maxAbsencePercent: tpl.maxAbsencePercent } : null }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:events:post");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const json = await req.json().catch(() => null);
  const parsed = baseSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const start = new Date(parsed.data.start);
  const end = new Date(parsed.data.end);
  if (!(start < end)) {
    return new Response(JSON.stringify({ error: "End must be after start" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (parsed.data.isRecurring && !parsed.data.rrule) {
    return new Response(JSON.stringify({ error: "Recurring events require rrule" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const created = await Event.create({
    userId: session.user.id,
    title: parsed.data.title,
    type: parsed.data.type,
    start,
    end,
    roomCode: parsed.data.roomCode,
    building: parsed.data.building,
    isRecurring: Boolean(parsed.data.isRecurring),
    rrule: parsed.data.isRecurring ? parsed.data.rrule : undefined,
  });

  return new Response(JSON.stringify({ id: String(created._id) }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}
