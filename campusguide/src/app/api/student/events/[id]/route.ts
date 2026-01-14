import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { Event, EventTypes } from "@/server/models/Event";
import { noStoreJson } from "@/server/httpCache";

// Accept timezone offsets like "+02:00" (FullCalendar sends these).
const isoDate = z.string().datetime({ offset: true });
const hhmmTime = z.string().regex(/^\d{2}:\d{2}$/).optional();

function bydayFromDate(d: Date) {
  const map = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
  return map[d.getDay()] ?? "MO";
}

function stripUntilCount(rule: string) {
  const trimmed = rule.trim();
  const hasPrefix = trimmed.toUpperCase().startsWith("RRULE:");
  const body = hasPrefix ? trimmed.slice("RRULE:".length) : trimmed;

  const parts = body
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const key = p.split("=")[0]?.toUpperCase();
      return key !== "UNTIL" && key !== "COUNT";
    });

  const nextBody = parts.join(";");
  return hasPrefix ? `RRULE:${nextBody}` : nextBody;
}

function dowNumber(code: string) {
  const map: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  return map[code] ?? 1;
}

function shiftDateToDowOnOrAfter(base: Date, targetDow: number) {
  const d = new Date(base);
  const delta = (targetDow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function withByDay(rule: string, byday: string) {
  const trimmed = rule.trim();
  const hasPrefix = trimmed.toUpperCase().startsWith("RRULE:");
  const body = hasPrefix ? trimmed.slice("RRULE:".length) : trimmed;
  const nextBody = /(^|;)BYDAY=/.test(body) ? body.replace(/(^|;)BYDAY=[A-Z,]+/g, `$1BYDAY=${byday}`) : `${body};BYDAY=${byday}`;
  return hasPrefix ? `RRULE:${nextBody}` : nextBody;
}

const patchSchema = z
  .object({
    title: z.string().min(1).max(120).transform((v) => v.trim()).optional(),
    type: z.enum([EventTypes.Lecture, EventTypes.Lab]).optional(),
    start: isoDate.optional(),
    end: isoDate.optional(),
    startTime: hhmmTime,  // HH:MM format for time-only updates
    endTime: hhmmTime,    // HH:MM format for time-only updates
    dayOfWeek: z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]).optional(),
    roomCode: z
      .string()
      .max(16)
      .optional()
      .transform((v) => (v ? v.trim().toUpperCase() : v)),
    professor: z
      .string()
      .max(100)
      .optional()
      .transform((v) => (v ? v.trim() : v)),
    building: z
      .string()
      .max(8)
      .optional()
      .transform((v) => (v ? v.trim().toUpperCase() : v)),
    isRecurring: z.boolean().optional(),
    rrule: z.string().max(500).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "student:events:patch");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
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

  const update: any = { ...parsed.data };
  if (update.start) update.start = new Date(update.start);
  if (update.end) update.end = new Date(update.end);

  await connectToDatabase();
  const found = await Event.findOne({ _id: id, userId: session.user.id });
  if (!found) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Handle HH:MM time updates (update time only, keep date)
  if (update.startTime && found.start) {
    const [h, m] = update.startTime.split(":").map(Number);
    const d = new Date(found.start);
    d.setHours(h, m, 0, 0);
    update.start = d;
    delete update.startTime;
  }
  if (update.endTime && found.end) {
    const [h, m] = update.endTime.split(":").map(Number);
    const d = new Date(found.end);
    d.setHours(h, m, 0, 0);
    update.end = d;
    delete update.endTime;
  }

  // Day-of-week updates: shift the stored start/end to the next chosen weekday
  // and update the RRULE BYDAY for recurring events.
  if (update.dayOfWeek) {
    const code = String(update.dayOfWeek).toUpperCase();
    const target = dowNumber(code);

    const baseStart = (update.start instanceof Date ? update.start : found.start) ? new Date(update.start ?? found.start) : null;
    const baseEnd = (update.end instanceof Date ? update.end : found.end) ? new Date(update.end ?? found.end) : null;
    if (baseStart && baseEnd) {
      const durationMs = baseEnd.getTime() - baseStart.getTime();
      const nextStart = shiftDateToDowOnOrAfter(baseStart, target);
      update.start = nextStart;
      update.end = new Date(nextStart.getTime() + durationMs);
    }

    if (found.isRecurring && found.rrule && !update.rrule) {
      update.rrule = stripUntilCount(withByDay(found.rrule, code));
    } else if (typeof update.rrule === "string") {
      update.rrule = stripUntilCount(update.rrule);
    }

    delete update.dayOfWeek;
  }

  // Validate final start/end after applying time/day transforms.
  const finalStart = (update.start instanceof Date ? update.start : found.start) ? new Date(update.start ?? found.start) : null;
  const finalEnd = (update.end instanceof Date ? update.end : found.end) ? new Date(update.end ?? found.end) : null;
  if (finalStart && finalEnd && !(finalStart < finalEnd)) {
    return new Response(JSON.stringify({ error: "End must be after start" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // If a recurring event is moved (drag/drop), update its BYDAY to match the new start day.
  // This makes the whole series move to the new weekday.
  if (found.isRecurring && found.rrule && update.start instanceof Date && !update.rrule) {
    const byday = bydayFromDate(update.start);
    update.rrule = stripUntilCount(withByDay(found.rrule, byday));
  }

  Object.assign(found, update);
  await found.save();

  return noStoreJson({ ok: true }, 200);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "student:events:delete");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const deleted = await Event.deleteOne({ _id: id, userId: session.user.id });
  if (!deleted.deletedCount) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return noStoreJson({ ok: true }, 200);
}
