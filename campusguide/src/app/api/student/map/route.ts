import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireSession } from "@/server/security/requireSession";
import { getRoomsCached } from "@/server/data/rooms";
import { connectToDatabase } from "@/server/db";
import { Event, EventTypes } from "@/server/models/Event";
import { jsonWithEtag } from "@/server/httpCache";
import { expandOccurrences } from "@/server/calendar/recurrence";

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
    for (const occ of expandOccurrences(e, now, in7)) {
      expanded.push({
        title: e.title,
        type: e.type,
        start: occ.start.toISOString(),
        end: occ.end.toISOString(),
        roomCode: String(e.roomCode),
      });
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
