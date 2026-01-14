import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { Event, EventTypes } from "@/server/models/Event";
import { noStoreJson } from "@/server/httpCache";

// FullCalendar commonly sends start/end with timezone offsets like "+02:00".
// Zod's default datetime() only accepts "Z"; enable offsets to avoid 400s.
const isoDate = z.string().datetime({ offset: true });

const querySchema = z.object({
  start: isoDate.optional(),
  end: isoDate.optional(),
});

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
  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Calendar navigation can trigger multiple range fetches quickly.
  // Rate limit per-user (not per-IP) and with a higher budget to avoid 429s.
  const limited = await enforceRateLimit(req.headers, "student:events:get", {
    points: 300,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  await connectToDatabase();

  const url = new URL(req.url);
  const parsedQuery = querySchema.safeParse({
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
  });

  if (!parsedQuery.success) {
    return new Response(JSON.stringify({ error: "Invalid query" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Default window if caller doesn't provide range.
  const now = new Date();
  const rangeStart = parsedQuery.data.start ? new Date(parsedQuery.data.start) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rangeEnd = parsedQuery.data.end ? new Date(parsedQuery.data.end) : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const items = await Event.find({ userId: session.user.id })
    .sort({ start: 1 })
    .select({ title: 1, type: 1, start: 1, end: 1, roomCode: 1, professor: 1, building: 1, isRecurring: 1, rrule: 1 })
    .lean();

  const expanded: any[] = [];
  for (const e of items as any[]) {
    const baseId = String(e._id);
    const type = e.type;
    const roomCode = e.roomCode ?? null;
    const professor = e.professor ?? null;
    const building = e.building ?? null;

    const startBase = new Date(e.start);
    const endBase = new Date(e.end);
    const durationMs = endBase.getTime() - startBase.getTime();

    // One-off event
    if (!e.isRecurring || !e.rrule) {
      if (endBase > rangeStart && startBase < rangeEnd) {
        expanded.push({
          id: baseId,
          title: e.title,
          start: startBase.toISOString(),
          end: endBase.toISOString(),
          extendedProps: { type, roomCode, professor, building, isRecurring: false, baseId },
        });
      }
      continue;
    }

    // Weekly recurring: expand occurrences in the requested range.
    const bydays = parseByDays(e.rrule, startBase);
    const hh = startBase.getHours();
    const mm = startBase.getMinutes();

    const seriesStartDay = dateOnlyLocal(startBase);
    const searchFrom = maxDate(seriesStartDay, dateOnlyLocal(rangeStart));

    for (const dow of bydays) {
      let day = nextDowOnOrAfterLocal(searchFrom, dow);
      while (day.getTime() < rangeEnd.getTime()) {
        const startOcc = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm, 0, 0);
        if (startOcc.getTime() < startBase.getTime()) {
          day.setDate(day.getDate() + 7);
          continue;
        }
        const endOcc = new Date(startOcc.getTime() + durationMs);
        if (endOcc > rangeStart && startOcc < rangeEnd) {
          const startIso = startOcc.toISOString();
          expanded.push({
            id: `${baseId}:${startIso}`,
            groupId: baseId,
            title: e.title,
            start: startIso,
            end: endOcc.toISOString(),
            extendedProps: { type, roomCode, professor, building, isRecurring: true, baseId },
          });
        }
        day.setDate(day.getDate() + 7);
      }
    }
  }

  // Always return fresh data so edits/imports reflect immediately in the calendar.
  return noStoreJson(
    {
      events: expanded,
    },
    200
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
  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Calendar navigation can generate multiple fetches quickly; limit per-user (not per-IP)
  // to avoid shared-network false positives.
  const limitedIp = await enforceRateLimit(req.headers, "student:events:get:ip", { points: 120, duration: 60 });
  if (limitedIp) return limitedIp;

  const limitedUser = await enforceRateLimit(req.headers, "student:events:get:user", {
    points: 300,
    duration: 60,
    identity: session.user.id,
  });
  if (limitedUser) return limitedUser;

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
