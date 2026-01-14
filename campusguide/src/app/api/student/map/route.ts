import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireSession } from "@/server/security/requireSession";
import { getRoomsCached } from "@/server/data/rooms";
import { connectToDatabase } from "@/server/db";
import { Event, EventTypes } from "@/server/models/Event";
import { jsonWithEtag } from "@/server/httpCache";

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

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:map:get");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const rooms = await getRoomsCached();

  await connectToDatabase();
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const oneOff = await Event.find({
    userId: session.user.id,
    type: { $in: [EventTypes.Lecture, EventTypes.Lab] },
    roomCode: { $exists: true, $ne: null },
    start: { $gte: now, $lte: in7 },
    isRecurring: { $ne: true },
  })
    .sort({ start: 1 })
    .select({ title: 1, type: 1, start: 1, end: 1, roomCode: 1 })
    .lean();

  const scheduleRoomCodesRaw = await Event.find({
    userId: session.user.id,
    type: { $in: [EventTypes.Lecture, EventTypes.Lab] },
    roomCode: { $exists: true, $ne: null },
  })
    .select({ roomCode: 1 })
    .lean();

  const scheduleRoomCodes = Array.from(
    new Set(
      (scheduleRoomCodesRaw as any[])
        .map((e) => String(e.roomCode ?? "").trim().toUpperCase())
        .filter(Boolean)
    )
  );

  const recurring = await Event.find({
    userId: session.user.id,
    type: { $in: [EventTypes.Lecture, EventTypes.Lab] },
    roomCode: { $exists: true, $ne: null },
    isRecurring: true,
    rrule: { $exists: true, $ne: null },
  })
    .select({ title: 1, type: 1, start: 1, end: 1, roomCode: 1, rrule: 1 })
    .lean();

  const expanded: Array<{ title: string; type: string; start: string; end: string; roomCode: string }> = [];
  for (const e of recurring as any[]) {
    const startBase = new Date(e.start);
    const endBase = new Date(e.end);
    const durationMs = endBase.getTime() - startBase.getTime();

    const bydays = parseByDays(e.rrule, startBase);
    const hh = startBase.getHours();
    const mm = startBase.getMinutes();

    const seriesStartDay = dateOnlyLocal(startBase);
    const searchFrom = maxDate(seriesStartDay, dateOnlyLocal(now));

    for (const dow of bydays) {
      let day = nextDowOnOrAfterLocal(searchFrom, dow);
      while (day.getTime() < in7.getTime()) {
        const startOcc = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm, 0, 0);
        if (startOcc.getTime() < startBase.getTime()) {
          day.setDate(day.getDate() + 7);
          continue;
        }
        const endOcc = new Date(startOcc.getTime() + durationMs);
        if (endOcc > now && startOcc < in7) {
          expanded.push({
            title: e.title,
            type: e.type,
            start: startOcc.toISOString(),
            end: endOcc.toISOString(),
            roomCode: String(e.roomCode),
          });
        }
        day.setDate(day.getDate() + 7);
      }
    }
  }

  const upcoming = [...(oneOff as any[]).map((e) => ({ ...e, start: new Date(e.start).toISOString(), end: new Date(e.end).toISOString(), roomCode: String(e.roomCode) })), ...expanded]
    .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 60);

  return jsonWithEtag(
    req,
    {
      rooms: rooms.map((r: any) => ({ roomCode: r.roomCode, building: r.building, floor: r.floor, x: r.x, y: r.y })),
      upcoming,
      scheduleRoomCodes,
    },
    // Safe to cache briefly in the browser; varies by session cookie.
    { cacheControl: "private, max-age=30, stale-while-revalidate=300" }
  );
}
