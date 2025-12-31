import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { Event, EventTypes } from "@/server/models/Event";
import { getSemesterTemplateForYear } from "@/server/data/semesterTemplates";
import { RRule } from "rrule";
import { computeExdatesForRule } from "@/server/calendar/exdates";
import { jsonWithEtag, noStoreJson } from "@/server/httpCache";

function toRRuleUtcDate(dt: Date) {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}T${pad2(dt.getUTCHours())}${pad2(dt.getUTCMinutes())}${pad2(dt.getUTCSeconds())}Z`;
}

function toFullCalendarRRuleString(rrule: string, dtstart: Date) {
  const trimmed = rrule.trim();
  const rruleLine = trimmed.toUpperCase().startsWith("RRULE:") ? trimmed : `RRULE:${trimmed}`;
  return `DTSTART:${toRRuleUtcDate(dtstart)}\n${rruleLine}`;
}

const isoDate = z.string().datetime();

const baseSchema = z.object({
  title: z.string().min(1).max(120).transform((v) => v.trim()),
  type: z.enum([EventTypes.Lecture, EventTypes.Lab]),
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
        professor: e.professor ?? null,
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
        rrule: toFullCalendarRRuleString(e.rrule, dtstart),
        duration: { milliseconds: durationMs },
        exdate,
      };
    }

    return {
      ...common,
      start: new Date(e.start).toISOString(),
      end: new Date(e.end).toISOString(),
    };
  });

  return jsonWithEtag(
    req,
    {
      events,
      template: tpl
        ? {
            startDate: tpl.startDate,
            endDate: tpl.endDate,
            excludedRanges: tpl.excludedRanges,
            maxAbsencePercent: tpl.maxAbsencePercent,
          }
        : null,
    },
    { cacheControl: "private, max-age=0, must-revalidate" }
  );
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

  return noStoreJson({ id: String(created._id) }, 201);
}

export async function DELETE(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:events:bulk-delete");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type !== EventTypes.Lecture) {
    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const res = await Event.deleteMany({ userId: session.user.id, type: EventTypes.Lecture });

  return noStoreJson({ ok: true, deleted: res.deletedCount ?? 0 }, 200);
}
